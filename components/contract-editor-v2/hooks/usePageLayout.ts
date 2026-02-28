import { useEffect, useRef, useCallback, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import type { Node as PMNode, NodeType } from '@tiptap/pm/model'
import { canSplit } from 'prosemirror-transform'
import { PAGE_CONFIG } from '../config/pageConfig'

const isEmptyParagraph = (n: PMNode) =>
  n.type.name === 'paragraph' && n.content.size === 0

const isEffectivelyEmptyPage = (page: PMNode) => {
  if (page.childCount === 0) return true
  for (let i = 0; i < page.childCount; i++) {
    if (!isEmptyParagraph(page.child(i))) return false
  }
  return true
}

/**
 * Detect an "empty" DOM `<li>` — no real text content, only a ProseMirror
 * trailing break or an empty paragraph.  Strips &nbsp; (\u00a0) before checking.
 */
const isEmptyListItemDom = (li: HTMLElement): boolean => {
  const text = (li.textContent || '').replace(/\u00a0/g, '').trim()
  if (text.length > 0) return false

  if (li.querySelector('br.ProseMirror-trailingBreak')) return true

  const paragraphs = li.querySelectorAll('p')
  if (paragraphs.length === 0) return true

  for (let i = 0; i < paragraphs.length; i++) {
    const t = (paragraphs[i].textContent || '').replace(/\u00a0/g, '').trim()
    if (t.length > 0) return false
  }
  return true
}

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

export const layoutMetaKey = new PluginKey('pageLayoutMeta')
const MAX_MOVES = 200

/**
 * V2 "pages mode" layout engine.
 *
 * Key invariant:
 * - Header/footer are overlays.
 * - The ONLY reliable definition of "safe body area" is the page element's
 *   computed padding (padding-top and padding-bottom).
 *
 * So we compute bodyTop/bodyBottom using getComputedStyle(pageEl).
 */
export function usePageLayout(
  editor: Editor | null,
  hfHeights?: { headerH: number; footerH: number }
): { pageCount: number } {
  const rafRef = useRef<number>(0)
  const isLayingOutRef = useRef(false)
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

      /**
       * Compute the usable body box for a page in viewport coordinates.
       * Uses computed padding from the `.pm-page` element as the source of truth.
       */
      const getBodyBox = (pageEl: HTMLElement): { top: number; bottom: number } => {
        const rect = pageEl.getBoundingClientRect()
        const cs = window.getComputedStyle(pageEl)
        const padTop = Number.parseFloat(cs.paddingTop || '0') || 0
        const padBottom = Number.parseFloat(cs.paddingBottom || '0') || 0

        // Fallback if padding is 0 during initial paint / CSS not yet applied.
        const fallbackTop = rect.top + PAGE_CONFIG.paddingTop + hH
        const fallbackBottom = rect.top + PAGE_CONFIG.height - PAGE_CONFIG.paddingBottom - fH

        const top = padTop > 0 ? rect.top + padTop : fallbackTop
        const bottom = padBottom > 0 ? rect.bottom - padBottom : fallbackBottom
        return { top, bottom }
      }

      const getBodyBottomY = (pageEl: HTMLElement): number => getBodyBox(pageEl).bottom

      const findOverflowIndex = (pageEl: HTMLElement): number => {
        const { bottom: bodyBottomY } = getBodyBox(pageEl)
        const children = pageEl.children
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement
          if (child.getBoundingClientRect().bottom > bodyBottomY + 0.5) return i
        }
        return -1
      }

      const canPullBlock = (pageEl: HTMLElement, nextPageEl: HTMLElement): boolean => {
        const { top: bodyTopY, bottom: bodyBottomY } = getBodyBox(pageEl)

        // Current content bottom inside this page
        const children = pageEl.children
        let contentBottom = bodyTopY
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement
          const r = child.getBoundingClientRect()
          if (r.bottom > contentBottom) contentBottom = r.bottom
        }

        // Height of first block on next page
        const nextChildren = nextPageEl.children
        let firstBlockHeight = 0
        for (let i = 0; i < nextChildren.length; i++) {
          firstBlockHeight = (nextChildren[i] as HTMLElement).getBoundingClientRect().height
          break
        }
        if (firstBlockHeight === 0) return false

        // tiny buffer to avoid oscillation
        return contentBottom + firstBlockHeight <= bodyBottomY - 2
      }

      const findNextPageOffset = (doc: PMNode, pageType: NodeType, targetIndex: number): number => {
        let nextPageOffset = -1
        let scanIdx = 0
        doc.forEach((n, o) => {
          if (n.type === pageType) {
            if (scanIdx === targetIndex) nextPageOffset = o
            scanIdx++
          }
        })
        return nextPageOffset
      }

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
          if (!pageDom || !pageDom.classList.contains('pm-page')) {
            pageIndex++
            return
          }

          const overflowIdx = findOverflowIndex(pageDom)
          if (overflowIdx < 0) {
            pageIndex++
            return
          }

          const lastChildIdx = pageNode.childCount - 1
          if (lastChildIdx < 0) {
            pageIndex++
            return
          }

          if (pageNode.childCount <= 1 && overflowIdx === 0) {
            pageIndex++
            return
          }

          const overflowEl = pageDom.children[overflowIdx] as HTMLElement | null

          // ── Paragraph split (only if last block) ─────────────────────────
          if (
            overflowEl &&
            overflowEl.tagName.toLowerCase() === 'p' &&
            overflowIdx === lastChildIdx
          ) {
            const bodyBottomY = getBodyBottomY(pageDom)
            const elRect = overflowEl.getBoundingClientRect()
            const remaining = bodyBottomY - elRect.top

            if (remaining > 0) {
              const hit = view.posAtCoords({
                left: elRect.left + 5,
                top: bodyBottomY - 1,
              })

              if (hit) {
                const splitPos = snapToWordBoundary(view.state, hit.pos)
                const $pos = view.state.doc.resolve(splitPos)
                const docSize = view.state.doc.content.size

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

          // ── List overflow handler ──────────────────────────────────────────
          // If the last block on the page is a list (ol/ul) and ANY list item
          // overflows bodyBottom, split the list before that item and move the
          // tail to the next page — all in one transaction.
          if (
            overflowEl &&
            overflowIdx === lastChildIdx &&
            (overflowEl.tagName.toLowerCase() === 'ol' || overflowEl.tagName.toLowerCase() === 'ul')
          ) {
            const bodyBottomY = getBodyBottomY(pageDom)
            const liElements = overflowEl.querySelectorAll(':scope > li')

            // Find the first <li> whose bottom exceeds the page body
            let overflowLiIdx = -1
            for (let li = 0; li < liElements.length; li++) {
              if ((liElements[li] as HTMLElement).getBoundingClientRect().bottom > bodyBottomY + 0.5) {
                overflowLiIdx = li
                break
              }
            }

            if (overflowLiIdx === 0) {
              // First list item already overflows — fall through to whole-block move
            } else if (overflowLiIdx > 0) {
              // Split list before the overflowing <li> and move tail to next page
              try {
                const liEl = liElements[overflowLiIdx] as HTMLElement
                const liPosInside = view.posAtDOM(liEl, 0)
                const $li = view.state.doc.resolve(liPosInside)

                const schemaNodes = view.state.schema.nodes
                const listItemType = schemaNodes.listItem ?? schemaNodes.list_item
                const orderedListType = schemaNodes.orderedList ?? schemaNodes.ordered_list
                const bulletListType = schemaNodes.bulletList ?? schemaNodes.bullet_list

                let liDepth = -1
                for (let d = $li.depth; d >= 1; d--) {
                  if (listItemType && $li.node(d).type === listItemType) {
                    liDepth = d
                    break
                  }
                }

                if (liDepth >= 1) {
                  let listDepth = -1
                  for (let d = liDepth - 1; d >= 1; d--) {
                    const t = $li.node(d).type
                    if ((orderedListType && t === orderedListType) || (bulletListType && t === bulletListType)) {
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

                    // Preserve ordered-list start on the tail list
                    if (overflowEl.tagName.toLowerCase() === 'ol' && orderedListType && listDepth >= 1) {
                      const originalListNode = $li.node(listDepth)
                      const originalStart = (originalListNode.attrs?.start as number) ?? 1
                      const nextStart = originalStart + overflowLiIdx

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

                    // Move the tail list to the next page in the same transaction
                    const mappedPos = tr.mapping.map(splitPos, 1)
                    const $m = tr.doc.resolve(mappedPos)

                    let tailListDepth = -1
                    for (let d = $m.depth; d >= 1; d--) {
                      const nType = $m.node(d).type
                      if ((orderedListType && nType === orderedListType) || (bulletListType && nType === bulletListType)) {
                        tailListDepth = d
                        break
                      }
                    }

                    if (tailListDepth >= 1) {
                      const tailListNode = $m.node(tailListDepth)
                      const tailListPos = $m.before(tailListDepth)

                      // Delete tail list from current page
                      tr.delete(tailListPos, tailListPos + tailListNode.nodeSize)

                      // Find page boundaries in the updated tr.doc
                      const pt = tr.doc.type.schema.nodes.page
                      let currentPagePos = -1
                      let currentPageEnd = -1
                      let nextPagePos = -1

                      let scanIdx = 0
                      tr.doc.forEach((n, o) => {
                        if (n.type !== pt) return
                        if (scanIdx === pageIndex) {
                          currentPagePos = o
                          currentPageEnd = o + n.nodeSize
                        } else if (scanIdx === pageIndex + 1) {
                          nextPagePos = o
                        }
                        scanIdx++
                      })

                      if (currentPagePos >= 0) {
                        if (nextPagePos >= 0) {
                          tr.insert(nextPagePos + 1, tailListNode)
                        } else {
                          const newPage = pt.create(null, tailListNode)
                          tr.insert(currentPageEnd, newPage)
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
                // fall through to whole-block move
              }
            } else {
              // No individual <li> overflows — cleanup trailing empty <li> if present
              if (liElements.length > 1) {
                const lastLi = liElements[liElements.length - 1] as HTMLElement
                if (isEmptyListItemDom(lastLi)) {
                  try {
                    const liPosInside = view.posAtDOM(lastLi, 0)
                    const $li = view.state.doc.resolve(liPosInside)

                    const schemaNodes = view.state.schema.nodes
                    const listItemType = schemaNodes.listItem ?? schemaNodes.list_item

                    let liDepth = -1
                    for (let d = $li.depth; d >= 1; d--) {
                      if (listItemType && $li.node(d).type === listItemType) {
                        liDepth = d
                        break
                      }
                    }

                    if (liDepth >= 1) {
                      const from = $li.before(liDepth)
                      const to = from + $li.node(liDepth).nodeSize
                      const tr = view.state.tr.delete(from, to)
                      tr.setMeta(layoutMetaKey, true)
                      view.dispatch(tr)
                      moves++
                      didMutate = true
                      return
                    }
                  } catch {
                    // fall through
                  }
                }
              }
            }
          }

          // ── Fall through: move blocks to next page (guarantee progress) ─────
          lastSplitRef.current = null

          // If overflow occurs in the middle of the page, first peel off trailing blocks.
          // This makes the overflowing block eventually become the last child, which
          // allows paragraph/list splitting logic to apply cleanly and prevents thrash.
          const idxToMove = lastChildIdx

          const blockToMove = pageNode.child(idxToMove)

          // Compute absolute doc positions for the block we are moving
          let blockStart = pageOffset + 1
          for (let c = 0; c < idxToMove; c++) {
            blockStart += pageNode.child(c).nodeSize
          }
          const blockEnd = blockStart + blockToMove.nodeSize

          didMutate = moveBlockToNextPage(blockToMove, blockStart, blockEnd, pageOffset, pageNode, pageIndex)
          if (didMutate) moves++
          pageIndex++
        })
      }

      lastSplitRef.current = null

      // ── Phase 2: pull blocks back to fill pages ──────────────────────────
      didMutate = true
      while (didMutate && moves < MAX_MOVES) {
        didMutate = false
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page

        const pageOffsets: number[] = []
        doc.forEach((n, o) => {
          if (n.type === pageType) pageOffsets.push(o)
        })

        for (let i = 0; i < pageOffsets.length - 1; i++) {
          if (didMutate) break

          const pageOffset = pageOffsets[i]
          const nextOffset = pageOffsets[i + 1]
          const pageNode = doc.nodeAt(pageOffset)
          const nextNode = doc.nodeAt(nextOffset)
          if (!pageNode || !nextNode) continue

          const pageDom = view.nodeDOM(pageOffset) as HTMLElement | null
          const nextDom = view.nodeDOM(nextOffset) as HTMLElement | null
          if (!pageDom || !nextDom) continue
          if (!pageDom.classList.contains('pm-page') || !nextDom.classList.contains('pm-page')) continue

          if (!canPullBlock(pageDom, nextDom)) continue
          if (nextNode.childCount === 0) continue

          const firstBlock = nextNode.child(0)
          const from = nextOffset + 1
          const to = from + firstBlock.nodeSize
          const insertPos = pageOffset + pageNode.nodeSize - 1

          const tr = view.state.tr
          tr.delete(from, to)
          tr.insert(tr.mapping.map(insertPos), firstBlock)
          tr.setMeta(layoutMetaKey, true)
          view.dispatch(tr)

          didMutate = true
          moves++
        }
      }

      // ── Remove trailing empty pages ───────────────────────────────────
      // Pages that contain only empty paragraphs should be removed at the end.
      // Keep at least one page.
      //
      // NOTE: If we dispatch deletions, view.state.doc won't reflect them until after dispatch.
      // We compute pageCount from `nextDocForCount` which is `tr.doc` when we delete pages.
      let nextDocForCount: PMNode = view.state.doc

      {
        const { doc } = view.state
        const pageType = doc.type.schema.nodes.page

        const pageOffsets: number[] = []
        doc.forEach((n, o) => {
          if (n.type === pageType) pageOffsets.push(o)
        })

        let tr = view.state.tr
        let removed = 0

        // Remove only TRAILING empty pages (stop once a page has real content).
        for (let i = pageOffsets.length - 1; i >= 1; i--) {
          const off = pageOffsets[i]
          const pageNode = doc.nodeAt(off)
          if (!pageNode) continue

          if (!isEffectivelyEmptyPage(pageNode)) break

          tr = tr.delete(off, off + pageNode.nodeSize)
          removed++
        }

        if (removed > 0) {
          tr.setMeta(layoutMetaKey, true)
          view.dispatch(tr)
          nextDocForCount = tr.doc
        }
      }

      // ── Update page count ─────────────────────────────────────────────
      {
        const pageType = nextDocForCount.type.schema.nodes.page
        let count = 0
        nextDocForCount.forEach((n) => {
          if (n.type === pageType) count++
        })
        setPageCount(Math.max(1, count))
      }
    } finally {
      isLayingOutRef.current = false
    }
  }, [editor, hfHeights])

  const schedule = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(measure)
  }, [measure])

  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const onUpdate = ({ transaction }: { transaction: any }) => {
      if (transaction?.getMeta?.(layoutMetaKey)) return
      schedule()
    }

    editor.on('update', onUpdate as any)
    window.addEventListener('resize', schedule)

    // initial
    schedule()

    return () => {
      editor.off('update', onUpdate as any)
      window.removeEventListener('resize', schedule)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [editor, schedule])

  return { pageCount }
}