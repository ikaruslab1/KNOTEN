import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { decodeUserFromCookies } from './cookie-auth-helper'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can only be
            // mutated in middleware or Server Actions, so we ignore the error.
          }
        },
      },
    }
  )
}

/**
 * Cached per request: fast-path cookie check + memoized user retrieval.
 * Eliminates duplicate network calls across NavBar, layouts, and pages.
 * Includes offline fallback to decode JWT from cookies when network is unavailable.
 */
export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const hasAuthCookie = allCookies.some(
    (c) => c.name.includes('-auth-token') || c.name.startsWith('sb-')
  )
  if (!hasAuthCookie) return null

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (user && !error) return user
  } catch (err) {
    // Supabase cloud server unreachable (offline / no internet)
  }

  // Offline fallback: decode user claims directly from cookies
  const decoded = decodeUserFromCookies(allCookies)
  return (decoded as any) ?? null
})

export type CachedProfile = {
  id: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  rol: string
  correo_personal: string
}

/**
 * Cached per request: memoized profile retrieval.
 * If cloud database is offline, reconstructs profile from user metadata.
 */
export const getCurrentProfile = cache(async (): Promise<CachedProfile | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  try {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, nombre, apellido_paterno, apellido_materno, rol, correo_personal')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) return profile
  } catch (err) {
    // Database unreachable offline
  }

  // Offline fallback: reconstruct profile from user metadata saved at registration/login
  const meta = (user as any).user_metadata || {}
  return {
    id: user.id,
    nombre: meta.nombre || 'Usuario',
    apellido_paterno: meta.apellido_paterno || '',
    apellido_materno: meta.apellido_materno ?? null,
    rol: meta.rol || 'estudiante',
    correo_personal: meta.correo_personal || user.email || '',
  }
})
