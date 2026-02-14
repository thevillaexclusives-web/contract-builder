import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG, contentUsableHeight } from '../config/pageConfig'

interface PaginationResult {
  pageCount: number
  pageBreakOffsets: number[]
}

export function usePagination(editor: Editor | null): PaginationResult {
  const [result, setResult] = useState<PaginationResult>({
    pageCount: 1,
    pageBreakOffsets: [],
  })
  const rafRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const proseMirror = editor.view.dom
    if (!proseMirror) return

    const blocks = proseMirror.querySelectorAll(':scope > *')
    if (blocks.length === 0) {
      setResult({ pageCount: 1, pageBreakOffsets: [] })
      return
    }

    const containerRect = proseMirror.getBoundingClientRect()
    const containerTop = containerRect.top

    let currentPageHeight = 0
    const offsets: number[] = []

    blocks.forEach((block) => {
      const el = block as HTMLElement

      // Check if this is a page break node
      const isPageBreak = el.getAttribute('data-type') === 'page-break'

      const rect = el.getBoundingClientRect()
      const blockTop = rect.top - containerTop
      const blockHeight = rect.height

      if (isPageBreak) {
        // Page break always forces a new page
        offsets.push(blockTop)
        currentPageHeight = 0
        return
      }

      // Check if adding this block exceeds the usable height
      if (currentPageHeight + blockHeight > contentUsableHeight && currentPageHeight > 0) {
        offsets.push(blockTop)
        currentPageHeight = blockHeight
      } else {
        currentPageHeight += blockHeight
      }
    })

    const pageCount = offsets.length + 1

    setResult((prev) => {
      if (
        prev.pageCount === pageCount &&
        prev.pageBreakOffsets.length === offsets.length &&
        prev.pageBreakOffsets.every((v, i) => Math.abs(v - offsets[i]) < 1)
      ) {
        return prev
      }
      return { pageCount, pageBreakOffsets: offsets }
    })
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

    // Initial measurement after fonts load
    document.fonts.ready.then(debouncedMeasure)

    // Editor update handler
    const onUpdate = () => debouncedMeasure()
    editor.on('update', onUpdate)

    // Window resize
    window.addEventListener('resize', debouncedMeasure)

    // Image load observer — watch for images loading inside the editor
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

    // Initial measure
    debouncedMeasure()

    return () => {
      editor.off('update', onUpdate)
      window.removeEventListener('resize', debouncedMeasure)
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [editor, debouncedMeasure])

  return result
}
