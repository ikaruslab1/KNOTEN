/**
 * Offline Auth Session Storage Client
 * Persists authenticated user and profile in localStorage so the session
 * survives internet disconnection, offline restarts, and token expiration.
 */

export interface OfflineUserProfile {
  id: string
  nombre: string
  apellido_paterno: string
  apellido_materno: string | null
  rol: string
  correo_personal: string
  grupo?: string
  semestre?: string
  carrera?: string
}

export interface OfflineUser {
  id: string
  email?: string
  user_metadata?: Record<string, any>
}

export interface OfflineUserSession {
  user: OfflineUser
  profile: OfflineUserProfile
  savedAt: number
}

export const OFFLINE_SESSION_KEY = 'knoten_offline_session'

/**
 * Safely retrieve the offline session from localStorage.
 */
export function getStoredOfflineSession(): OfflineUserSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(OFFLINE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OfflineUserSession
    if (parsed && parsed.user && parsed.profile && parsed.user.id) {
      return parsed
    }
    return null
  } catch (err) {
    console.warn('Could not parse offline session from localStorage:', err)
    return null
  }
}

/**
 * Save user and profile to localStorage for offline persistence.
 */
export function saveOfflineSession(
  user: { id: string; email?: string; user_metadata?: Record<string, any> },
  profile: {
    id: string
    nombre?: string
    apellido_paterno?: string
    apellido_materno?: string | null
    rol?: string
    correo_personal?: string
    [key: string]: any
  }
): OfflineUserSession {
  const meta = user.user_metadata || {}

  const normalizedProfile: OfflineUserProfile = {
    id: profile.id || user.id,
    nombre: profile.nombre || meta.nombre || 'Usuario',
    apellido_paterno: profile.apellido_paterno || meta.apellido_paterno || '',
    apellido_materno: profile.apellido_materno ?? meta.apellido_materno ?? null,
    rol: profile.rol || meta.rol || 'estudiante',
    correo_personal: profile.correo_personal || user.email || meta.correo_personal || '',
    grupo: profile.grupo || meta.grupo,
    semestre: profile.semestre || meta.semestre,
    carrera: profile.carrera || meta.carrera,
  }

  const sessionData: OfflineUserSession = {
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    profile: normalizedProfile,
    savedAt: Date.now(),
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify(sessionData))
      window.dispatchEvent(
        new CustomEvent('knoten:auth-changed', {
          detail: { session: sessionData },
        })
      )
    } catch (err) {
      console.warn('Could not save offline session to localStorage:', err)
    }
  }

  return sessionData
}

/**
 * Intentionally clear the stored offline session and auth cookies.
 * Only called on explicit user logout.
 */
export function clearStoredOfflineSession(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(OFFLINE_SESSION_KEY)
    clearAllAuthCookies()
    window.dispatchEvent(
      new CustomEvent('knoten:auth-changed', {
        detail: { session: null },
      })
    )
  } catch (err) {
    console.warn('Could not clear offline session:', err)
  }
}

/**
 * Helper to clear Supabase auth cookies in document.cookie upon explicit logout.
 */
export function clearAllAuthCookies(): void {
  if (typeof document === 'undefined') return
  try {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
      if (name.includes('-auth-token') || name.startsWith('sb-')) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
      }
    }
  } catch {}
}
