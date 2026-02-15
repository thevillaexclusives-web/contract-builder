import React, { useMemo, useState, useCallback } from 'react'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import type { JSONContent } from '@tiptap/core'
import type { ActiveRegion, EditorMode } from '@/types/editor'
import { PAGE_CONFIG } from '../config/pageConfig'
import { PagesOverlay } from './PagesOverlay'
import { HeaderFooterEditors } from './HeaderFooterEditors'

interface EditorShellProps {
  editor: Editor
  pageCount: number
  activeRegion: ActiveRegion
  onRegionChange: (region: ActiveRegion) => void
  mode: EditorMode
  headerContent?: JSONContent
  footerContent?: JSONContent
  onHeaderChange?: (content: JSONContent) => void
  onFooterChange?: (content: JSONContent) => void
  onHeaderEditor?: (editor: Editor | null) => void
  onFooterEditor?: (editor: Editor | null) => void
  onHfHeightsChange?: (headerH: number, footerH: number) => void
}

export function EditorShell({
  editor,
  pageCount,
  activeRegion,
  onRegionChange,
  mode,
  headerContent,
  footerContent,
  onHeaderChange,
  onFooterChange,
  onHeaderEditor,
  onFooterEditor,
  onHfHeightsChange,
}: EditorShellProps) {
  const [headerH, setHeaderH] = useState(0)
  const [footerH, setFooterH] = useState(0)

  const handleHeightsChange = useCallback((hH: number, fH: number) => {
    setHeaderH(hH)
    setFooterH(fH)
    onHfHeightsChange?.(hH, fH)
  }, [onHfHeightsChange])

  const minHeight = useMemo(
    () => pageCount * PAGE_CONFIG.height + (pageCount - 1) * PAGE_CONFIG.gap,
    [pageCount]
  )

  const bodyPointerEvents = activeRegion === 'header' || activeRegion === 'footer' ? 'none' : 'auto'

  // Body padding = page padding + measured hf height (already min-clamped by HeaderFooterEditors)
  const bodyPaddingTop = PAGE_CONFIG.paddingTop + (headerH || PAGE_CONFIG.headerHeight)
  const bodyPaddingBottom = PAGE_CONFIG.paddingBottom + (footerH || PAGE_CONFIG.footerHeight)

  return (
    <div className="editor-v2-container">
      <div className="editor-v2-shell" style={{ minHeight }}>
        <PagesOverlay pageCount={pageCount} />
        <HeaderFooterEditors
          pageCount={pageCount}
          activeRegion={activeRegion}
          onRegionChange={onRegionChange}
          mode={mode}
          headerContent={headerContent}
          footerContent={footerContent}
          onHeaderChange={onHeaderChange}
          onFooterChange={onFooterChange}
          onHeaderEditor={onHeaderEditor}
          onFooterEditor={onFooterEditor}
          onHeightsChange={handleHeightsChange}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            pointerEvents: bodyPointerEvents,
            ['--body-padding-top' as string]: `${bodyPaddingTop}px`,
            ['--body-padding-bottom' as string]: `${bodyPaddingBottom}px`,
          }}
          onClick={() => {
            if (activeRegion !== 'body') {
              onRegionChange('body')
            }
          }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
