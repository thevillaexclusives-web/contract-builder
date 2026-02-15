import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { renderContractHtml } from '@/lib/export/renderContractHtml'
import { parseContent } from '@/lib/content-shape'

export const runtime = 'nodejs'

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

    // Get contract content (envelope or legacy doc)
    const rawContent = (contract as any).content
    const contractName = (contract as any).name as string

    if (!rawContent) {
      return NextResponse.json(
        { error: 'Contract content is empty' },
        { status: 400 }
      )
    }

    const envelope = parseContent(rawContent)

    // Render TipTap JSON to full HTML document (with header/footer if present)
    const html = renderContractHtml(envelope.body, contractName, envelope.header, envelope.footer)

    console.log('🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶🌶');
    console.log('html:', html);

    // Launch Puppeteer
    let browser
    try {
      if (process.env.NODE_ENV === 'development') {
        // Dev: use local puppeteer
        const puppeteer = await import('puppeteer')
        browser = await puppeteer.default.launch({ headless: true })
      } else {
        // Production / Vercel: use puppeteer-core + @sparticuz/chromium
        const puppeteerCore = await import('puppeteer-core')
        const chromium = await import('@sparticuz/chromium')
        browser = await puppeteerCore.default.launch({
          args: chromium.default.args,
          executablePath: await chromium.default.executablePath(),
          headless: true,
        })
      }

      const page = await browser.newPage()
      await page.setViewport({ width: 1200, height: 800 })
      await page.setContent(html, { waitUntil: 'networkidle0' })
      await page.emulateMediaType('print')

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      })

      const body = Buffer.from(pdf)

      return new NextResponse(body, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${contractName || 'contract'}.pdf"`,
        },
      })
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  } catch (error) {
    console.error('PDF export error:', error)
    return NextResponse.json(
      { error: 'Failed to export PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
