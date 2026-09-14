import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return document.cookie
            .split(';')
            .map((c) => c.trim())
            .filter(Boolean)
            .map((c) => {
              const eqIdx = c.indexOf('=')
              return {
                name: eqIdx > -1 ? c.substring(0, eqIdx).trim() : c.trim(),
                value: eqIdx > -1 ? c.substring(eqIdx + 1).trim() : '',
              }
            })
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

          cookiesToSet.forEach(({ name, value, options }) => {
            const isAuthCookie = name.includes('-auth-token') || name.startsWith('sb-')
            const isDeleting =
              options?.maxAge === 0 ||
              Boolean(options?.expires && options.expires.getTime() <= Date.now()) ||
              !value

            // Protect auth cookies from being wiped when offline due to failed token refresh
            if (isOffline && isAuthCookie && isDeleting) {
              return
            }

            let cookieStr = `${name}=${value}; path=${options?.path || '/'}; SameSite=${options?.sameSite || 'Lax'}`
            if (options?.maxAge !== undefined) {
              cookieStr += `; max-age=${options.maxAge}`
            } else if (options?.expires) {
              cookieStr += `; expires=${options.expires.toUTCString()}`
            }
            if (options?.domain) {
              cookieStr += `; domain=${options.domain}`
            }
            if (options?.secure) {
              cookieStr += '; secure'
            }
            document.cookie = cookieStr
          })
        },
      },
    }
  )
}
