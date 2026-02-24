import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import { FontFamily } from '@tiptap/extension-font-family'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontSize } from '@tiptap/extension-font-size'
import { CustomOrderedList } from '@/components/contract-editor/extensions/custom-ordered-list'
import { FieldNode } from '@/components/contract-editor/extensions/field-node'
import { PageBreak } from '@/components/contract-editor/extensions/page-break'
import type { Extensions } from '@tiptap/core'

/**
 * Returns the shared set of TipTap extensions for the editor.
 */
export function createSharedExtensions(): Extensions {
  return [
    StarterKit.configure({
      orderedList: false,
    }),
    CustomOrderedList,
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TextStyle,
    FontFamily,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    FontSize,
    FieldNode,
    PageBreak,
  ]
}
