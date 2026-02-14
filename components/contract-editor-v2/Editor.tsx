'use client'

import { useEditor } from '@tiptap/react'
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
import { useEffect, useImperativeHandle, forwardRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { EditorProps, EditorRef } from '@/types/editor'
import Toolbar from '@/components/contract-editor/Toolbar'
import { CustomOrderedList } from './extensions/custom-ordered-list'
import { FieldNode } from './extensions/field-node'
import { PageBreak } from './extensions/page-break'
import { EditorShell } from './components/EditorShell'
import { usePagination } from './hooks/usePagination'

const Editor = forwardRef<EditorRef, EditorProps & { showToolbar?: boolean }>(
  function Editor(
    {
      content,
      mode = 'template',
      onChange,
      editable = true,
      className = '',
      showToolbar = true,
    },
    ref
  ) {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          orderedList: false,
        }),
        CustomOrderedList,
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextStyle,
        FontFamily,
        Underline,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        FontSize,
        FieldNode,
        PageBreak,
      ],
      content: content || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
          },
        ],
      },
      editable: mode === 'contract' ? false : editable,
      onUpdate: ({ editor }) => {
        if (onChange) {
          onChange(editor.getJSON())
        }
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl mx-auto focus:outline-none',
          style: 'font-size: 16px;',
          ...(mode === 'contract' ? { 'data-contract-mode': 'true' } : {}),
        },
        handleDOMEvents: mode === 'contract' ? {
          mousedown: (view, event) => {
            const target = event.target as HTMLElement
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            const fieldNode = target.closest('.field-node')
            if (fieldNode) {
              const input = fieldNode.querySelector('input') as HTMLInputElement
              if (input) {
                event.preventDefault()
                event.stopPropagation()
                setTimeout(() => input.focus(), 0)
                return true
              }
            }
            event.preventDefault()
            return true
          },
          click: (view, event) => {
            const target = event.target as HTMLElement
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            if (target.closest('.field-node')) {
              return false
            }
            return true
          },
          keydown: (view, event) => {
            const target = event.target as HTMLElement
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            return true
          },
          beforeinput: (view, event) => {
            const target = event.target as HTMLElement
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            return true
          },
        } : undefined,
      },
      onBeforeCreate: ({ editor }) => {
        editor.storage.mode = mode
      },
    })

    const { pageCount, pageBreakOffsets } = usePagination(editor)

    // Update mode in storage when it changes
    useEffect(() => {
      if (editor) {
        editor.storage.mode = mode
        editor.view.dispatch(editor.state.tr)
      }
    }, [editor, mode])

    // Update content when prop changes
    useEffect(() => {
      if (editor && content && JSON.stringify(editor.getJSON()) !== JSON.stringify(content)) {
        editor.commands.setContent(content)
      }
    }, [content, editor])

    // Expose editor methods via ref
    useImperativeHandle(ref, () => ({
      getContent: () => editor?.getJSON() || { type: 'doc', content: [] },
      setContent: (newContent: JSONContent) => {
        editor?.commands.setContent(newContent)
      },
      clear: () => {
        editor?.commands.clearContent()
      },
    }))

    if (!editor) {
      return (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          Loading editor...
        </div>
      )
    }

    return (
      <div className={className}>
        {showToolbar && (
          <div className="max-w-[794px] mx-auto mb-0">
            <div className="border rounded-t-lg bg-white">
              <Toolbar editor={editor} />
            </div>
          </div>
        )}
        <EditorShell
          editor={editor}
          pageCount={pageCount}
          pageBreakOffsets={pageBreakOffsets}
        />
      </div>
    )
  }
)

export default Editor
