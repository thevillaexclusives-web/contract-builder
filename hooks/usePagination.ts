'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/core'

interface PageBoundary {
  startNodeIndex: number
  endNodeIndex: number
  startOffset: number
  endOffset: number
  isManualBreak: boolean
}

interface NodeMeasurement {
  node: Node
  index: number
  height: number
  cumulativeHeight: number
  isNonSplittable: boolean
  isPageBreak: boolean
}

import { A4_CONTENT_HEIGHT, A4_PAGE_HEIGHT } from '@/lib/constants/page'

/**
 * Hook for calculating pagination boundaries based on content measurements
 */
export function usePagination(editor: Editor | null) {
  const [pageBoundaries, setPageBoundaries] = useState<PageBoundary[]>([])
  const [pageCount, setPageCount] = useState(1)
  const measurementRef = useRef<Map<number, NodeMeasurement>>(new Map())
  const rafRef = useRef<number>(0)

  const measureNodes = useCallback((): NodeMeasurement[] => {
    if (!editor) return []

    const measurements: NodeMeasurement[] = []
    const editorElement = editor.view.dom as HTMLElement
    
    if (!editorElement) return []

    // Get ProseMirror document structure to identify node types
    const { state } = editor.view
    const { doc } = state
    
    // Get all direct children of the ProseMirror editor (block-level nodes)
    const proseMirrorContent = editorElement.querySelector('.ProseMirror > *')?.parentElement
    if (!proseMirrorContent) return []

    // Measure block-level DOM elements directly
    // ProseMirror renders block nodes as direct children of .ProseMirror
    const blockElements: HTMLElement[] = []
    const walkDOM = (element: Element) => {
      // Get direct children that are block-level elements
      Array.from(element.children).forEach((child) => {
        const el = child as HTMLElement
        const tagName = el.tagName.toLowerCase()
        
        // Check if this is a block-level element
        const isBlockElement = [
          'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'ul', 'ol', 'li', 'blockquote', 'table', 'pre', 'hr'
        ].includes(tagName) || el.hasAttribute('data-type')
        
        if (isBlockElement) {
          blockElements.push(el)
        }
        
        // Also check for page breaks
        if (el.hasAttribute('data-type') && el.getAttribute('data-type') === 'page-break') {
          blockElements.push(el)
        }
      })
    }

    walkDOM(editorElement)

    // If we didn't find block elements, try a different approach
    // Get all elements with ProseMirror node markers
    if (blockElements.length === 0) {
      const allElements = editorElement.querySelectorAll('[data-node-type], p, div, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, table')
      allElements.forEach((el) => {
        if (el.parentElement === editorElement || el.closest('.ProseMirror') === editorElement) {
          blockElements.push(el as HTMLElement)
        }
      })
    }

    let cumulativeHeight = 0

    // Measure each block element
    blockElements.forEach((domNode, index) => {
      const rect = domNode.getBoundingClientRect()
      const height = rect.height || 0
      
      // Get node type from ProseMirror state if possible
      let nodeType = 'paragraph'
      let isPageBreak = false
      let isNonSplittable = false

      // Try to get node type from data attribute or tag name
      const dataNodeType = domNode.getAttribute('data-node-type')
      if (dataNodeType) {
        nodeType = dataNodeType
      } else {
        const tagName = domNode.tagName.toLowerCase()
        if (tagName === 'div' && domNode.hasAttribute('data-type') && domNode.getAttribute('data-type') === 'page-break') {
          nodeType = 'pageBreak'
        } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          nodeType = 'heading'
        } else if (tagName === 'ul') {
          nodeType = 'bulletList'
        } else if (tagName === 'ol') {
          nodeType = 'orderedList'
        } else if (tagName === 'blockquote') {
          nodeType = 'blockquote'
        } else if (tagName === 'table') {
          nodeType = 'table'
        }
      }

      isPageBreak = nodeType === 'pageBreak'
      isNonSplittable = 
        nodeType === 'image' ||
        nodeType === 'table' ||
        nodeType === 'codeBlock' ||
        nodeType === 'blockquote'

      measurements.push({
        node: domNode,
        index,
        height,
        cumulativeHeight: cumulativeHeight + height,
        isNonSplittable,
        isPageBreak,
      })

      cumulativeHeight += height
    })

    return measurements
  }, [editor])

  const calculatePageBoundaries = useCallback((measurements: NodeMeasurement[]): PageBoundary[] => {
    if (measurements.length === 0) {
      return [{
        startNodeIndex: 0,
        endNodeIndex: 0,
        startOffset: 0,
        endOffset: 0,
        isManualBreak: false,
      }]
    }

    const boundaries: PageBoundary[] = []
    let currentPageStart = 0
    let currentPageHeight = 0
    let currentPageStartHeight = 0

    for (let i = 0; i < measurements.length; i++) {
      const measurement = measurements[i]
      
      // If we encounter a manual page break, create a boundary here
      if (measurement.isPageBreak) {
        // End current page before the break
        if (currentPageStart < i) {
          boundaries.push({
            startNodeIndex: currentPageStart,
            endNodeIndex: i - 1,
            startOffset: 0,
            endOffset: 0,
            isManualBreak: false,
          })
        }
        
        // Start new page after the break
        currentPageStart = i + 1
        currentPageHeight = 0
        currentPageStartHeight = measurement.cumulativeHeight
        continue
      }

      // Check if adding this node would exceed page height
      const nodeHeight = measurement.height
      const wouldExceed = currentPageHeight + nodeHeight > A4_CONTENT_HEIGHT

      // If this is a non-splittable element and it would exceed, push it to next page
      if (measurement.isNonSplittable && wouldExceed && currentPageHeight > 0) {
        // End current page
        boundaries.push({
          startNodeIndex: currentPageStart,
          endNodeIndex: i - 1,
          startOffset: 0,
          endOffset: 0,
          isManualBreak: false,
        })
        
        // Start new page with this non-splittable element
        currentPageStart = i
        currentPageHeight = nodeHeight
        currentPageStartHeight = measurement.cumulativeHeight - nodeHeight
        continue
      }

      // If adding this node exceeds page height and it's splittable
      if (wouldExceed && !measurement.isNonSplittable && currentPageHeight > 0) {
        // End current page
        boundaries.push({
          startNodeIndex: currentPageStart,
          endNodeIndex: i - 1,
          startOffset: 0,
          endOffset: 0,
          isManualBreak: false,
        })
        
        // Start new page with this node
        currentPageStart = i
        currentPageHeight = nodeHeight
        currentPageStartHeight = measurement.cumulativeHeight - nodeHeight
        continue
      }

      // Add node to current page
      currentPageHeight += nodeHeight
    }

    // Add final page boundary
    if (currentPageStart < measurements.length) {
      boundaries.push({
        startNodeIndex: currentPageStart,
        endNodeIndex: measurements.length - 1,
        startOffset: 0,
        endOffset: 0,
        isManualBreak: false,
      })
    }

    // Ensure at least one page
    if (boundaries.length === 0) {
      boundaries.push({
        startNodeIndex: 0,
        endNodeIndex: measurements.length - 1,
        startOffset: 0,
        endOffset: 0,
        isManualBreak: false,
      })
    }

    return boundaries
  }, [])

  const updatePagination = useCallback(() => {
    if (!editor) return

    // Cancel any pending updates
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      const measurements = measureNodes()
      const boundaries = calculatePageBoundaries(measurements)
      
      setPageBoundaries(boundaries)
      setPageCount(Math.max(1, boundaries.length))
    })
  }, [editor, measureNodes, calculatePageBoundaries])

  useEffect(() => {
    if (!editor) return

    // Initial measurement
    updatePagination()

    // Listen to editor updates
    const handleUpdate = () => {
      // Small delay to ensure DOM has updated
      setTimeout(updatePagination, 50)
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)

    // Use ResizeObserver to watch for content size changes
    const editorElement = editor.view.dom as HTMLElement
    if (editorElement) {
      const resizeObserver = new ResizeObserver(() => {
        updatePagination()
      })
      resizeObserver.observe(editorElement)

      // Use MutationObserver to watch for DOM changes
      const mutationObserver = new MutationObserver(() => {
        updatePagination()
      })
      mutationObserver.observe(editorElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class'],
      })

      return () => {
        editor.off('update', handleUpdate)
        editor.off('selectionUpdate', handleUpdate)
        resizeObserver.disconnect()
        mutationObserver.disconnect()
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
        }
      }
    }

    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [editor, updatePagination])

  return {
    pageBoundaries,
    pageCount,
    recalculate: updatePagination,
  }
}
