import React, { useMemo } from 'react'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG, contentTopOffset } from '../config/pageConfig'
import { PagesOverlay } from './PagesOverlay'

interface EditorShellProps {
  editor: Editor
  pageCount: number
  pageBreakOffsets: number[]
}

export function EditorShell({ editor, pageCount, pageBreakOffsets }: EditorShellProps) {
  const minHeight = useMemo(
    () => pageCount * PAGE_CONFIG.height + (pageCount - 1) * PAGE_CONFIG.gap,
    [pageCount]
  )

  // Build clip-path to reveal only the content areas (hide header, footer, gaps)
  const clipPath = useMemo(() => {
    const rects: string[] = []

    for (let i = 0; i < pageCount; i++) {
      const pageTop = i * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
      // Content area starts after paddingTop + headerHeight
      const contentTop = pageTop + contentTopOffset
      // Content area ends before footerHeight + paddingBottom
      const contentBottom =
        pageTop + PAGE_CONFIG.height - PAGE_CONFIG.footerHeight - PAGE_CONFIG.paddingBottom

      const top = contentTop
      const bottom = minHeight - contentBottom
      const left = 0
      const right = 0

      // inset(top right bottom left)
      rects.push(
        `inset(${top}px ${right}px ${bottom}px ${left}px)`
      )
    }

    // Union of all content area rects using polygon instead
    // Actually, CSS clip-path doesn't support union of insets.
    // We'll use a polygon that covers all content zones.
    const points: string[] = []

    for (let i = 0; i < pageCount; i++) {
      const pageTop = i * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
      const contentTop = pageTop + contentTopOffset
      const contentBottom =
        pageTop + PAGE_CONFIG.height - PAGE_CONFIG.footerHeight - PAGE_CONFIG.paddingBottom

      // Left edge down, right edge up for each content zone
      points.push(`0% ${contentTop}px`)
      points.push(`100% ${contentTop}px`)
      points.push(`100% ${contentBottom}px`)
      points.push(`0% ${contentBottom}px`)

      // If not last page, add a zero-width bridge to next content zone
      if (i < pageCount - 1) {
        const nextContentTop =
          (i + 1) * (PAGE_CONFIG.height + PAGE_CONFIG.gap) + contentTopOffset
        points.push(`0% ${nextContentTop}px`)
      }
    }

    if (points.length === 0) return 'none'

    // Build a polygon that traces each content zone
    // We need to go right along top, down on right, left along bottom, up on left for each zone
    const polygonPoints: string[] = []

    for (let i = 0; i < pageCount; i++) {
      const pageTop = i * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
      const contentTop = pageTop + contentTopOffset
      const contentBottom =
        pageTop + PAGE_CONFIG.height - PAGE_CONFIG.footerHeight - PAGE_CONFIG.paddingBottom

      // Top-left of content zone
      polygonPoints.push(`0px ${contentTop}px`)
      // Top-right
      polygonPoints.push(`${PAGE_CONFIG.width}px ${contentTop}px`)
      // Bottom-right
      polygonPoints.push(`${PAGE_CONFIG.width}px ${contentBottom}px`)
      // Bottom-left
      polygonPoints.push(`0px ${contentBottom}px`)

      // Bridge to next zone (go left side)
      if (i < pageCount - 1) {
        const nextPageTop = (i + 1) * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
        const nextContentTop = nextPageTop + contentTopOffset
        // Stay on left edge, jump to next content zone
        polygonPoints.push(`0px ${nextContentTop}px`)
      }
    }

    // Close polygon by going back up
    for (let i = pageCount - 1; i >= 0; i--) {
      // Already handled by polygon auto-close
    }

    return `polygon(${polygonPoints.join(', ')})`
  }, [pageCount, minHeight])

  return (
    <div className="editor-v2-container">
      <div className="editor-v2-shell" style={{ minHeight }}>
        <PagesOverlay pageCount={pageCount} pageBreakOffsets={pageBreakOffsets} />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            clipPath: clipPath !== 'none' ? clipPath : undefined,
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
