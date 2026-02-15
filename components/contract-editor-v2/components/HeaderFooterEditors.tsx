'use client'

import React, { useEffect, useMemo, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { generateHTML } from '@tiptap/html'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontSize } from '@tiptap/extension-font-size'
import type { JSONContent, Editor } from '@tiptap/core'
import type { ActiveRegion, EditorMode } from '@/types/editor'
import { CustomOrderedList } from '../extensions/custom-ordered-list'
import { FieldNode } from '../extensions/field-node'
import { PAGE_CONFIG } from '../config/pageConfig'

const hfExtensions = [
  StarterKit.configure({ orderedList: false }),
  CustomOrderedList,
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  TextStyle,
  FontFamily,
  Underline,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  FontSize,
  FieldNode,
]

const emptyDoc: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

interface HeaderFooterEditorsProps {
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
}

export function HeaderFooterEditors({
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
}: HeaderFooterEditorsProps) {
  const isEditable = mode === 'template'

  const headerEditor = useEditor({
    extensions: hfExtensions,
    content: headerContent || emptyDoc,
    editable: isEditable && activeRegion === 'header',
    onUpdate: ({ editor }) => {
      onHeaderChange?.(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'hf-editor',
      },
    },
  })

  const footerEditor = useEditor({
    extensions: hfExtensions,
    content: footerContent || emptyDoc,
    editable: isEditable && activeRegion === 'footer',
    onUpdate: ({ editor }) => {
      onFooterChange?.(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'hf-editor',
      },
    },
  })

  // Expose editors to parent
  useEffect(() => {
    onHeaderEditor?.(headerEditor)
  }, [headerEditor, onHeaderEditor])

  useEffect(() => {
    onFooterEditor?.(footerEditor)
  }, [footerEditor, onFooterEditor])

  // Toggle editable when activeRegion or mode changes
  useEffect(() => {
    headerEditor?.setEditable(isEditable && activeRegion === 'header')
  }, [headerEditor, activeRegion, isEditable])

  useEffect(() => {
    footerEditor?.setEditable(isEditable && activeRegion === 'footer')
  }, [footerEditor, activeRegion, isEditable])

  // Sync content props
  useEffect(() => {
    if (headerEditor && headerContent && JSON.stringify(headerEditor.getJSON()) !== JSON.stringify(headerContent)) {
      headerEditor.commands.setContent(headerContent)
    }
  }, [headerContent, headerEditor])

  useEffect(() => {
    if (footerEditor && footerContent && JSON.stringify(footerEditor.getJSON()) !== JSON.stringify(footerContent)) {
      footerEditor.commands.setContent(footerContent)
    }
  }, [footerContent, footerEditor])

  // Generate preview HTML for non-page-0 pages
  const headerHtml = useMemo(() => {
    if (!headerEditor) return ''
    try {
      return generateHTML(headerEditor.getJSON(), hfExtensions)
    } catch {
      return ''
    }
  }, [headerEditor, headerContent])

  const footerHtml = useMemo(() => {
    if (!footerEditor) return ''
    try {
      return generateHTML(footerEditor.getJSON(), hfExtensions)
    } catch {
      return ''
    }
  }, [footerEditor, footerContent])

  const handleHeaderDblClick = useCallback(() => {
    if (isEditable) {
      onRegionChange('header')
      setTimeout(() => headerEditor?.commands.focus(), 0)
    }
  }, [isEditable, onRegionChange, headerEditor])

  const handleFooterDblClick = useCallback(() => {
    if (isEditable) {
      onRegionChange('footer')
      setTimeout(() => footerEditor?.commands.focus(), 0)
    }
  }, [isEditable, onRegionChange, footerEditor])

  const pages = Array.from({ length: pageCount }, (_, i) => i)

  return (
    <div className="editor-v2-hf-layer">
      {pages.map((i) => {
        const pageTop = i * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
        const headerTop = pageTop + PAGE_CONFIG.paddingTop
        const footerTop = pageTop + PAGE_CONFIG.height - PAGE_CONFIG.paddingBottom - PAGE_CONFIG.footerHeight

        return (
          <React.Fragment key={i}>
            {/* Header region */}
            <div
              className={`editor-v2-hf-region${activeRegion === 'header' ? ' active' : ''}`}
              style={{
                position: 'absolute',
                top: headerTop,
                left: PAGE_CONFIG.paddingX,
                right: PAGE_CONFIG.paddingX,
                height: PAGE_CONFIG.headerHeight,
                pointerEvents: activeRegion === 'header' || (isEditable && activeRegion === 'body') ? 'auto' : 'none',
              }}
              onDoubleClick={handleHeaderDblClick}
            >
              {i === 0 ? (
                <EditorContent editor={headerEditor} />
              ) : (
                <div className="hf-preview ProseMirror" dangerouslySetInnerHTML={{ __html: headerHtml }} />
              )}
              {isEditable && activeRegion !== 'header' && (
                <div className="hf-hint">Double-click to edit header</div>
              )}
            </div>

            {/* Footer region */}
            <div
              className={`editor-v2-hf-region${activeRegion === 'footer' ? ' active' : ''}`}
              style={{
                position: 'absolute',
                top: footerTop,
                left: PAGE_CONFIG.paddingX,
                right: PAGE_CONFIG.paddingX,
                height: PAGE_CONFIG.footerHeight,
                pointerEvents: activeRegion === 'footer' || (isEditable && activeRegion === 'body') ? 'auto' : 'none',
              }}
              onDoubleClick={handleFooterDblClick}
            >
              {i === 0 ? (
                <EditorContent editor={footerEditor} />
              ) : (
                <div className="hf-preview ProseMirror" dangerouslySetInnerHTML={{ __html: footerHtml }} />
              )}
              {isEditable && activeRegion !== 'footer' && (
                <div className="hf-hint">Double-click to edit footer</div>
              )}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}
