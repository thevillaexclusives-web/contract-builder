import { useEffect, useCallback, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG } from '../config/pageConfig'
import { paginationSpacersKey } from '../extensions/pagination-spacers'
import type { PageBreakInfo } from '../extensions/pagination-spacers'
import type { EditorState } from 'prosemirror-state'
import { canSplit } from 'prosemirror-transform'

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
 * Phase 1 — Break between top-level blocks & list items:
 *   • Uses `posAtDOM(el, 0) - 1` so spacers sit *between* nodes, not inside.
 *   • Pushes a block to the next page when it doesn't fit the remaining space
 *     but would fit on a fresh page.
 *   • For lists (<ol>/<ul>): measures each <li> individually. When an item
 *     overflows the page, splits the list node via `tr.split()` so the two
 *     halves become separate top-level blocks. Spacers are NEVER placed
 *     inside list DOM (that would create invalid HTML: <div> inside <ol>).
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

    // Height of the spacer decoration (fills header + footer + gap + padding zones)
    const spacerHeight =
      hH + fH + PAGE_CONFIG.gap + PAGE_CONFIG.paddingTop + PAGE_CONFIG.paddingBottom

    // ── Collect top-level block elements ─────────────────────────────────
    // Lists (<ol>/<ul>) are kept as single top-level blocks — we NEVER
    // insert spacer decorations inside list DOM (that creates invalid HTML:
    // <div> inside <ol>). Instead, we measure per-<li> heights below and
    // split the ProseMirror list node when an item crosses a page boundary.
    const allChildren = proseMirror.querySelectorAll(':scope > *')
    const blocks: HTMLElement[] = []
    allChildren.forEach((el) => {
      const htmlEl = el as HTMLElement
      if (htmlEl.classList.contains('pagination-spacer')) return
      blocks.push(htmlEl)
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

    // ── Deterministic page boundary helpers ──────────────────────────────
    // Instead of maintaining a moving pageBottomY, compute each element's
    // page index from its absolute Y position. This avoids sequential
    // accumulation drift and handles spacer-shifted content correctly.
    const shell = proseMirror.closest('.editor-v2-shell') as HTMLElement | null
    const shellTop = shell?.getBoundingClientRect().top ?? proseMirror.getBoundingClientRect().top
    const pageStride = PAGE_CONFIG.height + PAGE_CONFIG.gap

    /** Which page does a given viewport-Y coordinate fall on? */
    const pageIndexForY = (y: number): number =>
      Math.max(0, Math.floor((y - shellTop) / pageStride))

    /** Bottom of the usable body area on the given page (viewport Y). */
    const pageBodyBottomY = (pageIdx: number): number =>
      shellTop + pageIdx * pageStride + PAGE_CONFIG.height - fH - PAGE_CONFIG.paddingBottom

    /** Top of the usable body area on the given page (viewport Y). */
    const pageBodyTopY = (pageIdx: number): number =>
      shellTop + pageIdx * pageStride + PAGE_CONFIG.paddingTop + hH

    const breakInfos: PageBreakInfo[] = []

    for (const el of blocks) {
      const rect = el.getBoundingClientRect()
      const isPageBreak = el.getAttribute('data-type') === 'page-break'

      // ── Explicit page break node ──────────────────────────────────────
      if (isPageBreak) {
        breakInfos.push({ pos: posBefore(el), spacerHeight })
        continue
      }

      // ── Determine which page this element starts on ──────────────────
      const pageIdx = pageIndexForY(rect.top)
      const bottomY = pageBodyBottomY(pageIdx)

      // ── Block fits: rect.bottom within the current page boundary ──────
      if (rect.bottom <= bottomY + 0.5) {
        continue
      }

      // ── Overflow detected ─────────────────────────────────────────────
      const tag = el.tagName.toLowerCase()
      const hasContentAbove = rect.top > pageBodyTopY(pageIdx) + 0.5

      // ── List handling: per-item measurement with list splitting ────────
      if (tag === 'ol' || tag === 'ul') {
        const schemaNodes = view.state.schema.nodes

        // Support both Tiptap-style and PM-schema-style names
        const listItemType = schemaNodes.listItem ?? schemaNodes.list_item
        const orderedListType = schemaNodes.orderedList ?? schemaNodes.ordered_list
        const bulletListType = schemaNodes.bulletList ?? schemaNodes.bullet_list

        const liElements = el.querySelectorAll(':scope > li')

        for (let i = 0; i < liElements.length; i++) {
          const liEl = liElements[i] as HTMLElement
          const liRect = liEl.getBoundingClientRect()

          // Determine which page this list item starts on
          const liPageIdx = pageIndexForY(liRect.top)
          const liBottomY = pageBodyBottomY(liPageIdx)

          // Li fits on current page
          if (liRect.bottom <= liBottomY + 0.5) continue

          // For list items, decide "content above" using LI position
          const liHasContentAbove = liRect.top > pageBodyTopY(liPageIdx) + 0.5

          // This <li> overflows — try to split the list before it.
          // Allow split if there is content above OR earlier items in the list fit (i > 0).
          if (liHasContentAbove || i > 0) {
            try {
              const liPosInside = view.posAtDOM(liEl, 0)
              const $li = view.state.doc.resolve(liPosInside)

              // 1) Find listItem depth
              let liDepth = -1
              for (let d = $li.depth; d >= 1; d--) {
                if (listItemType && $li.node(d).type === listItemType) {
                  liDepth = d
                  break
                }
              }
              if (liDepth < 1) throw new Error('No listItem ancestor found')

              // 2) Find the list container (ordered/bullet) depth just above listItem
              let listDepth = -1
              for (let d = liDepth - 1; d >= 1; d--) {
                const t = $li.node(d).type
                if (
                  (orderedListType && t === orderedListType) ||
                  (bulletListType && t === bulletListType)
                ) {
                  listDepth = d
                  break
                }
              }
              if (listDepth < 1) throw new Error('No list container ancestor found')

              // Split position: before the listItem within its list
              const splitPos = $li.before(liDepth)
              const docSize = view.state.doc.content.size

              // Split the parent at depth=1 (i.e., split the list node at splitPos)
              if (
                canSplit(view.state.doc, splitPos, 1) &&
                (!lastSplitRef.current ||
                  lastSplitRef.current.pos !== splitPos ||
                  lastSplitRef.current.docSize !== docSize)
              ) {
                lastSplitRef.current = { pos: splitPos, docSize }

                const tr = view.state.tr.split(splitPos, 1)

                // For ordered lists, set `start` on the *second* list so numbering continues
                if (tag === 'ol' && orderedListType) {
                  const originalListNode = $li.node(listDepth)
                  const originalStart = (originalListNode.attrs?.start as number) ?? 1
                  const nextStart = originalStart + i

                  const mapped = tr.mapping.map(splitPos, 1)
                  const $mapped = tr.doc.resolve(mapped)

                  for (let d = $mapped.depth; d >= 1; d--) {
                    if ($mapped.node(d).type === orderedListType) {
                      tr.setNodeMarkup($mapped.before(d), undefined, {
                        ...$mapped.node(d).attrs,
                        start: nextStart,
                      })
                      break
                    }
                  }
                }

                view.dispatch(tr)
                requestAnimationFrame(() => measure())
                return // stop — doc changed, rerun will handle the rest
              }
            } catch {
              // split attempt failed — fall through to fallback
            }

            // Split failed — push the entire list to the next page.
            breakInfos.push({ pos: posBefore(el), spacerHeight })
            break
          }

          // First item on a fresh page and no content above — let it overflow for now
          break
        }

        // continue to next top-level block
        continue
      }

      // ── Phase 2: split a paragraph at the page boundary ────────────────
      const isParagraph = tag === 'p'
      if (isParagraph && hasContentAbove) {
        // How much of the paragraph fits on this page (viewport distance)
        const remaining = bottomY - rect.top
        if (remaining > 0) {
          const hit = view.posAtCoords({ left: rect.left + 5, top: rect.top + remaining - 1 })

          if (hit) {
            const splitPos = snapToWordBoundary(view.state, hit.pos)
            const $pos = view.state.doc.resolve(splitPos)

            if (
              $pos.depth === 1 &&
              $pos.parent.type.name === 'paragraph' &&
              splitPos > $pos.start() &&
              splitPos < $pos.end() &&
              canSplit(view.state.doc, splitPos)
            ) {
              const docSize = view.state.doc.content.size

              if (
                !lastSplitRef.current ||
                lastSplitRef.current.pos !== splitPos ||
                lastSplitRef.current.docSize !== docSize
              ) {
                lastSplitRef.current = { pos: splitPos, docSize }
                view.dispatch(view.state.tr.split(splitPos))
                requestAnimationFrame(() => measure())
                return
              }
            }
          }
        }
        // Fallback: split position not found — fall through to Phase 1
      }

      // ── Phase 1: push whole block to next page ──────────────────────────
      if (hasContentAbove) {
        breakInfos.push({ pos: posBefore(el), spacerHeight })
      }
      // else: first block on page, overflows — just continue (next pass
      // will have the spacer in DOM and can handle subsequent breaks)
    }

    // Reset split guard — it only needs to block the immediate re-measure loop
    lastSplitRef.current = null

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
