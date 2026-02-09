'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Editor from '@/components/contract-editor/Editor'
import type { JSONContent } from '@tiptap/core'
import type { Contract } from '@/types/contract'
import { Save, Trash2, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function ContractEditPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  
  const [contract, setContract] = useState<Contract | null>(null)
  const [contractName, setContractName] = useState('')
  const [contractDescription, setContractDescription] = useState('')
  const [content, setContent] = useState<JSONContent | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Auto-save debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedContentRef = useRef<string>('')

  // Load contract
  useEffect(() => {
    loadContract()
  }, [contractId])

  const loadContract = async () => {
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
      
      // Parse content from JSONB
      const contractContent = loadedContract.content as JSONContent
      setContent(contractContent || {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      })
      
      // Store initial content for comparison
      lastSavedContentRef.current = JSON.stringify(contractContent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

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
          content: content,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save contract')
      }

      const result = await response.json()
      setContract(result.data)
      lastSavedContentRef.current = JSON.stringify(content)
      
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
  }, [contract, contractId, contractName, contractDescription, content])

  // Auto-save on content change (debounced)
  useEffect(() => {
    if (!contract || loading || contract.status === 'final') return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Check if content actually changed
    const currentContent = JSON.stringify(content)
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
  }, [content, contract, loading, saveContract])

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

  const handleManualSave = () => {
    saveContract(true)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${contractName}"? This action cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete contract')
      }

      router.push('/contracts')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete contract')
      setIsDeleting(false)
    }
  }

  const handleContentChange = (newContent: JSONContent) => {
    setContent(newContent)
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

            {!isFinalized && (
              <>
                <button
                  onClick={handleManualSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>

                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </>
            )}
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
        />
      </div>
    </div>
  )
}
