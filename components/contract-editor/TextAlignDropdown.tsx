'use client'

import { Editor } from '@tiptap/core'
import { useCallback } from 'react'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TextAlignDropdownProps {
  editor: Editor | null
}

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'center', label: 'Center', icon: AlignCenter },
  { value: 'right', label: 'Right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
] as const

export default function TextAlignDropdown({ editor }: TextAlignDropdownProps) {
  const handleAlign = useCallback(
    (align: string) => {
      if (!editor) return
      editor.chain().focus().setTextAlign(align as 'left' | 'center' | 'right' | 'justify').run()
    },
    [editor]
  )

  if (!editor) {
    return null
  }

  const currentAlign = editor.getAttributes('textAlign').textAlign || 'left'
  const currentOption = ALIGN_OPTIONS.find((opt) => opt.value === currentAlign) || ALIGN_OPTIONS[0]
  const CurrentIcon = currentOption.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Text Alignment"
          className={`
            p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-1
            ${currentAlign !== 'left' ? 'bg-gray-200' : ''}
          `}
        >
          <CurrentIcon className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel>Text Alignment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ALIGN_OPTIONS.map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleAlign(option.value)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="w-4 h-4" />
              <span>{option.label}</span>
              {currentAlign === option.value && (
                <span className="text-xs text-blue-600 font-semibold ml-auto">✓</span>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
