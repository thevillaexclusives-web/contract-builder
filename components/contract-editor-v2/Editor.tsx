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
import { useEffect, useImperativeHandle, forwardRef, useRef } from 'react'
import type { JSONContent } from '@tiptap/core'
import type { EditorProps, EditorRef } from '@/types/editor'
import Toolbar from '@/components/contract-editor/Toolbar'
import { CustomOrderedList } from './extensions/custom-ordered-list'
import { FieldNode } from './extensions/field-node'
import { PageBreak } from './extensions/page-break'
import { PaginationSpacers } from './extensions/pagination-spacers'
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
        PaginationSpacers,
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

    const { pageCount } = usePagination(editor)
    const prevModeRef = useRef(mode)

    // Update mode in storage when it changes + convert underscores to fields on contract switch
    useEffect(() => {
      if (!editor) return

      const prevMode = prevModeRef.current
      prevModeRef.current = mode
      editor.storage.mode = mode

      // When switching to contract mode, convert underscore sequences to field nodes
      if (mode === 'contract' && prevMode !== 'contract') {
        const { state } = editor
        const { tr } = state
        const allMatches: { from: number; to: number }[] = []

        // Walk only textblock nodes (paragraphs, headings, etc.)
        state.doc.descendants((node, pos) => {
          if (!node.isTextblock || !node.content.size) return

          // Build a combined plain string from inline text children,
          // with a character-index -> absolute-doc-position mapping.
          // Skip content inside existing field nodes.
          const posMap: number[] = []
          let combined = ''

          node.content.forEach((child, offset) => {
            // Skip existing field nodes (atoms)
            if (child.type.name === 'field') return

            if (child.isText && child.text) {
              const absStart = pos + 1 + offset
              for (let i = 0; i < child.text.length; i++) {
                posMap.push(absStart + i)
                combined += child.text[i]
              }
            }
          })

          if (!combined) return

          const regex = /_{5,}/g
          let match: RegExpExecArray | null
          while ((match = regex.exec(combined)) !== null) {
            allMatches.push({
              from: posMap[match.index],
              to: posMap[match.index + match[0].length - 1] + 1,
            })
          }
        })

        // Apply replacements in reverse order (highest position first) to avoid shifting
        if (allMatches.length > 0) {
          allMatches.sort((a, b) => b.from - a.from)
          for (const m of allMatches) {
            const fieldNode = state.schema.nodes.field.create({
              id: `field-${Date.now()}-${m.from}`,
              label: '',
              value: '',
              type: 'text',
            })
            tr.replaceWith(m.from, m.to, fieldNode)
          }
          editor.view.dispatch(tr)
          return
        }
      }

      editor.view.dispatch(editor.state.tr)
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
          <div className="sticky top-0 z-50 mx-auto mb-0">
            <div className="border rounded-t-lg bg-white">
              <Toolbar editor={editor} />
            </div>
          </div>
        )}
        <EditorShell
          editor={editor}
          pageCount={pageCount}
        />
      </div>
    )
  }
)

export default Editor
