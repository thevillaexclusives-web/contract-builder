'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { useEffect, useImperativeHandle, forwardRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { EditorProps, EditorRef } from '@/types/editor'
import Toolbar from './Toolbar'
import { CustomOrderedList } from './extensions/custom-ordered-list'

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
      ],
      content: content || {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
          },
        ],
      },
      editable,
      onUpdate: ({ editor }) => {
        if (onChange) {
          onChange(editor.getJSON())
        }
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-xl mx-auto focus:outline-none min-h-[500px] p-4',
        },
      },
    })

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
      <div className={`border rounded-lg bg-white ${className}`}>
        {showToolbar && <Toolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    )
  }
)

export default Editor
