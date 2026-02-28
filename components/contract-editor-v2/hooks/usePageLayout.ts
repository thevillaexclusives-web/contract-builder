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
  const overflowedPagesRef = useRef(new Set<number>())
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

        // Margin-bottom of the last child on the current page
        let lastChildMarginBottom = 0
        if (children.length > 0) {
          const lastChild = children[children.length - 1] as HTMLElement
          lastChildMarginBottom = Number.parseFloat(window.getComputedStyle(lastChild).marginBottom || '0') || 0
        }

        // Height + margin-top of first block on next page
        const nextChildren = nextPageEl.children
        let firstBlockHeight = 0
        let firstBlockMarginTop = 0
        for (let i = 0; i < nextChildren.length; i++) {
          const el = nextChildren[i] as HTMLElement
          firstBlockHeight = el.getBoundingClientRect().height
          firstBlockMarginTop = Number.parseFloat(window.getComputedStyle(el).marginTop || '0') || 0
          break
        }
        if (firstBlockHeight === 0) return false

        // CSS margin collapsing: the gap between adjacent blocks =
        // max(lastChild.marginBottom, newBlock.marginTop).
        // getBoundingClientRect doesn't include margins, so we must add this gap.
        const marginGap = Math.max(lastChildMarginBottom, firstBlockMarginTop)

        return contentBottom + marginGap + firstBlockHeight <= bodyBottomY - 2
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

      // ── Renumber ordered lists ─────────────────────────────────────────
      // Each numbered section (I, II, III…) is a separate OL node with its
      // own `start` attribute.  When items are added/removed, subsequent OLs
      // need their `start` recalculated so numbering stays continuous.
      {
        const { doc } = view.state
        const schemaNodes = view.state.schema.nodes
        const orderedListType = schemaNodes.orderedList ?? schemaNodes.ordered_list
        const pageType = doc.type.schema.nodes.page

        if (orderedListType) {
          // Collect all top-level OLs across pages, grouped by listStyleType
          const olsByStyle = new Map<string, Array<{ pos: number; node: PMNode }>>()

          doc.forEach((pageNode, pageOffset) => {
            if (pageNode.type !== pageType) return
            let offset = pageOffset + 1
            for (let i = 0; i < pageNode.childCount; i++) {
              const child = pageNode.child(i)
              if (child.type === orderedListType && !child.attrs?.continuation) {
                const style = (child.attrs?.listStyleType as string) || 'decimal'
                if (!olsByStyle.has(style)) olsByStyle.set(style, [])
                olsByStyle.get(style)!.push({ pos: offset, node: child })
              }
              offset += child.nodeSize
            }
          })

          // For each style group, fix start values where they diverge
          let tr = view.state.tr
          let needsDispatch = false

          for (const [, ols] of olsByStyle) {
            if (ols.length <= 1) continue

            // The first OL's start is the anchor for the sequence
            let expectedStart = (ols[0].node.attrs?.start as number) ?? 1
            expectedStart += ols[0].node.childCount

            for (let i = 1; i < ols.length; i++) {
              const { pos, node } = ols[i]
              const currentStart = (node.attrs?.start as number) ?? 1

              if (currentStart !== expectedStart) {
                tr.setNodeMarkup(tr.mapping.map(pos), undefined, {
                  ...node.attrs,
                  start: expectedStart,
                })
                needsDispatch = true
              }

              expectedStart += node.childCount
            }
          }

          if (needsDispatch) {
            tr.setMeta(layoutMetaKey, true)
            view.dispatch(tr)
          }
        }
      }

      // ── Phase 1: push overflowing blocks forward ─────────────────────────
      let moves = 0
      let didMutate = true
      // Note: overflowedPagesRef is NOT cleared here — it persists across
      // measure() calls to prevent Phase 2 from undoing Phase 1's pushes.
      // It is cleared only on user edits (in the onUpdate handler).

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
            // Allow lists through — they can be split even as the sole block
            const tag0 = (pageDom.children[0] as HTMLElement | null)?.tagName?.toLowerCase()
            if (tag0 !== 'ol' && tag0 !== 'ul') {
              pageIndex++
              return
            }
          }

          const overflowEl = pageDom.children[overflowIdx] as HTMLElement | null

          // DEBUG: overflow diagnostics
          console.log('[layout] page', pageIndex, 'overflowIdx', overflowIdx, 'lastChildIdx', lastChildIdx,
            'overflowTag', overflowEl?.tagName,
            'children:', Array.from(pageDom.children).map(c => (c as HTMLElement).tagName))

          // ── Delete trailing empty P after a list ────────────────────────
          // When the user presses Enter at the end of a list, TipTap may
          // create a trailing empty <p> after the list.  If that <p> is what
          // overflows, the list handler never fires (it checks for OL/UL).
          // Delete the empty <p> so the next layout tick sees the list as the
          // overflowing block and paginates it properly.
          if (overflowEl && overflowEl.tagName.toLowerCase() === 'p') {
            const isEmptyP = (overflowEl.textContent || '').replace(/\u00a0/g, '').trim().length === 0
            const prevSib = overflowEl.previousElementSibling as HTMLElement | null
            const prevTag = prevSib?.tagName?.toLowerCase()

            console.log('[layout] trailing-P check:', { isEmptyP, prevTag, overflowIdx, lastChildIdx,
              textContent: JSON.stringify((overflowEl.textContent || '').slice(0, 50)) })

            if (isEmptyP && prevSib && (prevTag === 'ol' || prevTag === 'ul')) {
              try {
                const pPos = view.posAtDOM(overflowEl, 0)
                const $p = view.state.doc.resolve(pPos)

                console.log('[layout] trailing-P posAtDOM=', pPos, '$p.depth=', $p.depth,
                  'nodes:', Array.from({ length: $p.depth + 1 }, (_, i) => $p.node(i).type.name))

                // Find the paragraph node depth (direct child of page)
                let pDepth = -1
                for (let d = $p.depth; d >= 1; d--) {
                  if ($p.node(d).type.name === 'paragraph') {
                    pDepth = d
                    break
                  }
                }

                console.log('[layout] trailing-P pDepth=', pDepth)

                if (pDepth >= 1) {
                  const from = $p.before(pDepth)
                  const to = from + $p.node(pDepth).nodeSize
                  console.log('[layout] DELETING trailing-P from=', from, 'to=', to)
                  const tr = view.state.tr.delete(from, to)
                  tr.setMeta(layoutMetaKey, true)
                  view.dispatch(tr)
                  moves++
                  didMutate = true
                  return
                }
              } catch (e) {
                console.log('[layout] trailing-P error:', e)
                // fall through
              }
            }
          }

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
          const isOverflowList = overflowEl &&
            (overflowEl.tagName.toLowerCase() === 'ol' || overflowEl.tagName.toLowerCase() === 'ul')

          console.log('[layout] LIST-GATE: isOverflowList=', isOverflowList,
            'overflowIdx=', overflowIdx, 'lastChildIdx=', lastChildIdx,
            'overflowIdx===lastChildIdx=', overflowIdx === lastChildIdx,
            'overflowTag=', overflowEl?.tagName,
            'lastChildTag=', (pageDom.children[lastChildIdx] as HTMLElement)?.tagName)

          if (
            isOverflowList &&
            overflowIdx === lastChildIdx
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

            console.log('[layout] LIST handler entered. tag=', overflowEl.tagName,
              'liCount=', liElements.length, 'overflowLiIdx=', overflowLiIdx,
              'bodyBottomY=', bodyBottomY,
              'liBots=', Array.from(liElements).map((li, i) => ({ i, bot: (li as HTMLElement).getBoundingClientRect().bottom })))

            if (overflowLiIdx === 0) {
              // First list item overflows. Check if part of it is visible —
              // if so, try to split inside it at a nested list or block boundary.
              const firstLiEl = liElements[0] as HTMLElement
              const firstLiRect = firstLiEl.getBoundingClientRect()

              console.log('[layout] NESTED-SPLIT: overflowLiIdx=0. firstLiRect.top=', firstLiRect.top,
                'bodyBottomY=', bodyBottomY, 'gap=', bodyBottomY - firstLiRect.top,
                'threshold(20)=', firstLiRect.top < bodyBottomY - 20)

              // DEBUG: log the DOM structure inside the first LI
              console.log('[layout] NESTED-SPLIT: firstLi children:', Array.from(firstLiEl.children).map(c => ({
                tag: (c as HTMLElement).tagName,
                text: (c as HTMLElement).textContent?.slice(0, 60) || '[empty]',
                bottom: (c as HTMLElement).getBoundingClientRect().bottom,
              })))

              if (firstLiRect.top < bodyBottomY - 20) {
                let nestedSplitDone = false

                // ── Strategy 1: Split at a nested <li> boundary ──────────────
                const nestedLis = firstLiEl.querySelectorAll('li')

                console.log('[layout] NESTED-SPLIT: strategy1 nestedLis.length=', nestedLis.length)

                if (nestedLis.length > 0) {
                  let overflowNestedEl: HTMLElement | null = null
                  let overflowNestedIdx = -1

                  for (let n = 0; n < nestedLis.length; n++) {
                    const nel = nestedLis[n] as HTMLElement
                    if (nel.getBoundingClientRect().bottom > bodyBottomY + 0.5) {
                      overflowNestedEl = nel
                      overflowNestedIdx = n
                      break
                    }
                  }

                  if (overflowNestedEl && overflowNestedIdx > 0) {
                    try {
                      const schemaNodes = view.state.schema.nodes
                      const listItemType = schemaNodes.listItem ?? schemaNodes.list_item
                      const orderedListType = schemaNodes.orderedList ?? schemaNodes.ordered_list
                      const bulletListType = schemaNodes.bulletList ?? schemaNodes.bullet_list

                      const nestedLiPos = view.posAtDOM(overflowNestedEl, 0)
                      const $nested = view.state.doc.resolve(nestedLiPos)

                      let outerOlDepth = -1
                      for (let d = $nested.depth; d >= 1; d--) {
                        const nt = $nested.node(d).type
                        if ((orderedListType && nt === orderedListType) || (bulletListType && nt === bulletListType)) {
                          outerOlDepth = d
                        }
                      }

                      if (outerOlDepth >= 1) {
                        const outerLiDepth = outerOlDepth + 1
                        let nestedLiDepth = -1
                        for (let d = $nested.depth; d > outerLiDepth; d--) {
                          if (listItemType && $nested.node(d).type === listItemType) {
                            nestedLiDepth = d
                            break
                          }
                        }

                        if (nestedLiDepth >= 1) {
                          const splitPos = $nested.before(nestedLiDepth)
                          const splitDepth = nestedLiDepth - outerLiDepth
                          const docSize = view.state.doc.content.size

                          if (
                            splitDepth > 0 &&
                            canSplit(view.state.doc, splitPos, splitDepth) &&
                            (!lastSplitRef.current ||
                              lastSplitRef.current.pos !== splitPos ||
                              lastSplitRef.current.docSize !== docSize)
                          ) {
                            lastSplitRef.current = { pos: splitPos, docSize }
                            const tr = view.state.tr.split(splitPos, splitDepth)
                            tr.setMeta(layoutMetaKey, true)
                            console.log('[layout] NESTED-SPLIT: strategy1 DISPATCHING split at nested li!')
                            view.dispatch(tr)
                            moves++
                            didMutate = true
                            nestedSplitDone = true
                          }
                        }
                      }
                    } catch (e) {
                      console.log('[layout] NESTED-SPLIT: strategy1 error:', e)
                    }
                  }
                }

                // ── Strategy 2: Split at a block child boundary inside the LI ──
                // Finds the first direct child of the LI whose bottom overflows.
                // If canSplit works (child is a paragraph), uses tr.split.
                // If canSplit fails (child is a list — LI schema requires paragraph
                // first), falls through to Strategy 3 which manually constructs the
                // split by extracting overflowing items from the inner list and
                // creating a second outer LI.
                if (!nestedSplitDone) {
                  const liChildren = firstLiEl.children
                  let overflowChildEl: HTMLElement | null = null
                  let overflowChildIdx = -1

                  for (let c = 0; c < liChildren.length; c++) {
                    const child = liChildren[c] as HTMLElement
                    if (child.getBoundingClientRect().bottom > bodyBottomY + 0.5) {
                      overflowChildEl = child
                      overflowChildIdx = c
                      break
                    }
                  }

                  console.log('[layout] NESTED-SPLIT: strategy2 overflowChildIdx=', overflowChildIdx,
                    'totalChildren=', liChildren.length,
                    'overflowChildTag=', overflowChildEl?.tagName)

                  if (overflowChildEl && overflowChildIdx > 0) {
                    try {
                      const childPos = view.posAtDOM(overflowChildEl, 0)
                      const $child = view.state.doc.resolve(childPos)

                      console.log('[layout] NESTED-SPLIT: strategy2 posAtDOM=', childPos,
                        '$child.depth=', $child.depth,
                        'ancestry:', Array.from({ length: $child.depth + 1 }, (_, i) => ({
                          d: i,
                          type: $child.node(i).type.name,
                        })))

                      const schemaNodes = view.state.schema.nodes
                      const listItemType = schemaNodes.listItem ?? schemaNodes.list_item

                      let liDepth = -1
                      for (let d = $child.depth; d >= 1; d--) {
                        if (listItemType && $child.node(d).type === listItemType) {
                          liDepth = d
                          break
                        }
                      }

                      if (liDepth >= 1) {
                        const blockDepth = liDepth + 1
                        if (blockDepth <= $child.depth) {
                          const splitPos = $child.before(blockDepth)
                          const docSize = view.state.doc.content.size
                          const canDoSplit = canSplit(view.state.doc, splitPos, 1)
                          const lastSplitBlocking = lastSplitRef.current &&
                            lastSplitRef.current.pos === splitPos &&
                            lastSplitRef.current.docSize === docSize

                          console.log('[layout] NESTED-SPLIT: strategy2 splitPos=', splitPos,
                            'canSplit=', canDoSplit, 'lastSplitBlocking=', lastSplitBlocking)

                          if (canDoSplit && !lastSplitBlocking) {
                            lastSplitRef.current = { pos: splitPos, docSize }
                            const tr = view.state.tr.split(splitPos, 1)
                            tr.setMeta(layoutMetaKey, true)
                            console.log('[layout] NESTED-SPLIT: strategy2 DISPATCHING split!')
                            view.dispatch(tr)
                            moves++
                            didMutate = true
                            nestedSplitDone = true
                          }

                          // ── Strategy 3: manual split + move when canSplit fails ──
                          // canSplit returns false because ListItem's content spec
                          // is "paragraph block*" — a LI must start with a <p>.
                          // When the overflowing child is an inner OL/UL, we:
                          //   1. Find which inner <li> overflows
                          //   2. Delete the overflowing items from the inner OL
                          //   3. Wrap the tail in a proper nested structure:
                          //      outerOL[continuation] > LI > [empty P, innerOL]
                          //   4. Move the wrapper to the next page
                          // The wrapper preserves the parent list hierarchy so
                          // TipTap's "lift on empty Enter" still works (the user
                          // can press Enter on an empty sub-item to create the
                          // next main section, e.g. XVIII).
                          if (!nestedSplitDone && !canDoSplit) {
                            const overflowChildTag = overflowChildEl.tagName.toLowerCase()

                            if (overflowChildTag === 'ol' || overflowChildTag === 'ul') {
                              const innerLiEls = overflowChildEl.querySelectorAll(':scope > li')
                              let innerOverflowIdx = -1

                              for (let n = 0; n < innerLiEls.length; n++) {
                                if ((innerLiEls[n] as HTMLElement).getBoundingClientRect().bottom > bodyBottomY + 0.5) {
                                  innerOverflowIdx = n
                                  break
                                }
                              }

                              console.log('[layout] NESTED-SPLIT: strategy3 innerLiEls=', innerLiEls.length,
                                'innerOverflowIdx=', innerOverflowIdx)

                              if (innerOverflowIdx > 0) {
                                const innerOlNode = $child.node($child.depth)
                                const innerOlPos = $child.before($child.depth)

                                // Collect overflowing LI nodes
                                const tailLis: PMNode[] = []
                                for (let i = innerOverflowIdx; i < innerOlNode.childCount; i++) {
                                  tailLis.push(innerOlNode.child(i))
                                }

                                // Create inner continuation OL (same style, correct start, NO continuation flag)
                                const innerStart = (innerOlNode.attrs?.start as number) ?? 1
                                const innerContinuationOl = innerOlNode.type.create(
                                  { ...innerOlNode.attrs, start: innerStart + innerOverflowIdx },
                                  tailLis
                                )

                                // Get outer OL info to create the wrapper structure
                                const outerOlDepth = liDepth - 1
                                const outerOlNode = $child.node(outerOlDepth)
                                const paragraphType = view.state.schema.nodes.paragraph

                                // Build wrapper: outerOL[continuation] > LI > [empty P, inner OL]
                                // The empty P is required by ListItem's schema ("paragraph block*").
                                // CSS collapses it to zero height so it's invisible.
                                const emptyP = paragraphType.create()
                                const wrapperLi = listItemType!.create(null, [emptyP, innerContinuationOl])
                                const wrapperOl = outerOlNode.type.create(
                                  { ...outerOlNode.attrs, continuation: true },
                                  [wrapperLi]
                                )

                                // Delete range: overflowing inner LIs
                                let deleteFrom = innerOlPos + 1
                                for (let i = 0; i < innerOverflowIdx; i++) {
                                  deleteFrom += innerOlNode.child(i).nodeSize
                                }
                                const deleteTo = innerOlPos + innerOlNode.nodeSize - 1

                                console.log('[layout] NESTED-SPLIT: strategy3 innerOlPos=', innerOlPos,
                                  'deleteFrom=', deleteFrom, 'deleteTo=', deleteTo,
                                  'tailLis=', tailLis.length,
                                  'newStart=', innerStart + innerOverflowIdx,
                                  'outerOlStart=', outerOlNode.attrs?.start,
                                  'outerOlStyle=', outerOlNode.attrs?.listStyleType)

                                const tr = view.state.tr

                                // Step 1: Delete the overflowing LIs from the inner OL
                                tr.delete(deleteFrom, deleteTo)

                                // Step 2: Move the wrapper OL to the next page
                                const pt = tr.doc.type.schema.nodes.page
                                let currentPageEnd = -1
                                let nextPagePos = -1
                                let scanIdx = 0
                                tr.doc.forEach((n, o) => {
                                  if (n.type !== pt) return
                                  if (scanIdx === pageIndex) {
                                    currentPageEnd = o + n.nodeSize
                                  } else if (scanIdx === pageIndex + 1) {
                                    nextPagePos = o
                                  }
                                  scanIdx++
                                })

                                if (nextPagePos >= 0) {
                                  console.log('[layout] NESTED-SPLIT: strategy3 inserting wrapper into next page at', nextPagePos + 1)
                                  tr.insert(nextPagePos + 1, wrapperOl)
                                } else {
                                  console.log('[layout] NESTED-SPLIT: strategy3 creating new page with wrapper at', currentPageEnd)
                                  const newPage = pt.create(null, wrapperOl)
                                  tr.insert(currentPageEnd, newPage)
                                }

                                tr.setMeta(layoutMetaKey, true)
                                console.log('[layout] NESTED-SPLIT: strategy3 DISPATCHING!')
                                view.dispatch(tr)
                                moves++
                                didMutate = true
                                nestedSplitDone = true
                                overflowedPagesRef.current.add(pageIndex)
                              } else if (innerOverflowIdx === 0) {
                                console.log('[layout] NESTED-SPLIT: strategy3 first inner li overflows, cannot split')
                              }
                            }
                          }
                        }
                      }
                    } catch (e) {
                      console.log('[layout] NESTED-SPLIT: strategy2/3 error:', e)
                    }
                  }
                }

                if (nestedSplitDone) {
                  return
                }
              } else {
                console.log('[layout] NESTED-SPLIT: first li NOT partially visible (top too close to bodyBottom)')
              }

              console.log('[layout] LIST: first li overflows, falling through to whole-block move')
              // Fall through to whole-block move
            } else if (overflowLiIdx > 0) {
              console.log('[layout] LIST: splitting before li', overflowLiIdx, 'and moving tail')
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

                      console.log('[layout] OL numbering: originalStart=', originalStart,
                        'overflowLiIdx=', overflowLiIdx, 'nextStart=', nextStart,
                        'liDepth=', liDepth, 'listDepth=', listDepth,
                        'splitPos=', splitPos)
                      console.log('[layout] OL li items before split:',
                        Array.from(liElements).map((li, i) => ({
                          i,
                          text: (li as HTMLElement).textContent?.slice(0, 40) || '[empty]',
                        })))

                      const mapped = tr.mapping.map(splitPos, 1)
                      const $mapped = tr.doc.resolve(mapped)

                      console.log('[layout] OL mapped pos=', mapped, '$mapped.depth=', $mapped.depth,
                        'nodes:', Array.from({ length: $mapped.depth + 1 }, (_, i) => $mapped.node(i).type.name))

                      let setMarkupDone = false
                      for (let d = $mapped.depth; d >= 1; d--) {
                        if ($mapped.node(d).type === orderedListType) {
                          const targetPos = $mapped.before(d)
                          const targetNode = $mapped.node(d)
                          console.log('[layout] OL setNodeMarkup at depth=', d, 'pos=', targetPos,
                            'currentAttrs=', JSON.stringify(targetNode.attrs),
                            'newStart=', nextStart,
                            'tailChildCount=', targetNode.childCount)
                          tr.setNodeMarkup(targetPos, undefined, {
                            ...targetNode.attrs,
                            start: nextStart,
                          })
                          setMarkupDone = true
                          break
                        }
                      }
                      if (!setMarkupDone) {
                        console.log('[layout] OL WARNING: could not find orderedList in $mapped ancestry!')
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

                      console.log('[layout] MOVE tail: tailListDepth=', tailListDepth,
                        'tailListPos=', tailListPos,
                        'tailListNode.type=', tailListNode.type.name,
                        'tailListNode.attrs=', JSON.stringify(tailListNode.attrs),
                        'tailListNode.childCount=', tailListNode.childCount,
                        'tailItems=', Array.from({ length: tailListNode.childCount }, (_, i) => {
                          const child = tailListNode.child(i)
                          return { i, type: child.type.name, text: child.textContent?.slice(0, 40) || '[empty]' }
                        }))

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
                          console.log('[layout] INSERT tail into existing next page at pos=', nextPagePos + 1)
                          tr.insert(nextPagePos + 1, tailListNode)
                        } else {
                          console.log('[layout] INSERT tail into NEW page at pos=', currentPageEnd)
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

          // If the list is the sole block and couldn't be split (overflowLiIdx was 0
          // or split failed), don't fall through to whole-block move — that would
          // move the same list to a new page where it overflows again → infinite loop.
          if (pageNode.childCount <= 1 && overflowIdx === 0) {
            console.log('[layout] single-block list could not be split, skipping page', pageIndex)
            pageIndex++
            return
          }

          // ── Fall through: move blocks to next page (guarantee progress) ─────
          lastSplitRef.current = null

          console.log('[layout] FALLBACK whole-block move. Moving child', lastChildIdx,
            'type=', pageNode.child(lastChildIdx).type.name,
            'overflowIdx=', overflowIdx, 'overflowTag=', overflowEl?.tagName)

          // DEBUG: Log start attrs for ALL OL children on this page
          console.log('[layout] FALLBACK page OL starts:',
            JSON.stringify(Array.from({ length: pageNode.childCount }, (_, i) => {
              const child = pageNode.child(i)
              return {
                i,
                type: child.type.name,
                start: child.attrs?.start,
                listStyleType: child.attrs?.listStyleType,
                childCount: child.childCount,
                text: child.textContent?.slice(0, 50) || '[empty]',
              }
            })))

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
          if (didMutate) {
            moves++
            overflowedPagesRef.current.add(pageIndex)
          }
          pageIndex++
        })
      }

      console.log('[layout] Phase1 done. moves=', moves)
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

          // Skip pages that pushed blocks out in Phase 1 — pulling back
          // to these pages would undo the push and cause oscillation.
          if (overflowedPagesRef.current.has(i)) continue

          if (!canPullBlock(pageDom, nextDom)) continue
          if (nextNode.childCount === 0) continue

          const firstBlock = nextNode.child(0)
          const from = nextOffset + 1
          const to = from + firstBlock.nodeSize
          const insertPos = pageOffset + pageNode.nodeSize - 1

          console.log('[layout] Phase2 PULL block from page', i + 1, 'to page', i,
            'type=', firstBlock.type.name, 'start=', firstBlock.attrs?.start,
            'text=', firstBlock.textContent?.slice(0, 50))

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
      // User edit — clear overflow tracking so Phase 2 can make fresh decisions
      overflowedPagesRef.current.clear()
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