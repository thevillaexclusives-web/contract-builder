import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ContractTemplateInsert } from '@/types/contract'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only show templates created in the new app (have the tag)
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .eq('variables->>created_in_new_app', 'true') // Filter by tag
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch templates', details: errorMessage },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body: Omit<ContractTemplateInsert, 'created_by'> = await request.json()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add metadata tag to indicate this template was created in the new app
    const existingVariables = body.variables && typeof body.variables === 'object' && !Array.isArray(body.variables)
      ? body.variables
      : {}
    
    const templateData = {
      ...body,
      created_by: user.id,
      variables: {
        ...existingVariables,
        app_version: 'nextjs',
        created_in_new_app: true,
      },
    }

    const { data, error } = await supabase
      .from('contract_templates')
      // @ts-ignore - Supabase type inference limitation with complex query chains
      .insert(templateData)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ data })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to create template', details: errorMessage },
      { status: 500 }
    )
  }
}
