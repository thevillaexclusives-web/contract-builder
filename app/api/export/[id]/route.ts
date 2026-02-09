import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch contract
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single()

    if (error) throw error

    // TODO: Implement PDF generation
    // This will use TipTap JSON → PDFMake mapping
    // For now, return placeholder
    return NextResponse.json({
      message: 'PDF export - to be implemented',
      contractId: params.id,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to export PDF' },
      { status: 500 }
    )
  }
}
