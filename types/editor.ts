// TipTap and editor types

import { JSONContent } from '@tiptap/core'

export type EditorMode = 'template' | 'contract' | 'readonly'

export interface EditorProps {
  content?: JSONContent
  mode?: EditorMode
  onChange?: (content: JSONContent) => void
  editable?: boolean
  className?: string
}

export interface EditorRef {
  getContent: () => JSONContent
  setContent: (content: JSONContent) => void
  clear: () => void
}
