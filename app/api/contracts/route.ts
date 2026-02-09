import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ContractInsert } from '@/types/contract'

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only show contracts created in the new app (have the tag)
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .eq('variable_values->>created_in_new_app', 'true') // Filter by tag
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

    // If template_id is provided, validate it's from the new app
    if (body.template_id) {
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('id, content')
        .eq('id', body.template_id)
        .is('deleted_at', null)
        .eq('variables->>created_in_new_app', 'true')
        .single()

      if (templateError || !template) {
        return NextResponse.json(
          { error: 'Template not found or not available. Only templates created in the new app can be used.' },
          { status: 400 }
        )
      }

      // If content is not provided, use template content
      if (!body.content) {
        body.content = template.content as any
      }
    }

    // Add metadata tag to indicate this contract was created in the new app
    const existingVariableValues = body.variable_values && typeof body.variable_values === 'object' && !Array.isArray(body.variable_values)
      ? body.variable_values
      : {}
    
    const contractData = {
      ...body,
      created_by: user.id,
      status: body.status || 'draft',
      variable_values: {
        ...existingVariableValues,
        app_version: 'nextjs',
        created_in_new_app: true,
      },
    }

    const { data, error } = await supabase
      .from('contracts')
      .insert(contractData)
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
