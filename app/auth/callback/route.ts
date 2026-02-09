import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accessToken = searchParams.get('access_token')
  const refreshToken = searchParams.get('refresh_token')
  
  if (!accessToken) {
    return NextResponse.redirect(
      new URL('/login?error=no_token', request.url)
    )
  }
  
  const supabase = await createClient()
  
  // Set the session using the tokens from legacy app
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken || '',
  })
  
  if (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      new URL(`/login?error=invalid_token&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }
  
  if (!data.session) {
    return NextResponse.redirect(
      new URL('/login?error=no_session', request.url)
    )
  }
  
  // Successfully authenticated - redirect to templates page
  return NextResponse.redirect(new URL('/templates', request.url))
}
