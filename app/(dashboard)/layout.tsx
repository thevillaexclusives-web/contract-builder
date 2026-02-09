import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Contract Editor</h1>
            <div className="flex gap-4">
              <Link href="/templates" className="text-sm hover:underline">
                Templates
              </Link>
              <Link href="/contracts" className="text-sm hover:underline">
                Contracts
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
