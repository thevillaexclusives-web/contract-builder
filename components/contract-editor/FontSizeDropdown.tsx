'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useState, useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'

interface FontSizeDropdownProps {
  editor: Editor | null
}

const DEFAULT_FONT_SIZE = '16px'
const MIN_FONT_SIZE = 1
const MAX_FONT_SIZE = 400

export default function FontSizeDropdown({ editor }: FontSizeDropdownProps) {
  const [, setUpdateCounter] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return

    // Update when editor state changes
    const updateDisplay = () => {
      setUpdateCounter((prev) => prev + 1)
    }

    editor.on('selectionUpdate', updateDisplay)
    editor.on('transaction', updateDisplay)

    return () => {
      editor.off('selectionUpdate', updateDisplay)
      editor.off('transaction', updateDisplay)
    }
  }, [editor])

  const applyFontSize = useCallback(
    (size: number | string) => {
      if (!editor) return
      const numSize = typeof size === 'string' ? parseFloat(size) : size
      if (isNaN(numSize) || numSize < MIN_FONT_SIZE || numSize > MAX_FONT_SIZE) {
        return
      }
      const normalizedSize = `${numSize}px`
      editor.chain().focus().setFontSize(normalizedSize).run()
    },
    [editor]
  )

  const handleDecrease = useCallback(() => {
    if (!editor) return
    const fontSizeAttr = editor.getAttributes('textStyle')?.fontSize || editor.getAttributes('fontSize')?.fontSize
    const currentSize = fontSizeAttr || DEFAULT_FONT_SIZE
    const numSize = parseFloat(currentSize.toString().replace('px', '')) || 16
    const newSize = Math.max(MIN_FONT_SIZE, numSize - 1)
    applyFontSize(newSize)
  }, [editor, applyFontSize])

  const handleIncrease = useCallback(() => {
    if (!editor) return
    const fontSizeAttr = editor.getAttributes('textStyle')?.fontSize || editor.getAttributes('fontSize')?.fontSize
    const currentSize = fontSizeAttr || DEFAULT_FONT_SIZE
    const numSize = parseFloat(currentSize.toString().replace('px', '')) || 16
    const newSize = Math.min(MAX_FONT_SIZE, numSize + 1)
    applyFontSize(newSize)
  }, [editor, applyFontSize])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setInputValue(value)
    }
  }, [])

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const value = inputValue.trim()
        if (value) {
          applyFontSize(value)
          setIsInputFocused(false)
          setInputValue('')
        }
      } else if (e.key === 'Escape') {
        setIsInputFocused(false)
        setInputValue('')
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        handleIncrease()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleDecrease()
      }
    },
    [inputValue, applyFontSize, handleIncrease, handleDecrease]
  )

  const handleInputBlur = useCallback(() => {
    setIsInputFocused(false)
    const value = inputValue.trim()
    if (value) {
      applyFontSize(value)
    }
    setInputValue('')
  }, [inputValue, applyFontSize])

  const handleInputFocus = useCallback(() => {
    setIsInputFocused(true)
    // Set current size as input value when focusing
    if (editor && !inputValue) {
      const fontSizeAttr = editor.getAttributes('textStyle')?.fontSize || editor.getAttributes('fontSize')?.fontSize
      const currentSize = fontSizeAttr || DEFAULT_FONT_SIZE
      const numSize = currentSize.toString().replace('px', '')
      setInputValue(numSize)
    }
  }, [editor, inputValue])

  if (!editor) {
    return null
  }

  // Get font size from textStyle mark (FontSize extension stores it there)
  const fontSizeAttr = editor.getAttributes('textStyle')?.fontSize || editor.getAttributes('fontSize')?.fontSize
  const currentSize = fontSizeAttr || DEFAULT_FONT_SIZE
  
  // Normalize the size value (handle cases where it might be stored differently)
  const normalizedSize = currentSize.toString().replace(/['"]/g, '')
  // Extract just the number for display (remove 'px')
  const displaySize = normalizedSize.replace('px', '')
  
  // Show input value when focused, otherwise show current size
  const displayText = isInputFocused && inputValue !== '' ? inputValue : displaySize

  return (
    <div className="flex items-center gap-0.5 border rounded hover:bg-gray-50">
      {/* Decrease button */}
      <button
        type="button"
        onClick={handleDecrease}
        title="Decrease font size"
        className="p-1.5 hover:bg-gray-200 rounded-l transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>

      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={displayText}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        className="w-12 px-1 py-1 text-xs text-center border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent"
        style={{ minWidth: '32px' }}
      />

      {/* Increase button */}
      <button
        type="button"
        onClick={handleIncrease}
        title="Increase font size"
        className="p-1.5 hover:bg-gray-200 rounded-r transition-colors"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}
