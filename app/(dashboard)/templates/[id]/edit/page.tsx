'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Editor from '@/components/contract-editor/Editor'
import type { JSONContent } from '@tiptap/core'

export default function TemplateEditPage() {
  const params = useParams()
  const templateId = params.id as string
  const [content, setContent] = useState<JSONContent | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  // Load template content (placeholder for now)
  useEffect(() => {
    // TODO: Fetch template from API
    setLoading(false)
    setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Start editing your template...',
            },
          ],
        },
      ],
    })
  }, [templateId])

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
    // TODO: Auto-save or debounced save
    // Content changed - will implement auto-save later
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading template...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Edit Template</h1>
        <p className="text-muted-foreground">Template ID: {templateId}</p>
      </div>

      <div className="space-y-4">
        <Editor
          content={content}
          mode="template"
          onChange={handleContentChange}
          editable={true}
          showToolbar={true}
        />
      </div>
    </div>
  )
}
