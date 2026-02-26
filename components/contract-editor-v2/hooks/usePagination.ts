import { useEffect, useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG } from '../config/pageConfig'
import { paginationSpacersKey } from '../extensions/pagination-spacers'
import type { PageBreakInfo } from '../extensions/pagination-spacers'
import type { EditorState } from 'prosemirror-state'

function snapToWordBoundary(state: EditorState, pos: number): number {
  const { doc } = state
  const docSize = doc.content.size
  const clamped = Math.max(0, Math.min(pos, docSize))

  const windowSize = 30
  const from = Math.max(0, clamped - windowSize)
  const to = Math.min(docSize, clamped + windowSize)

  const text = doc.textBetween(from, to, '', '')
  const center = clamped - from
  const isWS = (ch: string) => /\s/u.test(ch)

  const before = center - 1
  const at = center
  if (
    (before >= 0 && before < text.length && isWS(text[before])) ||
    (at >= 0 && at < text.length && isWS(text[at]))
  ) {
    return clamped
  }

  for (let d = 1; d <= windowSize; d++) {
    const leftIdx = center - d
    const rightIdx = center + d

    if (leftIdx > 0 && leftIdx <= text.length) {
      const chBefore = text[leftIdx - 1]
      if (chBefore && isWS(chBefore)) return from + leftIdx
    }

    if (rightIdx >= 0 && rightIdx < text.length) {
      const chAt = text[rightIdx]
      if (chAt && isWS(chAt)) return from + rightIdx
    }
  }

  return clamped
}

/**
 * Google-Docs–style pagination hook.
 *
 * Phase 1 — Break between blocks & list items:
 *   • Flattens <ol>/<ul> to their <li> children for finer break granularity.
 *   • Uses `posAtDOM(el, 0) - 1` so spacers sit *between* nodes, not inside.
 *   • Pushes a block to the next page when it doesn't fit the remaining space
 *     but would fit on a fresh page.
 *
 * Phase 2 — Split long paragraphs at page boundaries:
 *   • When a <p> overflows the remaining page space, uses `posAtCoords` to
 *     find the nearest text position at the page boundary Y-coordinate, then
 *     dispatches `tr.split(splitPos)` to break the paragraph into two nodes.
 *   • After the split, measure() is re-invoked via RAF so Phase 1 can handle
 *     the newly created block boundary naturally.
 *   • A `lastSplitRef` guard prevents infinite re-splitting at the same pos.
 *   • Falls back to a Phase 1 break-before-paragraph if no valid split found.
 */
