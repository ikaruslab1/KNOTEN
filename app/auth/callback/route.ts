import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // User is confirmed and logged in, redirect to home or destination
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If error or code already used, redirect to login with status
  return NextResponse.redirect(`${origin}/login?confirmed=true`)
}
