// TipTap and editor types

import type { JSONContent, Editor } from '@tiptap/core'

export type EditorMode = 'template' | 'contract' | 'readonly'

export type ActiveRegion = 'body' | 'header' | 'footer'

export interface EditorProps {
  content?: JSONContent
  mode?: EditorMode
  onChange?: (content: JSONContent) => void
  editable?: boolean
  className?: string
  headerContent?: JSONContent
  footerContent?: JSONContent
  onHeaderChange?: (content: JSONContent) => void
  onFooterChange?: (content: JSONContent) => void
  onActiveEditorChange?: (editor: Editor | null) => void
}

export interface EditorRef {
  getContent: () => JSONContent
  setContent: (content: JSONContent) => void
  clear: () => void
  getAllContent: () => { body: JSONContent; header: JSONContent; footer: JSONContent }
}
