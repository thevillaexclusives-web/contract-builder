'use client'

import { useParams } from 'next/navigation'

export default function TemplateViewPage() {
  const params = useParams()
  const templateId = params.id as string

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Template View</h1>
      <p className="text-muted-foreground">Template ID: {templateId}</p>
      <p className="text-muted-foreground">Template view page - to be implemented</p>
    </div>
  )
}
