'use client'

import { Editor } from '@tiptap/core'
import { useCallback } from 'react'
import { Bold, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface FontWeightDropdownProps {
  editor: Editor | null
}

const FONT_WEIGHTS = [
  { value: 'normal', label: 'Normal', weight: 400 },
  { value: '300', label: 'Light', weight: 300 },
  { value: '400', label: 'Regular', weight: 400 },
  { value: '500', label: 'Medium', weight: 500 },
  { value: '600', label: 'Semi Bold', weight: 600 },
  { value: '700', label: 'Bold', weight: 700 },
  { value: '800', label: 'Extra Bold', weight: 800 },
  { value: '900', label: 'Black', weight: 900 },
] as const

export default function FontWeightDropdown({ editor }: FontWeightDropdownProps) {
  const handleFontWeight = useCallback(
    (weight: string) => {
      if (!editor) return
      if (weight === 'normal') {
        // Remove font weight (use default)
        editor.chain().focus().unsetFontWeight().run()
      } else {
        // Set font weight
        editor.chain().focus().setFontWeight(weight).run()
      }
    },
    [editor]
  )

  if (!editor) {
    return null
  }

  // Check if bold is active (which sets font-weight: 700)
  const isBold = editor.isActive('bold')
  // Get fontWeight from textStyle mark
  const fontWeightAttr = editor.getAttributes('textStyle')?.fontWeight
  const fontWeight = fontWeightAttr || (isBold ? '700' : 'normal')
  const currentOption = FONT_WEIGHTS.find((opt) => opt.value === fontWeight) || FONT_WEIGHTS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Font Weight"
          className={`
            p-2 rounded hover:bg-gray-100 transition-colors flex items-center gap-1
            ${fontWeight !== 'normal' && !isBold ? 'bg-gray-200' : ''}
          `}
        >
          <Bold className="w-4 h-4" />
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel>Font Weight</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FONT_WEIGHTS.map((weight) => (
          <DropdownMenuItem
            key={weight.value}
            onClick={() => handleFontWeight(weight.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span style={{ fontWeight: weight.weight }}>{weight.label}</span>
            {(fontWeight === weight.value || (isBold && weight.value === '700')) && (
              <span className="text-xs text-blue-600 font-semibold">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
