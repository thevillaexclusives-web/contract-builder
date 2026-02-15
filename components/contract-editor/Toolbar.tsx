'use client'

import { Editor } from '@tiptap/core'
import { useCallback, useMemo, useState, useEffect } from 'react'
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
  FileText,
  Rows3,
  Columns3,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import ListStyleDropdown from './ListStyleDropdown'
import TextAlignDropdown from './TextAlignDropdown'
import FontSizeDropdown from './FontSizeDropdown'
import FontFamilyDropdown from './FontFamilyDropdown'
import FieldInsertDropdown from './FieldInsertDropdown'

interface ToolbarProps {
  editor: Editor | null
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

  const handleAddRowBefore = useCallback(() => {
    editor?.chain().focus().addRowBefore().run()
  }, [editor])

  const handleAddRowAfter = useCallback(() => {
    editor?.chain().focus().addRowAfter().run()
  }, [editor])

  const handleDeleteRow = useCallback(() => {
    editor?.chain().focus().deleteRow().run()
  }, [editor])

  const handleAddColumnBefore = useCallback(() => {
    editor?.chain().focus().addColumnBefore().run()
  }, [editor])

  const handleAddColumnAfter = useCallback(() => {
    editor?.chain().focus().addColumnAfter().run()
  }, [editor])

  const handleDeleteColumn = useCallback(() => {
    editor?.chain().focus().deleteColumn().run()
  }, [editor])

  const handleDeleteTable = useCallback(() => {
    editor?.chain().focus().deleteTable().run()
  }, [editor])

  const handlePageBreak = useCallback(() => {
    editor?.chain().focus().setPageBreak().run()
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

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Text Alignment */}
      <TextAlignDropdown editor={editor} />

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

      {editor.isActive('table') && (
        <>
          <ToolbarButton onClick={handleAddRowBefore} title="Add Row Above">
            <Rows3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleAddRowAfter} title="Add Row Below">
            <Rows3 className="w-4 h-4 rotate-180" />
          </ToolbarButton>
          <ToolbarButton onClick={handleDeleteRow} title="Delete Row">
            <Rows3 className="w-4 h-4 text-red-500" />
          </ToolbarButton>
          <ToolbarButton onClick={handleAddColumnBefore} title="Add Column Left">
            <Columns3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleAddColumnAfter} title="Add Column Right">
            <Columns3 className="w-4 h-4 rotate-180" />
          </ToolbarButton>
          <ToolbarButton onClick={handleDeleteColumn} title="Delete Column">
            <Columns3 className="w-4 h-4 text-red-500" />
          </ToolbarButton>
          <ToolbarButton onClick={handleDeleteTable} title="Delete Table">
            <Trash2 className="w-4 h-4 text-red-500" />
          </ToolbarButton>
        </>
      )}

      {/* Field Insert */}
      <FieldInsertDropdown editor={editor} />

      <div className="w-px h-6 bg-gray-300 mx-1" />

      {/* Page Break */}
      <ToolbarButton onClick={handlePageBreak} title="Insert Page Break (Ctrl+Enter)">
        <FileText className="w-4 h-4" />
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
