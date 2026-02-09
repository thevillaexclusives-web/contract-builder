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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow access to contracts created in the new app
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .eq('variable_values->>created_in_new_app', 'true') // Filter by tag
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

    // Check if contract is already finalized
    const { data: existingContract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    // If contract is already finalized and we're not just finalizing it, prevent update
    if (existingContract && (existingContract as { status?: string }).status === 'final' && body.status !== 'final') {
      return NextResponse.json(
        { error: 'Cannot update finalized contract' },
        { status: 400 }
      )
    }

    // Ensure variable_values tag is preserved when updating
    // Only merge if variable_values is provided, otherwise keep existing
    const updateData: ContractUpdate = body.variable_values !== undefined
      ? {
          ...body,
          variable_values: {
            ...(body.variable_values && typeof body.variable_values === 'object' && !Array.isArray(body.variable_values)
              ? body.variable_values
              : {}),
            app_version: 'nextjs',
            created_in_new_app: true,
          },
        }
      : body

    const { data, error } = await supabase
      .from('contracts')
      // @ts-ignore - Supabase type inference limitation with complex query chains
      .update(updateData as Database['public']['Tables']['contracts']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('variable_values->>created_in_new_app', 'true') // Only allow updating new app contracts
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
      // @ts-ignore - Supabase type inference limitation with complex query chains
      .update({ deleted_at: new Date().toISOString() } as Database['public']['Tables']['contracts']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('variable_values->>created_in_new_app', 'true') // Only allow deleting new app contracts

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete contract' },
      { status: 500 }
    )
  }
}
