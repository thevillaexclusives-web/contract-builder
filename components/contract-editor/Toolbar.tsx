'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useState, useEffect } from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Underline as UnderlineIcon,
  List,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo,
  Redo,
  Table,
  IndentIncrease,
  IndentDecrease,
} from 'lucide-react'
import type { EditorMode } from '@/types/editor'
import ListStyleDropdown from './ListStyleDropdown'
import TextAlignDropdown from './TextAlignDropdown'
import FontSizeDropdown from './FontSizeDropdown'
import FontFamilyDropdown from './FontFamilyDropdown'
import FieldInsertDropdown from './FieldInsertDropdown'
import LineHeightDropdown from './LineHeightDropdown'

interface ToolbarProps {
  editor: Editor | null
  mode?: EditorMode
}

// Memoized Button component to prevent unnecessary re-renders
export const ToolbarButton = ({
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

export default function Toolbar({ editor, mode = 'template' }: ToolbarProps) {
  const isContract = mode === 'contract'
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

  const handleUnderline = useCallback(() => {
    editor?.chain().focus().toggleUnderline().run()
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

  const handleIndent = useCallback(() => {
    editor?.chain().focus().sinkListItem('listItem').run()
  }, [editor])

  const handleOutdent = useCallback(() => {
    editor?.chain().focus().liftListItem('listItem').run()
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
    underline: editor.isActive('underline'),
    heading1: editor.isActive('heading', { level: 1 }),
    heading2: editor.isActive('heading', { level: 2 }),
    heading3: editor.isActive('heading', { level: 3 }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    blockquote: editor.isActive('blockquote'),
    canUndo: editor.can().undo(),
    canRedo: editor.can().redo(),
    canIndent: editor.can().sinkListItem('listItem'),
    canOutdent: editor.can().liftListItem('listItem'),
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
      <ToolbarButton onClick={handleUnderline} isActive={activeStates.underline} title="Underline">
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Font Controls */}
      <FontFamilyDropdown editor={editor} />
      <FontSizeDropdown editor={editor} />
      <LineHeightDropdown editor={editor} />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text Alignment */}
      <TextAlignDropdown editor={editor} />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Indent / Outdent */}
      <ToolbarButton onClick={handleOutdent} disabled={!activeStates.canOutdent} title="Decrease Indent (Shift+Tab)">
        <IndentDecrease className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={handleIndent} disabled={!activeStates.canIndent} title="Increase Indent (Tab)">
        <IndentIncrease className="w-4 h-4" />
      </ToolbarButton>

      {!isContract && (
        <>
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

          {/* Field Insert */}
          <FieldInsertDropdown editor={editor} />
        </>
      )}

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
