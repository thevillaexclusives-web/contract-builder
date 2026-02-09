import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ContractInsert } from '@/types/contract'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch contracts', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body: Omit<ContractInsert, 'created_by'> = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        ...body,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create contract', details: errorMessage },
      { status: 500 }
    )
  }
}