export function usePagination(
  editor: Editor | null,
  hfHeights?: { headerH: number; footerH: number }
): { pageCount: number } {
  const rafRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevBreaksRef = useRef<string>('')
  const [pageCount, setPageCount] = useState(1)

  // Phase 2 guard: track last split to avoid infinite re-splitting
  const lastSplitRef = useRef<{ pos: number; docSize: number } | null>(null)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) return

    const view = editor.view
    const proseMirror = view.dom
    if (!proseMirror) return

    // Dynamic header/footer heights (fall back to config defaults)
    const hH = hfHeights?.headerH ?? PAGE_CONFIG.headerHeight
    const fH = hfHeights?.footerH ?? PAGE_CONFIG.footerHeight

    // Height available for body content on each page
    const usableHeight =
      PAGE_CONFIG.height - hH - fH - PAGE_CONFIG.paddingTop - PAGE_CONFIG.paddingBottom

    // Height of the spacer decoration (fills header + footer + gap + padding zones)
    const spacerHeight =
      hH + fH + PAGE_CONFIG.gap + PAGE_CONFIG.paddingTop + PAGE_CONFIG.paddingBottom

    // ── Phase 1: Collect breakable elements ─────────────────────────────
    // Flatten <ol>/<ul> into their <li> children so page breaks can fall
    // between individual list items rather than treating the whole list as
    // a single indivisible block.
    const allChildren = proseMirror.querySelectorAll(':scope > *')
    const blocks: HTMLElement[] = []
    allChildren.forEach((el) => {
      const htmlEl = el as HTMLElement
      if (htmlEl.classList.contains('pagination-spacer')) return

      const tag = htmlEl.tagName.toLowerCase()
      if (tag === 'ol' || tag === 'ul') {
        // Push each <li> individually for finer break granularity
        const items = htmlEl.querySelectorAll(':scope > li')
        items.forEach((li) => blocks.push(li as HTMLElement))
      } else {
        blocks.push(htmlEl)
      }
    })

    if (blocks.length === 0) {
      view.dispatch(view.state.tr.setMeta(paginationSpacersKey, []))
      return
    }

    /**
     * Get the ProseMirror position BEFORE an element.
     * `posAtDOM(el, 0)` returns the first position *inside* the node;
     * subtracting 1 yields the position just before its opening tag,
     * which is where we want the spacer decoration to appear.
     */
    const posBefore = (el: HTMLElement): number => {
      try {
        const inside = view.posAtDOM(el, 0)
        return Math.max(0, inside - 1)
      } catch {
        return 0
      }
    }

    let currentPageHeight = 0
    const breakInfos: PageBreakInfo[] = []

    for (const el of blocks) {
      const isPageBreak = el.getAttribute('data-type') === 'page-break'
      const blockHeight = el.getBoundingClientRect().height

      // ── Explicit page break node ──────────────────────────────────────
      if (isPageBreak) {
        breakInfos.push({ pos: posBefore(el), spacerHeight })
        currentPageHeight = 0
        continue
      }

      // ── Case 1: block fits on the current page ────────────────────────
      if (currentPageHeight + blockHeight <= usableHeight) {
        currentPageHeight += blockHeight
        continue
      }

      // ── Phase 2: split a paragraph at the page boundary ────────────────
      // If the overflowing block is a <p> and there is content above it on
      // the current page, find where the page boundary falls inside the
      // paragraph and split the ProseMirror node there via tr.split().
      // After the split the DOM will contain two paragraphs that Phase 1
      // handles naturally on the next measure pass.
      const isParagraph = el.tagName.toLowerCase() === 'p'
      if (isParagraph && currentPageHeight > 0) {
        const remaining = usableHeight - currentPageHeight
        const rect = el.getBoundingClientRect()
        const hit = view.posAtCoords({ left: rect.left + 5, top: rect.top + remaining - 1 })

        if (hit) {
          const raw = hit.pos
          const splitPos = snapToWordBoundary(view.state, raw)
          const $pos = view.state.doc.resolve(splitPos)

          // Ensure the position is inside a paragraph and not at its edges
          if (
            $pos.parent.type.name === 'paragraph' &&
            splitPos > $pos.start() &&
            splitPos < $pos.end()
          ) {
            const docSize = view.state.doc.content.size

            // Guard: avoid infinite re-splitting at the same position
            if (
              !lastSplitRef.current ||
              lastSplitRef.current.pos !== splitPos ||
              lastSplitRef.current.docSize !== docSize
            ) {
              lastSplitRef.current = { pos: splitPos, docSize }
              view.dispatch(view.state.tr.split(splitPos))
              // Rerun measure after the DOM updates from the split
              requestAnimationFrame(() => measure())
              return // stop current pass — the split changed the document
            }
          }
        }
        // Fallback: split position not found or invalid — fall through to Phase 1
      }

      // ── Phase 1: push whole block to next page ──────────────────────────
      // The block doesn't fit on the remaining space. Push to next page.
      if (currentPageHeight > 0) {
        breakInfos.push({ pos: posBefore(el), spacerHeight })
        currentPageHeight = blockHeight
      } else {
        // Block is the first on the page and still overflows — just overflow
        currentPageHeight += blockHeight
      }
    }

    // ── Dispatch only if break positions actually changed ───────────────
    const key = breakInfos.map((b) => `${b.pos}`).join(',')
    if (key === prevBreaksRef.current) return
    prevBreaksRef.current = key
    setPageCount(breakInfos.length + 1)

    view.dispatch(view.state.tr.setMeta(paginationSpacersKey, breakInfos))
  }, [editor, hfHeights])

  const debouncedMeasure = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
      // Double-RAF: let layout settle before measuring
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(measure)
      })
    }, 50)
  }, [measure])

  // Re-paginate when hfHeights change (separate from the editor-lifecycle effect)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    debouncedMeasure()
  }, [hfHeights, editor, debouncedMeasure])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    // Wait for web fonts before first measurement
    document.fonts?.ready.then(() => {
      // Double-RAF after fonts: ensures layout is fully settled
      requestAnimationFrame(() => requestAnimationFrame(measure))
    })

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
  }, [editor, debouncedMeasure, measure])

  return { pageCount }
}
