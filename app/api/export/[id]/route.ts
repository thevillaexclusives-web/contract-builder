import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Test route to verify routing works
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return NextResponse.json({ message: 'Export route is working', contractId: id })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json({ error: 'Contract ID is required' }, { status: 400 })
    }
    
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
      .eq('id', id)
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .single()

    if (error) throw error

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Get contract content (TipTap JSON)
    const content = (contract as any).content
    const contractName = (contract as any).name as string
    
    if (!content) {
      return NextResponse.json(
        { error: 'Contract content is empty' },
        { status: 400 }
      )
    }

    // Debug: Log the contract content structure
    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Contract Content Structure:')
      console.log('📋 Content type:', content?.type)
      console.log('📋 Content children count:', content?.content?.length)
      console.log('📋 First few nodes:', JSON.stringify(content?.content?.slice(0, 3), null, 2))
      
      // Check for field nodes
      const findFields = (node: any): any[] => {
        const fields: any[] = []
        if (node.type === 'field') {
          fields.push(node)
        }
        if (node.content) {
          for (const child of node.content) {
            fields.push(...findFields(child))
          }
        }
        return fields
      }
      const fields = findFields(content)
      console.log('📋 Found fields:', fields.length)
      if (fields.length > 0) {
        console.log('📋 First field:', JSON.stringify(fields[0], null, 2))
      }
    }

    // Dynamic imports for PDF generation (load only when needed)
    const [{ mapTipTapToPDFMake }] = await Promise.all([
      import('@/lib/pdf/mapper'),
    ])

    // Use require for PDFMake to avoid bundling issues
    // eslint-disable-next-line
    const pdfmake = require('pdfmake')
    
    // Use standard fonts that come with PDFKit (no external files needed)
    // These are the built-in fonts available in PDFKit/PDFMake
    const standardFonts = {
      Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic',
      },
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
      Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
        italics: 'Courier-Oblique',
        bolditalics: 'Courier-BoldOblique',
      },
    }

    // Create printer with fonts and empty VFS to prevent file access
    const printer = new pdfmake(standardFonts, {})

    const docDefinition = mapTipTapToPDFMake(content, {
      title: contractName,
    })

    // Generate PDF
    const pdfDoc = printer.createPdfKitDocument(docDefinition)
    
    // Convert PDF to buffer
    const chunks: Uint8Array[] = []
    pdfDoc.on('data', (chunk: Uint8Array) => chunks.push(chunk))
    
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      pdfDoc.on('error', reject)
      pdfDoc.end()
    })

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${contractName || 'contract'}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json(
      { error: 'Failed to export PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
