'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/contract-editor-v2/Editor'
import type { JSONContent } from '@tiptap/core'
import type { Contract } from '@/types/contract'
import { parseContent, serializeContent } from '@/lib/content-shape'
import { Save, ArrowLeft, CheckCircle2, AlertCircle, Loader2, FileDown, RefreshCw } from 'lucide-react'
import Link from 'next/link'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** Walk a TipTap JSON tree and collect field id -> value mappings. */
function collectFieldValues(doc: JSONContent | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!doc) return map
  function walk(node: JSONContent) {
    if (node.type === 'field' && node.attrs?.id && node.attrs.value) {
      map.set(node.attrs.id, node.attrs.value)
    }
    node.content?.forEach(walk)
  }
  walk(doc)
  return map
}

/** Walk a TipTap JSON tree and inject field values from a map, returning a new tree. */
function injectFieldValues(doc: JSONContent, values: Map<string, string>): JSONContent {
  function walk(node: JSONContent): JSONContent {
    if (node.type === 'field' && node.attrs?.id && values.has(node.attrs.id)) {
      return { ...node, attrs: { ...node.attrs, value: values.get(node.attrs.id) } }
    }
    if (node.content) {
      return { ...node, content: node.content.map(walk) }
    }
    return node
  }
  return walk(doc)
}

export default function ContractEditPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string

  const [contract, setContract] = useState<Contract | null>(null)
  const [contractName, setContractName] = useState('')
  const [contractDescription, setContractDescription] = useState('')
  const [content, setContent] = useState<JSONContent | undefined>(undefined)
  const [headerContent, setHeaderContent] = useState<JSONContent | undefined>(undefined)
  const [footerContent, setFooterContent] = useState<JSONContent | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [templateName, setTemplateName] = useState<string | null>(null)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')

  const loadContract = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/contracts/${contractId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Contract not found')
        }
        throw new Error('Failed to load contract')
      }

      const result = await response.json()
      const loadedContract = result.data as Contract
      
      setContract(loadedContract)
      setContractName(loadedContract.name)
      setContractDescription(loadedContract.description || '')
      
      // Parse content envelope (backward compatible)
      const envelope = parseContent(loadedContract.content)
      setContent(envelope.body)
      setHeaderContent(envelope.header)
      setFooterContent(envelope.footer)

      // Store initial content for comparison
      lastSavedContentRef.current = JSON.stringify(envelope)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
    } finally {
      setLoading(false)
    }
  }, [contractId])

  // Load contract
  useEffect(() => {
    loadContract()
  }, [loadContract])

  // Save contract
  const saveContract = useCallback(async (showStatus = true) => {
    if (!contract || contract.status === 'final') return

    try {
      if (showStatus) {
        setSaveStatus('saving')
      }

      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: contractName,
          description: contractDescription || null,
          content: serializeContent(content, headerContent, footerContent),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save contract')
      }

      const result = await response.json()
      setContract(result.data)
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
      console.error('Error saving contract:', err)
    }
  }, [contract, contractId, contractName, contractDescription, content, headerContent, footerContent])

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!contract || loading || contract.status === 'final') return

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
      saveContract(false) // Silent save (no status indicator)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, headerContent, footerContent, contract, loading, saveContract])

  // Auto-save on name/description change (debounced)
  useEffect(() => {
    if (!contract || loading || contract.status === 'final') return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveContract(false)
    }, 2000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [contractName, contractDescription, contract, loading, saveContract])

  // Fetch template name when contract loads
  useEffect(() => {
    if (!contract?.template_id) return
    fetch(`/api/templates/${contract.template_id}`)
      .then((res) => res.ok ? res.json() : null)
      .then((result) => {
        if (result?.data?.name) setTemplateName(result.data.name)
      })
      .catch(() => {})
  }, [contract?.template_id])

  // Ctrl+S / Cmd+S keyboard shortcut to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveContract(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [saveContract])

  const handleManualSave = () => {
    saveContract(true)
  }

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
  }

  // Sync with template: pull template structure, preserve field values
  const handleSyncWithTemplate = async () => {
    if (!contract?.template_id) return
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/templates/${contract.template_id}`)
      if (!res.ok) throw new Error('Failed to fetch template')
      const result = await res.json()
      const tplEnvelope = parseContent(result.data.content)

      // Collect current field values from all sections
      const bodyValues = collectFieldValues(content)
      const headerValues = collectFieldValues(headerContent)
      const footerValues = collectFieldValues(footerContent)

      // Inject preserved values into the fresh template content
      setContent(injectFieldValues(tplEnvelope.body, bodyValues))
      setHeaderContent(injectFieldValues(tplEnvelope.header, headerValues))
      setFooterContent(injectFieldValues(tplEnvelope.footer, footerValues))

      setShowSyncModal(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to sync with template')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleExportPDF = async () => {
    if (!contract) return

    setIsExporting(true)
    try {
      const response = await fetch(`/api/export/${contractId}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to export PDF' }))
        throw new Error(errorData.error || 'Failed to export PDF')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${contract.name || 'contract'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export PDF')
      console.error('Error exporting PDF:', err)
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading contract...</p>
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
                <h3 className="text-lg font-semibold text-red-900 mb-1">Error Loading Contract</h3>
                <p className="text-red-700">{error}</p>
                <Link
                  href="/contracts"
                  className="mt-4 inline-block text-sm text-red-600 hover:text-red-800 underline"
                >
                  ← Back to Contracts
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!contract) {
    return null
  }

  const isFinalized = contract.status === 'final'

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contracts
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <input
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="Contract Name"
                disabled={isFinalized}
                className="text-3xl font-bold bg-transparent border-none outline-none focus:ring-0 p-0 w-full disabled:opacity-50"
              />
              {isFinalized && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Finalized
                </span>
              )}
            </div>
            <input
              type="text"
              value={contractDescription}
              onChange={(e) => setContractDescription(e.target.value)}
              placeholder="Add a description (optional)"
              disabled={isFinalized}
              className="text-sm text-gray-500 bg-transparent border-none outline-none focus:ring-0 p-0 w-full disabled:opacity-50"
            />
            {templateName && (
              <p className="text-xs text-gray-400 mt-1">
                Based on template: <span className="font-medium text-gray-500">{templateName}</span>
              </p>
            )}
          </div>

          {/* Save Status & Actions */}
          <div className="flex items-center gap-3">
     
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Changes saved</span>
              </div>
            )}
            
            {saveStatus === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>Save failed</span>
              </div>
            )}

            {!isFinalized && (
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
            )}

            {/**!isFinalized && contract?.template_id && (
              <button
                onClick={() => setShowSyncModal(true)}
                className="px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync with Template
                  </>
                )}
              </button>
            ) **/}

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  Export PDF
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
          mode="contract"
          onChange={handleContentChange}
          editable={!isFinalized}
          showToolbar={!isFinalized}
          headerContent={headerContent}
          footerContent={footerContent}
          onHeaderChange={setHeaderContent}
          onFooterChange={setFooterContent}
        />
      </div>

      {/* Sync with Template confirmation modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sync with Template</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will replace the contract&apos;s structure and styling with the latest version of the template.
              Your filled-in field values will be preserved, but any manual text or layout edits made directly in the contract may be overwritten.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncWithTemplate}
                disabled={isSyncing}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
