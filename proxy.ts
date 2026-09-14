import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { decodeUserFromCookies } from '@/lib/supabase/cookie-auth-helper'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Fast-path: Check if there are any Supabase auth cookies in the incoming request
  const allCookies = request.cookies.getAll()
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes('-auth-token') || c.name.startsWith('sb-')
  )

  // If there is no auth cookie at all:
  if (!hasAuthCookie) {
    // Only /profesor requires authentication
    if (pathname.startsWith('/profesor')) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
    // Public routes (/actividad, /curso, /, etc.): pass through immediately
    return NextResponse.next({ request })
  }

  // Session exists: Initialize SSR client to refresh session cookies
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session safely (handles offline network failures gracefully)
  let user = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (data && data.user && !error) {
      user = data.user
    }
  } catch (err) {
    // Supabase cloud unreachable (offline)
  }

  // Offline fallback: decode user from cookies
  if (!user && hasAuthCookie) {
    user = (decodeUserFromCookies(allCookies) as any) ?? null
  }

  // Protected: /profesor/*
  if (pathname.startsWith('/profesor')) {
    const isProf =
      user?.user_metadata?.rol === 'profesor' ||
      user?.role === 'profesor' ||
      user?.app_metadata?.rol === 'profesor'

    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
