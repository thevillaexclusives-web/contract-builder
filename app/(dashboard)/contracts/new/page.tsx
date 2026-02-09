'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { ContractTemplate } from '@/types/contract'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewContractPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<ContractTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [contractName, setContractName] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/templates')
      
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const result = await response.json()
      setTemplates(result.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedTemplateId) {
      alert('Please select a template')
      return
    }

    if (!contractName.trim()) {
      alert('Please enter a contract name')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: selectedTemplateId,
          name: contractName.trim(),
          description: null,
          status: 'draft',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create contract')
      }

      const result = await response.json()
      // Redirect to edit page after creation
      router.push(`/contracts/${result.data.id}/edit`)
    } catch (error) {
      console.error('Error creating contract:', error)
      alert(error instanceof Error ? error.message : 'Failed to create contract. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Contracts
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Create New Contract</h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="border border-gray-200 rounded-lg p-8 bg-white text-center">
            <p className="text-gray-700 mb-4">No templates available</p>
            <p className="text-sm text-gray-500 mb-4">
              You need to create a template first before creating a contract
            </p>
            <Link
              href="/templates/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Create Template
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label htmlFor="template-select" className="block text-sm font-medium text-gray-700 mb-2">
                Select Template *
              </label>
              <select
                id="template-select"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.description && ` - ${template.description}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="contract-name" className="block text-sm font-medium text-gray-700 mb-2">
                Contract Name *
              </label>
              <input
                id="contract-name"
                type="text"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="Enter contract name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-4">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !selectedTemplateId || !contractName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Contract'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
