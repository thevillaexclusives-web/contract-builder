'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Editor from '@/components/contract-editor-v2/Editor'
import type { JSONContent } from '@tiptap/core'

export default function NewTemplatePage() {
  const router = useRouter()
  const [content, setContent] = useState<JSONContent | undefined>({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
      },
    ],
  })
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
  }

  const handleSave = async () => {
    if (!templateName.trim()) {
      alert('Please enter a template name')
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName.trim(),
          description: null,
          content: content || {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save template')
      }

      const result = await response.json()
      // Redirect to edit page after creation
      router.push(`/templates/${result.data.id}/edit`)
    } catch (error) {
      console.error('Error saving template:', error)
      alert(error instanceof Error ? error.message : 'Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Create New Template</h1>
        
        <div className="mb-4">
          <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-2">
            Template Name
          </label>
          <input
            id="template-name"
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Enter template name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Editor
          content={content}
          mode="template"
          onChange={handleContentChange}
          editable={true}
          showToolbar={true}
        />

        <div className="flex justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !templateName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
