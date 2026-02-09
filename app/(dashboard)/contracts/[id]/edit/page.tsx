'use client'

import { useParams } from 'next/navigation'

export default function ContractEditPage() {
  const params = useParams()
  const contractId = params.id as string

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Edit Contract</h1>
      <p className="text-muted-foreground">Contract ID: {contractId}</p>
      <p className="text-muted-foreground">Contract editor page - to be implemented</p>
    </div>
  )
}
