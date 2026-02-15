'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

interface LineHeightDropdownProps {
  editor: Editor | null
}

const LINE_HEIGHT_OPTIONS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.3', value: '1.3' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
]

const DEFAULT_LINE_HEIGHT = '1.5'

export default function LineHeightDropdown({ editor }: LineHeightDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [, setUpdateCounter] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!editor) return
    const update = () => setUpdateCounter((p) => p + 1)
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
    }
  }, [editor])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleSelect = useCallback(
    (value: string) => {
      if (!editor) return
      if (value === DEFAULT_LINE_HEIGHT) {
        editor.chain().focus().unsetLineHeight().run()
      } else {
        editor.chain().focus().setLineHeight(value).run()
      }
      setIsOpen(false)
    },
    [editor]
  )

  if (!editor) return null

  // Get current line-height from paragraph or heading attributes
  const currentLH =
    editor.getAttributes('paragraph')?.lineHeight ||
    editor.getAttributes('heading')?.lineHeight ||
    DEFAULT_LINE_HEIGHT

  // Find matching label
  const match = LINE_HEIGHT_OPTIONS.find((o) => o.value === currentLH)
  const displayLabel = match ? match.label : currentLH

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Line height"
        className="flex items-center gap-0.5 px-2 py-1.5 text-xs border rounded hover:bg-gray-50 transition-colors"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="21" y1="6" x2="9" y2="6" />
          <line x1="21" y1="12" x2="9" y2="12" />
          <line x1="21" y1="18" x2="9" y2="18" />
          <polyline points="4 8 4 4 4 8" />
          <line x1="4" y1="4" x2="4" y2="20" />
          <polyline points="4 16 4 20 4 16" />
        </svg>
        <span>{displayLabel}</span>
        <ChevronDown className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg z-50 min-w-[80px]">
          {LINE_HEIGHT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 transition-colors ${
                currentLH === option.value ? 'bg-gray-200 font-medium' : ''
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
