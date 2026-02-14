import { useEffect, useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG, contentUsableHeight } from '../config/pageConfig'
import { paginationSpacersKey } from '../extensions/pagination-spacers'
import type { PageBreakInfo } from '../extensions/pagination-spacers'

const SPACER_HEIGHT =
  PAGE_CONFIG.headerHeight +
  PAGE_CONFIG.footerHeight +
  PAGE_CONFIG.gap +
  PAGE_CONFIG.paddingTop +
  PAGE_CONFIG.paddingBottom // 96 + 72 + 24 + 24 + 24 = 240

export function usePagination(editor: Editor | null): { pageCount: number } {
  const rafRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevBreaksRef = useRef<string>('')
  const [pageCount, setPageCount] = useState(1)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const view = editor.view
    const proseMirror = view.dom
    if (!proseMirror) return

    // Collect top-level block elements, skipping spacers
    const allChildren = proseMirror.querySelectorAll(':scope > *')
    const blocks: HTMLElement[] = []
    allChildren.forEach((el) => {
      if (!(el as HTMLElement).classList.contains('pagination-spacer')) {
        blocks.push(el as HTMLElement)
      }
    })

    if (blocks.length === 0) {
      view.dispatch(view.state.tr.setMeta(paginationSpacersKey, []))
      return
    }

    let currentPageHeight = 0
    const breakInfos: PageBreakInfo[] = []

    for (const el of blocks) {
      const isPageBreak = el.getAttribute('data-type') === 'page-break'
      const blockHeight = el.getBoundingClientRect().height

      if (isPageBreak) {
        // Find ProseMirror position for this DOM element
        const pos = view.posAtDOM(el, 0)
        breakInfos.push({ pos, spacerHeight: SPACER_HEIGHT })
        currentPageHeight = 0
        continue
      }

      if (currentPageHeight + blockHeight > contentUsableHeight && currentPageHeight > 0) {
        const pos = view.posAtDOM(el, 0)
        breakInfos.push({ pos, spacerHeight: SPACER_HEIGHT })
        currentPageHeight = blockHeight
      } else {
        currentPageHeight += blockHeight
      }
    }

    // Only update if breaks changed
    const key = breakInfos.map((b) => `${b.pos}`).join(',')
    if (key === prevBreaksRef.current) return
    prevBreaksRef.current = key
    setPageCount(breakInfos.length + 1)

    view.dispatch(view.state.tr.setMeta(paginationSpacersKey, breakInfos))
  }, [editor])

  const debouncedMeasure = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      rafRef.current = requestAnimationFrame(measure)
    }, 50)
  }, [measure])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    document.fonts.ready.then(debouncedMeasure)

    const onUpdate = () => debouncedMeasure()
    editor.on('update', onUpdate)

    window.addEventListener('resize', debouncedMeasure)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            node.addEventListener('load', debouncedMeasure, { once: true })
          }
          if (node instanceof HTMLElement) {
            node.querySelectorAll('img').forEach((img) => {
              if (!img.complete) {
                img.addEventListener('load', debouncedMeasure, { once: true })
              }
            })
          }
        })
      }
    })

    observer.observe(editor.view.dom, { childList: true, subtree: true })

    debouncedMeasure()

    return () => {
      editor.off('update', onUpdate)
      window.removeEventListener('resize', debouncedMeasure)
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [editor, debouncedMeasure])

  return { pageCount }
}
