export default function ContractViewPage({ params }: { params: { id: string } }) {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Contract View</h1>
      <p className="text-muted-foreground">Contract ID: {params.id}</p>
      <p className="text-muted-foreground">Contract view page - to be implemented</p>
    </div>
  )
}
