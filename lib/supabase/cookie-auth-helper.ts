/**
 * Helper to decode user and metadata from Supabase auth cookies without network calls.
 * Used as an offline/SSR fallback when the cloud Supabase instance is unreachable.
 */

export interface DecodedAuthUser {
  id: string
  email?: string
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
  role?: string
}

export function decodeUserFromCookies(
  allCookies: { name: string; value: string }[]
): DecodedAuthUser | null {
  try {
    // 1. Find all Supabase auth cookie chunks
    const authChunks = allCookies
      .filter(
        (c) =>
          c.name.includes('-auth-token') ||
          (c.name.startsWith('sb-') && c.name.includes('auth'))
      )
      .sort((a, b) => {
        const aParts = a.name.split('.')
        const bParts = b.name.split('.')
        const aIdx = aParts.length > 1 ? Number(aParts[aParts.length - 1]) : 0
        const bIdx = bParts.length > 1 ? Number(bParts[bParts.length - 1]) : 0
        return (isNaN(aIdx) ? 0 : aIdx) - (isNaN(bIdx) ? 0 : bIdx)
      })

    if (authChunks.length === 0) return null

    // 2. Combine chunks
    let combined = authChunks.map((c) => c.value).join('')

    // 3. Decode base64- prefix if present
    if (combined.startsWith('base64-')) {
      combined = Buffer.from(combined.slice(7), 'base64url').toString('utf-8')
    }

    // 4. Parse JSON
    let parsed: any = null
    try {
      parsed = JSON.parse(combined)
    } catch {
      if (combined.includes('.')) {
        parsed = { access_token: combined }
      }
    }

    if (!parsed) return null

    // 5. If user object is directly present
    if (parsed.user && (parsed.user.id || parsed.user.sub)) {
      return {
        id: parsed.user.id || parsed.user.sub,
        email: parsed.user.email,
        user_metadata: parsed.user.user_metadata || {},
        app_metadata: parsed.user.app_metadata || {},
        role: parsed.user.role || 'authenticated',
      }
    }

    // 6. Extract access token
    let token = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : null)
    if (!token && typeof parsed === 'string' && parsed.includes('.')) {
      token = parsed
    }

    if (token && typeof token === 'string' && token.includes('.')) {
      const parts = token.split('.')
      if (parts.length >= 2) {
        const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8')
        const payload = JSON.parse(payloadStr)
        if (payload && (payload.sub || payload.id)) {
          return {
            id: payload.sub || payload.id,
            email: payload.email || payload.user_metadata?.correo_personal || '',
            user_metadata: payload.user_metadata || {},
            app_metadata: payload.app_metadata || {},
            role: payload.role || 'authenticated',
          }
        }
      }
    }

    return null
  } catch (err) {
    return null
  }
}
