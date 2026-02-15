'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
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

/** True when doc is empty or contains only a single empty paragraph. */
function isDocEmpty(json: JSONContent | undefined): boolean {
  if (!json) return true
  const c = json.content
  if (!c || c.length === 0) return true
  if (c.length === 1 && c[0].type === 'paragraph' && (!c[0].content || c[0].content.length === 0)) return true
  return false
}

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
  onHeightsChange?: (headerH: number, footerH: number) => void
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
  onHeightsChange,
}: HeaderFooterEditorsProps) {
  const isEditable = mode === 'template'

  // Live HTML snapshots updated via editor.on('update')
  const [headerHtml, setHeaderHtml] = useState('')
  const [footerHtml, setFooterHtml] = useState('')

  // Measured heights
  const headerRegionRef = useRef<HTMLDivElement>(null)
  const footerRegionRef = useRef<HTMLDivElement>(null)
  const prevHeightsRef = useRef('0|0')

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

  // Measure header/footer heights and report to parent.
  const measureHeights = useCallback(() => {
    const hEmpty = isDocEmpty(headerEditor?.getJSON())
    const fEmpty = isDocEmpty(footerEditor?.getJSON())

    const hH = hEmpty ? 0 : (headerRegionRef.current?.scrollHeight ?? 0)
    const fH = fEmpty ? 0 : (footerRegionRef.current?.scrollHeight ?? 0)

    const key = `${hH}|${fH}`
    if (key !== prevHeightsRef.current) {
      prevHeightsRef.current = key
      onHeightsChange?.(hH, fH)
    }
  }, [headerEditor, footerEditor, onHeightsChange])

  // Subscribe to editor updates: keep preview HTML in sync + re-measure heights.
  useEffect(() => {
    if (!headerEditor) return
    const onUpdate = () => {
      setHeaderHtml(headerEditor.getHTML())
      // Defer measure to next frame so DOM has updated
      requestAnimationFrame(measureHeights)
    }
    onUpdate() // initial
    headerEditor.on('update', onUpdate)
    return () => { headerEditor.off('update', onUpdate) }
  }, [headerEditor, measureHeights])

  useEffect(() => {
    if (!footerEditor) return
    const onUpdate = () => {
      setFooterHtml(footerEditor.getHTML())
      requestAnimationFrame(measureHeights)
    }
    onUpdate() // initial
    footerEditor.on('update', onUpdate)
    return () => { footerEditor.off('update', onUpdate) }
  }, [footerEditor, measureHeights])

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

  // Outside-click handler
  const layerRef = useRef<HTMLDivElement>(null)
  const handleLayerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activeRegion !== 'header' && activeRegion !== 'footer') return
      const target = e.target as HTMLElement
      if (target.closest('.editor-v2-hf-region.active')) return
      onRegionChange('body')
    },
    [activeRegion, onRegionChange]
  )

  const headerEmpty = isDocEmpty(headerEditor?.getJSON())
  const footerEmpty = isDocEmpty(footerEditor?.getJSON())

  const pages = Array.from({ length: pageCount }, (_, i) => i)

  return (
    <div
      ref={layerRef}
      className="editor-v2-hf-layer"
      style={activeRegion === 'header' || activeRegion === 'footer' ? { pointerEvents: 'auto' } : undefined}
      onMouseDown={handleLayerMouseDown}
    >
      {pages.map((i) => {
        const pageTop = i * (PAGE_CONFIG.height + PAGE_CONFIG.gap)
        const headerTop = pageTop + PAGE_CONFIG.paddingTop
        const footerTop = pageTop + PAGE_CONFIG.height - PAGE_CONFIG.paddingBottom - ((footerRegionRef.current?.scrollHeight ?? 0) || PAGE_CONFIG.footerHeight)

        // Show region if it has content OR if it's actively being edited
        const showHeader = !headerEmpty || activeRegion === 'header'
        const showFooter = !footerEmpty || activeRegion === 'footer'

        return (
          <React.Fragment key={i}>
            {/* Header region */}
            <div
              ref={i === 0 ? headerRegionRef : undefined}
              className={`editor-v2-hf-region${activeRegion === 'header' ? ' active' : ''}${!showHeader ? ' empty' : ''}`}
              style={{
                position: 'absolute',
                top: headerTop,
                left: PAGE_CONFIG.paddingX,
                right: PAGE_CONFIG.paddingX,
                pointerEvents: activeRegion === 'header' || (isEditable && activeRegion === 'body') ? 'auto' : 'none',
              }}
              onDoubleClick={handleHeaderDblClick}
            >
              {i === 0 ? (
                <EditorContent editor={headerEditor} />
              ) : showHeader ? (
                <div className="hf-preview ProseMirror" dangerouslySetInnerHTML={{ __html: headerHtml }} />
              ) : null}
              {isEditable && activeRegion !== 'header' && (
                <div className="hf-hint">Double-click to edit header</div>
              )}
            </div>

            {/* Footer region */}
            <div
              ref={i === 0 ? footerRegionRef : undefined}
              className={`editor-v2-hf-region${activeRegion === 'footer' ? ' active' : ''}${!showFooter ? ' empty' : ''}`}
              style={{
                position: 'absolute',
                top: footerTop,
                left: PAGE_CONFIG.paddingX,
                right: PAGE_CONFIG.paddingX,
                pointerEvents: activeRegion === 'footer' || (isEditable && activeRegion === 'body') ? 'auto' : 'none',
              }}
              onDoubleClick={handleFooterDblClick}
            >
              {i === 0 ? (
                <EditorContent editor={footerEditor} />
              ) : showFooter ? (
                <div className="hf-preview ProseMirror" dangerouslySetInnerHTML={{ __html: footerHtml }} />
              ) : null}
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
