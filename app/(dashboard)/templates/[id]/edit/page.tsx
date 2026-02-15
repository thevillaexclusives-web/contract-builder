'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/contract-editor-v2/Editor'
import type { JSONContent } from '@tiptap/core'
import type { ContractTemplate } from '@/types/contract'
import { parseContent, serializeContent } from '@/lib/content-shape'
import { Save, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function TemplateEditPage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string
  
  const [template, setTemplate] = useState<ContractTemplate | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [content, setContent] = useState<JSONContent | undefined>(undefined)
  const [headerContent, setHeaderContent] = useState<JSONContent | undefined>(undefined)
  const [footerContent, setFooterContent] = useState<JSONContent | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  
  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/templates/${templateId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Template not found')
        }
        throw new Error('Failed to load template')
      }

      const result = await response.json()
      const loadedTemplate = result.data as ContractTemplate
      
      setTemplate(loadedTemplate)
      setTemplateName(loadedTemplate.name)
      setTemplateDescription(loadedTemplate.description || '')
      
      // Parse content envelope (backward compatible)
      const envelope = parseContent(loadedTemplate.content)
      setContent(envelope.body)
      setHeaderContent(envelope.header)
      setFooterContent(envelope.footer)

      // Store initial content for comparison
      lastSavedContentRef.current = JSON.stringify(envelope)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }, [templateId])

  // Load template
  useEffect(() => {
    loadTemplate()
  }, [loadTemplate])

  // Save template
  const saveTemplate = useCallback(async (showStatus = true) => {
    if (!template) return

    try {
      if (showStatus) {
        setSaveStatus('saving')
      }

      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription || null,
          content: serializeContent(content, headerContent, footerContent),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save template')
      }

      const result = await response.json()
      setTemplate(result.data)
      lastSavedContentRef.current = JSON.stringify(serializeContent(content, headerContent, footerContent))
      
      if (showStatus) {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    } catch (err) {
      if (showStatus) {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
      console.error('Error saving template:', err)
    }
  }, [template, templateId, templateName, templateDescription, content, headerContent, footerContent])

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!template || loading) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Check if content actually changed
    const currentContent = JSON.stringify(serializeContent(content, headerContent, footerContent))
    if (currentContent === lastSavedContentRef.current) {
      return
    }

    // Set new timeout for auto-save (2 seconds)
    saveTimeoutRef.current = setTimeout(() => {
      saveTemplate(false) // Silent save (no status indicator)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, headerContent, footerContent, template, loading, saveTemplate])

  // Auto-save on name/description change (debounced)
  useEffect(() => {
    if (!template || loading) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTemplate(false)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [templateName, templateDescription, template, loading, saveTemplate])

  const handleManualSave = () => {
    saveTemplate(true)
  }

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading template...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-red-900 mb-1">Error Loading Template</h3>
                <p className="text-red-700">{error}</p>
                <Link
                  href="/templates"
                  className="mt-4 inline-block text-sm text-red-600 hover:text-red-800 underline"
                >
                  ← Back to Templates
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!template) {
    return null
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/templates"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Templates
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Template Name"
              className="text-3xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 w-full mb-2"
            />
            <input
              type="text"
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Add a description (optional)"
              className="text-sm text-gray-500 bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
            />
          </div>

          {/* Save Status & Actions */}
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved</span>
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>Save failed</span>
              </div>
            )}

            <button
              onClick={handleManualSave}
              className="px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="space-y-4">
        <Editor
          content={content}
          mode="template"
          onChange={handleContentChange}
          editable={true}
          showToolbar={true}
          headerContent={headerContent}
          footerContent={footerContent}
          onHeaderChange={setHeaderContent}
          onFooterChange={setFooterContent}
        />
      </div>
    </div>
  )
}
