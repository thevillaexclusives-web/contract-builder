'use client'

import { BubbleMenu, Editor } from '@tiptap/react'
import {
  Rows3,
  Columns3,
  Trash2,
} from 'lucide-react'

interface TableBubbleMenuProps {
  editor: Editor
}

function Btn({
  onClick,
  title,
  children,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded hover:bg-gray-200 transition-colors"
    >
      {children}
    </button>
  )
}

export default function TableBubbleMenu({ editor }: TableBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ placement: 'top', appendTo: 'parent' }}
      shouldShow={({ editor }) =>
        editor.isActive('table') ||
        editor.isActive('tableCell') ||
        editor.isActive('tableHeader')
      }
    >
      <div className="flex items-center gap-0.5 bg-white border rounded shadow-md px-1 py-0.5">
        <Btn
          onClick={() => editor.chain().focus().addRowBefore().run()}
          title="Add Row Above"
        >
          <Rows3 className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="Add Row Below"
        >
          <Rows3 className="w-4 h-4 rotate-180" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().deleteRow().run()}
          title="Delete Row"
        >
          <Rows3 className="w-4 h-4 text-red-500" />
        </Btn>

        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        <Btn
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="Add Column Left"
        >
          <Columns3 className="w-4 h-4" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="Add Column Right"
        >
          <Columns3 className="w-4 h-4 rotate-180" />
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().deleteColumn().run()}
          title="Delete Column"
        >
          <Columns3 className="w-4 h-4 text-red-500" />
        </Btn>

        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        <Btn
          onClick={() => editor.chain().focus().deleteTable().run()}
          title="Delete Table"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Btn>
      </div>
    </BubbleMenu>
  )
}
