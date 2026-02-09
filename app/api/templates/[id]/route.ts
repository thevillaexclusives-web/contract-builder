import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ContractTemplateUpdate } from '@/types/contract'
import type { Database } from '@/types/database'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch template' },
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
    const body: ContractTemplateUpdate = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('contract_templates')
      .update(body as Database['public']['Tables']['contract_templates']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update template' },
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
      .from('contract_templates')
      .update({ deleted_at: new Date().toISOString() } as Database['public']['Tables']['contract_templates']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
