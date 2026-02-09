import Link from 'next/link'

export default function TemplatesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
        <Link
          href="/templates/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Create Template
        </Link>
      </div>

      <div className="border border-gray-200 rounded-lg p-8 bg-white shadow-sm">
        <p className="text-gray-700 text-center text-lg">
          Templates list page - to be implemented
        </p>
        <p className="text-sm text-gray-500 text-center mt-2">
          This page will display all your contract templates
        </p>
      </div>
    </div>
  )
}
