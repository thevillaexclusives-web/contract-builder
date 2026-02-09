import { createClient } from '@/lib/supabase/server'
import Header from '@/components/Header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen">
      <Header
        userEmail={user?.email}
        userName={user?.user_metadata?.display_name}
      />
      <main>{children}</main>
    </div>
  )
}
