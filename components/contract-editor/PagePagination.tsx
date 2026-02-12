'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { A4_CONTENT_HEIGHT, A4_PAGE_HEIGHT, A4_PADDING_PX, PAGE_GAP } from '@/lib/constants/page'
import type { PageBreakInfo } from './extensions/pagination-spacers'
import type { Editor } from '@tiptap/core'

/** Bottom padding of current page + gap + top padding of next page */
const BASE_SPACER = A4_PADDING_PX + PAGE_GAP + A4_PADDING_PX // 83 + 40 + 83 = 206

interface PagePaginationProps {
  editor: Editor | null
  children: React.ReactNode
}

/**
 * PagePagination Component
 *
 * Measures editor content, calculates where page breaks occur, and:
 * 1. Feeds break positions to the PaginationSpacers extension (which injects
 *    widget-decoration spacers so content flows around page gaps)
 * 2. Renders white page cards + gray gaps as a background overlay
 * 3. Applies clip-path on the editor container to hide content in gap areas
 *
 * Spacer height is variable per break: it fills the remaining space on the
 * current page + gap + next page's top padding. This keeps the fixed-position
 * page cards perfectly aligned with the actual content.
 */
export function PagePagination({ editor, children }: PagePaginationProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)

  /**
   * Apply clip-path with evenodd fill rule to create rectangular "windows"
   * for each page. Content in gap areas is clipped out completely.
   * 
   * CRITICAL: Clip-path coordinates are relative to the element it's applied to.
   * We need to align the clip-path rectangles with the actual page boundary positions.
   */
  const applyClipPath = useCallback((pages: number) => {
    const container = containerRef.current
    const wrapper = wrapperRef.current
    if (!container || !wrapper) return

    if (pages <= 1) {
      container.style.clipPath = 'none'
      // @ts-ignore - webkitClipPath for Safari support
      container.style.webkitClipPath = 'none'
      return
    }

    // Get actual positions of container and page boundaries overlay
    const containerRect = container.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    
    // Find the page boundaries overlay element
    const overlayEl = wrapper.querySelector('.page-boundaries-overlay') as HTMLElement
    if (!overlayEl) {
      console.warn('Page boundaries overlay not found')
      return
    }
    
    const overlayRect = overlayEl.getBoundingClientRect()
    
    // Calculate the offset: where does the container start relative to the overlay?
    // The overlay has top: 20px relative to wrapper
    // The container is a direct child of wrapper, so it should also start at ~20px
    // But we measure to be precise
    const containerTopRelativeToWrapper = containerRect.top - wrapperRect.top
    const overlayTopRelativeToWrapper = overlayRect.top - wrapperRect.top
    
    // The clip-path coordinates are relative to the container
    // So we need: clipPathTop = (overlayTop - containerTop) + pageOffset
    const baseOffset = overlayTopRelativeToWrapper - containerTopRelativeToWrapper
    
    // Build SVG path with one rectangle per page
    // Each rectangle creates a "window" where content is visible
    // The evenodd fill rule makes overlapping rectangles work correctly
    const rects: string[] = []
    for (let i = 0; i < pages; i++) {
      // Page boundaries are positioned at: overlayTop + i * (A4_PAGE_HEIGHT + PAGE_GAP)
      // Relative to container: baseOffset + i * (A4_PAGE_HEIGHT + PAGE_GAP)
      const pageTop = baseOffset + i * (A4_PAGE_HEIGHT + PAGE_GAP)
      const pageBottom = pageTop + A4_PAGE_HEIGHT
      
      // Create rectangle: Move to (0, top), Horizontal line to right edge, Vertical line to bottom, Horizontal line back, Close path
      rects.push(`M 0 ${pageTop} H 9999 V ${pageBottom} H 0 Z`)
    }

    const clipPathValue = `path(evenodd, "${rects.join(' ')}")`
    container.style.clipPath = clipPathValue
    // @ts-ignore - webkitClipPath for Safari support
    container.style.webkitClipPath = clipPathValue
    
    // Debug: log the clip-path for troubleshooting
    if (process.env.NODE_ENV === 'development') {
      console.log('Clip-path applied:', {
        pages,
        baseOffset,
        clipPathValue,
        containerTop: containerRect.top - wrapperRect.top,
        overlayTop: overlayTopRelativeToWrapper,
      })
    }
  }, [])

  const calculateBreaks = useCallback(() => {
    if (!editor || !wrapperRef.current) return

    const proseMirrorEl = wrapperRef.current.querySelector('.ProseMirror') as HTMLElement
    if (!proseMirrorEl) return

    const breakInfos: PageBreakInfo[] = []
    const proseMirrorRect = proseMirrorEl.getBoundingClientRect()
    const paddingTop = A4_PADDING_PX // 83px (22mm)

    let cumulativeSpacerHeight = 0
    let currentPageStart = 0

    const childElements = Array.from(proseMirrorEl.children) as HTMLElement[]

    for (const child of childElements) {
      // Track spacer heights but skip them for break calculation
      if (child.classList.contains('pagination-spacer')) {
        cumulativeSpacerHeight += child.getBoundingClientRect().height
        continue
      }

      // Use the element's actual rendered position (includes margins)
      const childRect = child.getBoundingClientRect()
      const contentBottom = childRect.bottom - proseMirrorRect.top - paddingTop - cumulativeSpacerHeight
      const bottomOnPage = contentBottom - currentPageStart

      if (bottomOnPage > A4_CONTENT_HEIGHT && currentPageStart < contentBottom) {
        // This node overflows the current page — break before it
        const contentTop = childRect.top - proseMirrorRect.top - paddingTop - cumulativeSpacerHeight
        const topOnPage = contentTop - currentPageStart

        try {
          const domPos = editor.view.posAtDOM(child, 0)
          const resolved = editor.state.doc.resolve(domPos)
          const pos = resolved.before(1) // position before the top-level block node

          // Fill remaining page space + gap + next page top padding
          const spacerHeight = (A4_CONTENT_HEIGHT - topOnPage) + BASE_SPACER

          breakInfos.push({ pos, spacerHeight })

          // The new page starts after the content consumed so far
          currentPageStart = contentTop
          cumulativeSpacerHeight += spacerHeight
        } catch {
          // If position resolution fails, just continue
        }
      }
    }

    // Update page count (always needed for visual rendering)
    const newPageCount = Math.max(1, breakInfos.length + 1)
    setPageCount(newPageCount)

    // Apply clip-path to editor container to hide content in gap areas
    applyClipPath(newPageCount)

    // Only update storage if extension is initialized (prevents infinite loop)
    if (!editor.storage.paginationSpacers) {
      return
    }

    const current = editor.storage.paginationSpacers.breakInfos as PageBreakInfo[] | undefined
    const newJson = JSON.stringify(breakInfos)
    const oldJson = JSON.stringify(current || [])

    if (newJson !== oldJson) {
      editor.storage.paginationSpacers.breakInfos = breakInfos
      // Trigger ProseMirror to re-read decorations
      editor.view.dispatch(editor.state.tr.setMeta('paginationSpacersUpdate', true))
    }
  }, [editor, applyClipPath])

  useEffect(() => {
    if (!editor || !wrapperRef.current) return

    const proseMirrorEl = wrapperRef.current.querySelector('.ProseMirror') as HTMLElement
    if (!proseMirrorEl) return

    // Initial calculation (delay for DOM to settle)
    const initTimeout = setTimeout(calculateBreaks, 150)

    // Recalculate on resize
    const resizeObserver = new ResizeObserver(() => {
      calculateBreaks()
    })
    resizeObserver.observe(proseMirrorEl)

    // Recalculate on editor content changes
    const handleUpdate = () => setTimeout(calculateBreaks, 50)
    editor.on('update', handleUpdate)

    return () => {
      clearTimeout(initTimeout)
      resizeObserver.disconnect()
      editor.off('update', handleUpdate)
    }
  }, [editor, calculateBreaks])

  // Total height: all page cards + gaps between them + wrapper padding
  const totalHeight =
    pageCount * A4_PAGE_HEIGHT +
    (pageCount - 1) * PAGE_GAP +
    40 // 20px top + 20px bottom wrapper padding

  return (
    <div
      ref={wrapperRef}
      className="page-content-wrapper"
      data-page-count={pageCount}
      style={{ minHeight: `${totalHeight}px` }}
    >
      {/* Page cards overlay (behind editor content) */}
      <div className="page-boundaries-overlay">
        {Array.from({ length: pageCount }).map((_, i) => {
          const pageTop = i * (A4_PAGE_HEIGHT + PAGE_GAP)

          return (
            <div
              key={i}
              className="page-boundary"
              style={{
                top: `${pageTop}px`,
                height: `${A4_PAGE_HEIGHT}px`,
              }}
            >
              <div className="page-number-indicator">
                Page {i + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor content - above page cards, clip-path hides gap overflow */}
      <div ref={containerRef} className="editor-content-container">
        {children}
      </div>
    </div>
  )
}
