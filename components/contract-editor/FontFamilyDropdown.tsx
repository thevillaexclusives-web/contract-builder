'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface FontFamilyDropdownProps {
  editor: Editor | null
}

const FONT_FAMILIES = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
] as const

export default function FontFamilyDropdown({ editor }: FontFamilyDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (value: string) => {
      if (!editor) return
      editor.chain().focus().setFontFamily(value).run()
      setOpen(false)
    },
    [editor]
  )

  const handleUnset = useCallback(() => {
    if (!editor) return
    editor.chain().focus().unsetFontFamily().run()
    setOpen(false)
  }, [editor])

  if (!editor) return null

  const currentFont = editor.getAttributes('textStyle')?.fontFamily || 'Inter'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs border rounded hover:bg-gray-100 transition-colors min-w-[100px]"
        title="Font Family"
      >
        <span className="truncate" style={{ fontFamily: currentFont }}>
          {currentFont}
        </span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 min-w-[160px]">
          {FONT_FAMILIES.map((font) => (
            <button
              key={font.value}
              type="button"
              onClick={() => handleSelect(font.value)}
              className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors ${
                currentFont === font.value ? 'bg-gray-200 font-medium' : ''
              }`}
              style={{ fontFamily: font.value }}
            >
              {font.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
