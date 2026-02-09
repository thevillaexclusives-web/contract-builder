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

      console.log('🎯 handleListStyle called with:', listStyleType)
      console.log('📊 Current list active:', editor.isActive('orderedList'))
      console.log('📊 Current attributes:', editor.getAttributes('orderedList'))

      if (editor.isActive('orderedList')) {
        // Update existing list style
        console.log('🔄 Updating existing list style')
        const result = editor.chain().focus().updateAttributes('orderedList', { listStyleType }).run()
        console.log('✅ Update result:', result)
        console.log('📊 New attributes:', editor.getAttributes('orderedList'))
      } else {
        // Create new list with style using our custom command
        console.log('🆕 Creating new list with style:', listStyleType)
        
        // First toggle the list, then update attributes
        // Use a microtask to ensure the list exists before updating
        const toggleResult = editor.chain().focus().toggleOrderedList().run()
        console.log('✅ Toggle result:', toggleResult)
        
        if (toggleResult) {
          // Use requestAnimationFrame to ensure DOM is updated
          requestAnimationFrame(() => {
            if (editor.isActive('orderedList')) {
              console.log('🔄 Updating attributes after list creation')
              const updateResult = editor.chain().focus().updateAttributes('orderedList', { listStyleType }).run()
              console.log('✅ Update result:', updateResult)
              console.log('📊 New attributes:', editor.getAttributes('orderedList'))
              
              // Debug: Check the actual HTML output
              setTimeout(() => {
                const html = editor.getHTML()
                console.log('📄 Editor HTML:', html)
                const json = editor.getJSON()
                console.log('📄 Editor JSON:', JSON.stringify(json, null, 2))
              }, 100)
            } else {
              console.warn('⚠️ List is not active after toggle')
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
