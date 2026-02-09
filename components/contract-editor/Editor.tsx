'use client'

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
import { useEffect, useImperativeHandle, forwardRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { EditorProps, EditorRef } from '@/types/editor'
import Toolbar from './Toolbar'
import { CustomOrderedList } from './extensions/custom-ordered-list'
import { FieldNode } from './extensions/field-node'
import { PageBreak } from './extensions/page-break'

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
          // Keep default OrderedList disabled, use our custom one
          orderedList: false,
        }),
        CustomOrderedList, // Our custom ordered list with Roman/letter support
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
        FieldNode, // Custom field node for fillable fields
        PageBreak, // Page break support
      ],
      content: content || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
          },
        ],
      },
      editable: mode === 'contract' ? false : editable, // Contract mode: non-editable except fields
      onUpdate: ({ editor }) => {
        if (onChange) {
          onChange(editor.getJSON())
        }
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl mx-auto focus:outline-none min-h-[500px] p-4',
          style: 'font-size: 16px;',
          ...(mode === 'contract' ? { 'data-contract-mode': 'true' } : {}),
        },
        // In contract mode, prevent editing except on field inputs
        handleDOMEvents: mode === 'contract' ? {
          mousedown: (view, event) => {
            const target = event.target as HTMLElement
            // Always allow clicks on field inputs
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false // Let the event through to the input
            }
            // Allow clicking on field nodes to focus their inputs
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
            // Prevent all other interactions
            event.preventDefault()
            return true
          },
          click: (view, event) => {
            const target = event.target as HTMLElement
            // Allow clicks on field inputs
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            // Allow clicks on field nodes
            if (target.closest('.field-node')) {
              return false
            }
            // Prevent other clicks
            return true
          },
          keydown: (view, event) => {
            const target = event.target as HTMLElement
            // Always allow keyboard events on field inputs
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            // Prevent all other keyboard events
            return true
          },
          beforeinput: (view, event) => {
            const target = event.target as HTMLElement
            // Allow input events on field inputs
            if (target.tagName === 'INPUT' && target.closest('.field-node')) {
              return false
            }
            // Prevent all other input events
            return true
          },
        } : undefined,
      },
      // Store mode in editor storage for field nodes to access
      onBeforeCreate: ({ editor }) => {
        editor.storage.mode = mode
      },
    })

    // Update mode in storage when it changes
    useEffect(() => {
      if (editor) {
        editor.storage.mode = mode
        // Force update of field nodes by triggering a transaction
        editor.view.dispatch(editor.state.tr)
      }
    }, [editor, mode])

    // Update content when prop changes (but not on every render)
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
      <div className={`editor-container ${className}`}>
        <div className="border rounded-lg bg-white">
          {showToolbar && <Toolbar editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

export default Editor
