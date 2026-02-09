export default function TemplateViewPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Template View</h1>
      <p className="text-muted-foreground">Template ID: {params.id}</p>
      <p className="text-muted-foreground">Template view page - to be implemented</p>
    </div>
  )
}
