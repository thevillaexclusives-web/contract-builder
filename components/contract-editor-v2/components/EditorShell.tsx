import React, { useMemo } from 'react'
import { EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { PAGE_CONFIG } from '../config/pageConfig'
import { PagesOverlay } from './PagesOverlay'

interface EditorShellProps {
  editor: Editor
  pageCount: number
}

export function EditorShell({ editor, pageCount }: EditorShellProps) {
  const minHeight = useMemo(
    () => pageCount * PAGE_CONFIG.height + (pageCount - 1) * PAGE_CONFIG.gap,
    [pageCount]
  )

  return (
    <div className="editor-v2-container">
      <div className="editor-v2-shell" style={{ minHeight }}>
        <PagesOverlay pageCount={pageCount} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
