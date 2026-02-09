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

    // Only allow access to templates created in the new app
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .eq('variables->>created_in_new_app', 'true') // Filter by tag
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

    // Ensure variables tag is preserved when updating
    // Only merge if variables is provided, otherwise keep existing
    const updateData: ContractTemplateUpdate = body.variables !== undefined
      ? {
          ...body,
          variables: {
            ...(body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables)
              ? body.variables
              : {}),
            app_version: 'nextjs',
            created_in_new_app: true,
          },
        }
      : body

    const { data, error } = await supabase
      .from('contract_templates')
      // @ts-ignore - Supabase type inference limitation with complex query chains
      .update(updateData as Database['public']['Tables']['contract_templates']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('variables->>created_in_new_app', 'true') // Only allow updating new app templates
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
      // @ts-ignore - Supabase type inference limitation with complex query chains
      .update({ deleted_at: new Date().toISOString() } as Database['public']['Tables']['contract_templates']['Update'])
      .eq('id', id)
      .eq('created_by', user.id)
      .eq('variables->>created_in_new_app', 'true') // Only allow deleting new app templates

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
