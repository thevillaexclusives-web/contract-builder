import { useEffect, useRef, useCallback, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode, NodeType } from '@tiptap/pm/model'
import { canSplit } from 'prosemirror-transform'
import { PAGE_CONFIG } from '../config/pageConfig'

/** Snap a doc position to the nearest whitespace boundary within ±30 chars. */
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

/** Meta key used to tag layout transactions so the update handler can ignore them. */
export const layoutMetaKey = new PluginKey('pageLayout')

const MAX_MOVES = 30

/**
 * Page-layout hook for the page-node editor model.
 *
 * On every editor update (that is NOT itself a layout transaction) it:
 *   1. Measures each `.pm-page` DOM node to find overflow.
 *   2. Moves the last block of an overflowing page to the start of the next
 *      page (creating a new page node if needed).
 *   3. Pulls blocks back from a next page when they would fit on the
 *      previous page, so pages stay full.
 *   4. Removes any empty pages left over.
 *
 * All mutations happen in a single ProseMirror transaction tagged with
 * `layoutMetaKey` so they don't re-trigger the layout loop.
 */
export function usePageLayout(
  editor: Editor | null,
  hfHeights?: { headerH: number; footerH: number }
): { pageCount: number } {
  const rafRef = useRef<number>(0)
  const isLayingOutRef = useRef(false)
  // Guard: prevent re-splitting the same paragraph at the same position
  const lastSplitRef = useRef<{ pos: number; docSize: number } | null>(null)
  const [pageCount, setPageCount] = useState(1)

  const measure = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    if (isLayingOutRef.current) return
    isLayingOutRef.current = true

    try {
      const view = editor.view
      const dom = view.dom as HTMLElement
      if (!dom) return

      const hH = hfHeights?.headerH ?? PAGE_CONFIG.headerHeight
      const fH = hfHeights?.footerH ?? PAGE_CONFIG.footerHeight
      const bodyHeight =
        PAGE_CONFIG.height - hH - fH - PAGE_CONFIG.paddingTop - PAGE_CONFIG.paddingBottom

      // ── Helper: compute the body bottom Y for a page DOM node ────────────
      const getBodyBottomY = (pageEl: HTMLElement): number => {
        const pageRect = pageEl.getBoundingClientRect()
        return pageRect.top + PAGE_CONFIG.paddingTop + hH + bodyHeight
      }

      // ── Helper: find the first overflowing child index in a page DOM node ──
      const findOverflowIndex = (pageEl: HTMLElement): number => {
        const bodyBottomY = getBodyBottomY(pageEl)

        const children = pageEl.children
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement
          if (child.getBoundingClientRect().bottom > bodyBottomY + 0.5) {
            return i
          }
        }
        return -1 // no overflow
      }

      // ── Helper: would a block from the next page fit on a page? ──────────
      // Checks if adding the first block of `nextPageEl` would still fit
      // within the body area of `pageEl`.
      const canPullBlock = (pageEl: HTMLElement, nextPageEl: HTMLElement): boolean => {
        const pageRect = pageEl.getBoundingClientRect()
        const bodyTopY = pageRect.top + PAGE_CONFIG.paddingTop + hH
        const bodyBottomY = bodyTopY + bodyHeight

        // Current content bottom inside this page
        const children = pageEl.children
        let contentBottom = bodyTopY
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement
          const r = child.getBoundingClientRect()
          if (r.bottom > contentBottom) contentBottom = r.bottom
        }

        // Height of the first block on the next page
        const nextChildren = nextPageEl.children
        let firstBlockHeight = 0
        for (let i = 0; i < nextChildren.length; i++) {
          const child = nextChildren[i] as HTMLElement
          firstBlockHeight = child.getBoundingClientRect().height
          break
        }
        if (firstBlockHeight === 0) return false

        return contentBottom + firstBlockHeight <= bodyBottomY + 0.5
      }

      // ── Helper: find the next page offset given a page index ─────────────
      const findNextPageOffset = (
        doc: PMNode,
        pageType: NodeType,
        targetIndex: number
      ): number => {
        let nextPageOffset = -1
        let scanIdx = 0
        doc.forEach((n, o) => {
          if (n.type === pageType && scanIdx === targetIndex) {
            nextPageOffset = o
          }
          scanIdx++
        })
        return nextPageOffset
      }

      // ── Helper: move a block node to the start of the next page ──────────
      // Returns true if a mutation was dispatched.
      const moveBlockToNextPage = (
        blockNode: PMNode,
        blockStart: number,
        blockEnd: number,
        pageOffset: number,
        pageNode: PMNode,
        pageIndex: number
      ): boolean => {
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page
        const nextPageOffset = findNextPageOffset(doc, pageType, pageIndex + 1)
        const tr = view.state.tr

        if (nextPageOffset >= 0) {
          const insertPos = nextPageOffset + 1
          tr.delete(blockStart, blockEnd)
          tr.insert(tr.mapping.map(insertPos), blockNode)
        } else {
          const newPage = pageType.create(null, blockNode)
          const afterCurrentPage = pageOffset + pageNode.nodeSize
          tr.delete(blockStart, blockEnd)
          tr.insert(tr.mapping.map(afterCurrentPage), newPage)
        }

        tr.setMeta(layoutMetaKey, true)
        view.dispatch(tr)
        return true
      }

      // ── Phase 1: push overflowing blocks forward ─────────────────────────
      // When the overflowing block is a paragraph that straddles the page
      // boundary, split it at the boundary line and move only the second half
      // to the next page. Otherwise move the whole last block.
      let moves = 0
      let didMutate = true

      while (didMutate && moves < MAX_MOVES) {
        didMutate = false
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page

        let pageIndex = 0
        doc.forEach((pageNode, pageOffset) => {
          if (didMutate) return
          if (pageNode.type !== pageType) return

          const pageDom = view.nodeDOM(pageOffset) as HTMLElement | null
          if (!pageDom || !pageDom.classList.contains('pm-page')) return

          const overflowIdx = findOverflowIndex(pageDom)
          if (overflowIdx < 0) { pageIndex++; return }

          const lastChildIdx = pageNode.childCount - 1
          if (lastChildIdx < 0) { pageIndex++; return }

          // Single block on the page and it overflows — can't move it
          if (pageNode.childCount <= 1 && overflowIdx === 0) {
            pageIndex++
            return
          }

          // ── Try paragraph split if the overflowing block is a <p> ────────
          // Only attempt when the paragraph starts ABOVE the page boundary
          // (i.e. it straddles the boundary), so splitting keeps the top part
          // on this page rather than leaving a big gap.
          const overflowEl = pageDom.children[overflowIdx] as HTMLElement | null

          if (
            overflowEl &&
            overflowEl.tagName.toLowerCase() === 'p' &&
            overflowIdx === lastChildIdx // only split if it's the last block
          ) {
            const bodyBottomY = getBodyBottomY(pageDom)
            const elRect = overflowEl.getBoundingClientRect()
            const remaining = bodyBottomY - elRect.top

            // The paragraph starts above the boundary (remaining > 0) and
            // extends below it — a good candidate for splitting.
            if (remaining > 0) {
              const hit = view.posAtCoords({
                left: elRect.left + 5,
                top: elRect.top + remaining - 1,
              })

              if (hit) {
                const splitPos = snapToWordBoundary(view.state, hit.pos)
                const $pos = view.state.doc.resolve(splitPos)
                const docSize = view.state.doc.content.size

                // Verify: inside a paragraph, not at edges, splittable, not a repeat
                if (
                  $pos.parent.type.name === 'paragraph' &&
                  splitPos > $pos.start() &&
                  splitPos < $pos.end() &&
                  canSplit(view.state.doc, splitPos) &&
                  (!lastSplitRef.current ||
                    lastSplitRef.current.pos !== splitPos ||
                    lastSplitRef.current.docSize !== docSize)
                ) {
                  lastSplitRef.current = { pos: splitPos, docSize }

                  // Split the paragraph — this creates two paragraphs in the
                  // same page. The next iteration will detect the second one
                  // overflowing and move it as a whole block.
                  const tr = view.state.tr.split(splitPos)
                  tr.setMeta(layoutMetaKey, true)
                  view.dispatch(tr)
                  moves++
                  didMutate = true
                  return
                }
              }
            }
          }

          // ── Try list split if the overflowing block is a list ────────────
          // When a <ol>/<ul> straddles the page boundary, find the <li> that
          // crosses bodyBottomY, split the list before it, and move the second
          // half to the next page. For <ol>, update the `start` attribute.
          if (
            overflowEl &&
            (overflowEl.tagName.toLowerCase() === 'ol' ||
             overflowEl.tagName.toLowerCase() === 'ul')
          ) {
            const bodyBottomY = getBodyBottomY(pageDom)
            const liElements = overflowEl.querySelectorAll(':scope > li')

            // Find the first <li> that overflows
            let splitLiIdx = -1
            for (let li = 0; li < liElements.length; li++) {
              if (liElements[li].getBoundingClientRect().bottom > bodyBottomY + 0.5) {
                splitLiIdx = li
                break
              }
            }

            // Only split if there's a fitting item before the overflow (splitLiIdx > 0)
            if (splitLiIdx > 0) {
              try {
                const liEl = liElements[splitLiIdx] as HTMLElement
                const liPosInside = view.posAtDOM(liEl, 0)
                const $li = view.state.doc.resolve(liPosInside)

                const schemaNodes = view.state.schema.nodes
                const listItemType = schemaNodes.listItem ?? schemaNodes.list_item
                const orderedListType = schemaNodes.orderedList ?? schemaNodes.ordered_list
                const bulletListType = schemaNodes.bulletList ?? schemaNodes.bullet_list

                // Walk up to find listItem depth
                let liDepth = -1
                for (let d = $li.depth; d >= 1; d--) {
                  if (listItemType && $li.node(d).type === listItemType) {
                    liDepth = d
                    break
                  }
                }

                if (liDepth >= 1) {
                  // Find the list container depth above the listItem
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

                  const splitPos = $li.before(liDepth)
                  const docSize = view.state.doc.content.size

                  if (
                    canSplit(view.state.doc, splitPos, 1) &&
                    (!lastSplitRef.current ||
                      lastSplitRef.current.pos !== splitPos ||
                      lastSplitRef.current.docSize !== docSize)
                  ) {
                    lastSplitRef.current = { pos: splitPos, docSize }

                    const tr = view.state.tr.split(splitPos, 1)

                    // For ordered lists, set `start` on the second list
                    if (
                      overflowEl.tagName.toLowerCase() === 'ol' &&
                      orderedListType &&
                      listDepth >= 1
                    ) {
                      const originalListNode = $li.node(listDepth)
                      const originalStart =
                        (originalListNode.attrs?.start as number) ?? 1
                      const nextStart = originalStart + splitLiIdx

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

                    tr.setMeta(layoutMetaKey, true)
                    view.dispatch(tr)
                    moves++
                    didMutate = true
                    return
                  }
                }
              } catch {
                // split attempt failed — fall through to whole-block move
              }
            }
          }

          // ── Fall through: move the whole last block ──────────────────────
          // Reset split guard since we're doing a block move, not a split
          lastSplitRef.current = null

          const blockToMove = pageNode.child(lastChildIdx)
          let blockStart = pageOffset + 1
          for (let c = 0; c < lastChildIdx; c++) {
            blockStart += pageNode.child(c).nodeSize
          }
          const blockEnd = blockStart + blockToMove.nodeSize

          didMutate = moveBlockToNextPage(
            blockToMove, blockStart, blockEnd,
            pageOffset, pageNode, pageIndex
          )
          if (didMutate) moves++
          pageIndex++
        })
      }

      // Reset split guard after the push phase completes
      lastSplitRef.current = null

      // ── Phase 2: pull blocks back to fill pages ──────────────────────────
      // After pushing, some pages may have room. Pull the first block of the
      // next page back if it fits.
      didMutate = true
      while (didMutate && moves < MAX_MOVES) {
        didMutate = false
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page

        const pageNodes: { node: ReturnType<typeof doc.child>; offset: number }[] = []
        doc.forEach((n, o) => {
          if (n.type === pageType) pageNodes.push({ node: n, offset: o })
        })

        for (let p = 0; p < pageNodes.length - 1; p++) {
          const currPage = pageNodes[p]
          const nextPage = pageNodes[p + 1]

          // DOM elements for measurement
          const currDom = view.nodeDOM(currPage.offset) as HTMLElement | null
          const nextDom = view.nodeDOM(nextPage.offset) as HTMLElement | null
          if (!currDom || !nextDom) continue

          if (!canPullBlock(currDom, nextDom)) continue

          // Pull the first block from next page to end of current page
          const firstChild = nextPage.node.child(0)
          const firstChildStart = nextPage.offset + 1
          const firstChildEnd = firstChildStart + firstChild.nodeSize

          // Insert position: end of current page content
          const insertPos = currPage.offset + currPage.node.nodeSize - 1

          const tr = view.state.tr
          tr.delete(firstChildStart, firstChildEnd)
          const mappedInsert = tr.mapping.map(insertPos)
          tr.insert(mappedInsert, firstChild)

          tr.setMeta(layoutMetaKey, true)
          view.dispatch(tr)
          moves++
          didMutate = true
          break // restart scan from the beginning after mutation
        }
      }

      // ── Phase 3: remove empty pages (except the first) ──────────────────
      {
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page

        const emptyPages: { offset: number; size: number }[] = []
        let idx = 0
        doc.forEach((n, o) => {
          if (n.type === pageType && n.childCount === 0 && idx > 0) {
            emptyPages.push({ offset: o, size: n.nodeSize })
          }
          idx++
        })

        if (emptyPages.length > 0) {
          const tr = view.state.tr
          // Delete in reverse order to keep offsets valid
          for (let i = emptyPages.length - 1; i >= 0; i--) {
            const { offset, size } = emptyPages[i]
            tr.delete(offset, offset + size)
          }
          tr.setMeta(layoutMetaKey, true)
          view.dispatch(tr)
        }
      }
      // ── Update page count ─────────────────────────────────────────────
      {
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page
        let count = 0
        doc.forEach((n) => {
          if (n.type === pageType) count++
        })
        setPageCount((prev) => (prev !== count ? count : prev))
      }
    } finally {
      isLayingOutRef.current = false
    }
  }, [editor, hfHeights])

  const scheduleMeasure = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    // Double-RAF: let ProseMirror DOM flush before measuring
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(measure)
    })
  }, [measure])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    // Initial measurement after fonts are ready
    document.fonts?.ready.then(() => {
      requestAnimationFrame(() => requestAnimationFrame(measure))
    })

    const onUpdate = ({ transaction }: { editor: Editor; transaction: { getMeta: (key: PluginKey) => unknown } }) => {
      // Skip layout-triggered updates to avoid infinite loops
      if (transaction.getMeta(layoutMetaKey)) return
      scheduleMeasure()
    }
    editor.on('update', onUpdate)

    window.addEventListener('resize', scheduleMeasure)

    // Watch for images loading (they change layout)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLImageElement) {
            node.addEventListener('load', scheduleMeasure, { once: true })
          }
          if (node instanceof HTMLElement) {
            node.querySelectorAll('img').forEach((img) => {
              if (!img.complete) {
                img.addEventListener('load', scheduleMeasure, { once: true })
              }
            })
          }
        })
      }
    })
    observer.observe(editor.view.dom, { childList: true, subtree: true })

    scheduleMeasure()

    return () => {
      editor.off('update', onUpdate)
      window.removeEventListener('resize', scheduleMeasure)
      observer.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [editor, scheduleMeasure, measure])

  return { pageCount }
}
