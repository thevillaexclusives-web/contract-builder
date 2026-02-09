'use client'

import { useParams } from 'next/navigation'

export default function ContractViewPage() {
  const params = useParams()
  const contractId = params.id as string

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Contract View</h1>
      <p className="text-muted-foreground">Contract ID: {contractId}</p>
      <p className="text-muted-foreground">Contract view page - to be implemented</p>
    </div>
  )
}
