import React from 'react'
import { PAGE_CONFIG } from '../config/pageConfig'

interface PagesOverlayProps {
  pageCount: number
}

export function PagesOverlay({ pageCount }: PagesOverlayProps) {
  const pages = Array.from({ length: pageCount }, (_, i) => i)

  return (
    <div className="editor-v2-overlay">
      {pages.map((pageIndex) => {
        const top = pageIndex * (PAGE_CONFIG.height + PAGE_CONFIG.gap)

        return (
          <div
            key={pageIndex}
            className="editor-v2-page-rect"
            style={{
              top,
              height: PAGE_CONFIG.height,
            }}
          />
        )
      })}
    </div>
  )
}
