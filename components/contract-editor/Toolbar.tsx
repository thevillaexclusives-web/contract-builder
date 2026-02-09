'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Table,
} from 'lucide-react'
import ListStyleDropdown from './ListStyleDropdown'

interface ToolbarProps {
  editor: Editor | null
}

// Memoized Button component to prevent unnecessary re-renders
const ToolbarButton = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-2 rounded hover:bg-gray-100 transition-colors
      ${isActive ? 'bg-gray-200' : ''}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    {children}
  </button>
)

export default function Toolbar({ editor }: ToolbarProps) {
  // Force re-render on editor state changes using a counter
  const [, setUpdateCounter] = useState(0)

  useEffect(() => {
    if (!editor) return

    // Update toolbar state on selection or transaction changes
    const updateToolbar = () => {
      setUpdateCounter((prev) => prev + 1)
    }

    editor.on('selectionUpdate', updateToolbar)
    editor.on('transaction', updateToolbar)

    return () => {
      editor.off('selectionUpdate', updateToolbar)
      editor.off('transaction', updateToolbar)
    }
  }, [editor])

  // Memoize command handlers to prevent recreation on every render
  // All hooks must be called before any early returns
  const handleBold = useCallback(() => {
    editor?.chain().focus().toggleBold().run()
  }, [editor])

  const handleItalic = useCallback(() => {
    editor?.chain().focus().toggleItalic().run()
  }, [editor])

  const handleStrike = useCallback(() => {
    editor?.chain().focus().toggleStrike().run()
  }, [editor])

  const handleHeading = useCallback(
    (level: 1 | 2 | 3) => () => {
      editor?.chain().focus().toggleHeading({ level }).run()
    },
    [editor]
  )

  const handleBulletList = useCallback(() => {
    editor?.chain().focus().toggleBulletList().run()
  }, [editor])

  const handleBlockquote = useCallback(() => {
    editor?.chain().focus().toggleBlockquote().run()
  }, [editor])

  const handleInsertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const handleUndo = useCallback(() => {
    editor?.chain().focus().undo().run()
  }, [editor])

  const handleRedo = useCallback(() => {
    editor?.chain().focus().redo().run()
  }, [editor])

  // Early return AFTER all hooks
  if (!editor) {
    return null
  }

  // Calculate active states - recalculated on every render
  // The useEffect above ensures this component re-renders on editor state changes
  const activeStates = {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    strike: editor.isActive('strike'),
    heading1: editor.isActive('heading', { level: 1 }),
    heading2: editor.isActive('heading', { level: 2 }),
    heading3: editor.isActive('heading', { level: 3 }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    blockquote: editor.isActive('blockquote'),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
  }

  return (
    <div className="border-b p-2 flex flex-wrap items-center gap-1 bg-gray-50">
      {/* Text Formatting */}
      <ToolbarButton onClick={handleBold} isActive={activeStates.bold} title="Bold">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleItalic} isActive={activeStates.italic} title="Italic">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleStrike} isActive={activeStates.strike} title="Strikethrough">
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Headings */}
      <ToolbarButton onClick={handleHeading(1)} isActive={activeStates.heading1} title="Heading 1">
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleHeading(2)} isActive={activeStates.heading2} title="Heading 2">
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleHeading(3)} isActive={activeStates.heading3} title="Heading 3">
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Lists */}
      <ToolbarButton onClick={handleBulletList} isActive={activeStates.bulletList} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ListStyleDropdown editor={editor} isActive={activeStates.orderedList} />
      <ToolbarButton onClick={handleBlockquote} isActive={activeStates.blockquote} title="Quote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Table */}
      <ToolbarButton onClick={handleInsertTable} title="Insert Table">
        <Table className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Undo/Redo */}
      <ToolbarButton onClick={handleUndo} disabled={!activeStates.canUndo} title="Undo">
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleRedo} disabled={!activeStates.canRedo} title="Redo">
        <Redo className="w-4 h-4" />
      </ToolbarButton>
    </div>
  )
}
