'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor } from '@tiptap/react'

interface PagePaginationProps {
  editor: ReturnType<typeof useEditor>
  children: React.ReactNode
}

/**
 * PagePagination Component
 * 
 * Automatically splits editor content into pages based on A4 height.
 * Measures content and creates visual page containers with page numbers.
 */
export function PagePagination({ editor, children }: PagePaginationProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = useState(1)

  useEffect(() => {
    if (!editor || !wrapperRef.current) return

    const calculatePages = () => {
      const editorElement = wrapperRef.current?.querySelector('.ProseMirror')
      if (!editorElement) return

      // A4 content height in pixels (~933px at 96 DPI after margins)
      const pageContentHeight = 933
      const contentHeight = editorElement.scrollHeight
      const calculatedPages = Math.max(1, Math.ceil(contentHeight / pageContentHeight))
      
      setPageCount(calculatedPages)
    }

    // Calculate on content updates
    const handleUpdate = () => {
      requestAnimationFrame(() => {
        setTimeout(calculatePages, 100)
      })
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    // Initial calculation
    calculatePages()

    // Also listen for resize
    const resizeObserver = new ResizeObserver(calculatePages)
    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current)
    }

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
      resizeObserver.disconnect()
    }
  }, [editor])

  return (
    <div ref={wrapperRef} className="page-content-wrapper" data-page-count={pageCount}>
      {children}
    </div>
  )
}
