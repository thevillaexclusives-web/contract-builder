import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ContractUpdate } from '@/types/contract'
import type { Database } from '@/types/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch contract' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body: ContractUpdate = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('contracts')
      .update(body as Database['public']['Tables']['contracts']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .neq('status', 'final') // Can't update finalized contracts
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update contract' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('contracts')
      .update({ deleted_at: new Date().toISOString() } as Database['public']['Tables']['contracts']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete contract' },
      { status: 500 }
    )
  }
}
