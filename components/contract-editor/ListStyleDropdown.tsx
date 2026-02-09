'use client'

import { Editor } from '@tiptap/core'
import { useCallback } from 'react'
import { ListOrdered, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ListStyleDropdownProps {
  editor: Editor | null
  isActive: boolean
}

interface ListStyleOption {
  value: string
  label: string
  preview: string
  example: string[]
}

const LIST_STYLES: ListStyleOption[] = [
  {
    value: 'decimal',
    label: 'Numbered List',
    preview: '1. 2. 3.',
    example: ['1.', '2.', '3.'],
  },
  {
    value: 'upper-roman',
    label: 'Roman Numerals',
    preview: 'I. II. III.',
    example: ['I.', 'II.', 'III.'],
  },
  {
    value: 'lower-roman',
    label: 'Lowercase Roman',
    preview: 'i. ii. iii.',
    example: ['i.', 'ii.', 'iii.'],
  },
  {
    value: 'upper-alpha',
    label: 'Uppercase Letters',
    preview: 'A. B. C.',
    example: ['A.', 'B.', 'C.'],
  },
  {
    value: 'lower-alpha',
    label: 'Lowercase Letters',
    preview: 'a. b. c.',
    example: ['a.', 'b.', 'c.'],
  },
]

export default function ListStyleDropdown({ editor, isActive }: ListStyleDropdownProps) {
  const handleListStyle = useCallback(
    (listStyleType: string) => {
      if (!editor) return

      if (editor.isActive('orderedList')) {
        // Update existing list style
        editor.chain().focus().updateAttributes('orderedList', { listStyleType }).run()
      } else {
        // Create new list with style
        // First toggle the list, then update attributes
        const toggleResult = editor.chain().focus().toggleOrderedList().run()
        
        if (toggleResult) {
          // Use requestAnimationFrame to ensure DOM is updated before updating attributes
          requestAnimationFrame(() => {
            if (editor.isActive('orderedList')) {
              editor.chain().focus().updateAttributes('orderedList', { listStyleType }).run()
            }
          })
        }
      }
    },
    [editor]
  )

  if (!editor) {
    return null
  }

  const currentStyle = editor.getAttributes('orderedList').listStyleType || 'decimal'
  const currentOption = LIST_STYLES.find((style) => style.value === currentStyle) || LIST_STYLES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`
            p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-1
            ${isActive ? 'bg-gray-200' : ''}
          `}
          title="Numbered List Options"
        >
          <ListOrdered className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>List Style</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LIST_STYLES.map((style) => (
          <DropdownMenuItem
            key={style.value}
            onClick={() => handleListStyle(style.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{style.label}</span>
              <span className="text-xs text-muted-foreground">{style.preview}</span>
            </div>
            {currentStyle === style.value && (
              <span className="text-xs text-blue-600 font-semibold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
