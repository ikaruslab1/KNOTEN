'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  OfflineUser,
  OfflineUserProfile,
  OfflineUserSession,
  getStoredOfflineSession,
  saveOfflineSession,
  clearStoredOfflineSession,
} from '@/lib/offline/auth-session'
import { createClient } from '@/lib/supabase/client'

import { isOnlineSync, setKnownOffline } from '@/lib/offline/connectivity'

interface AuthContextType {
  user: OfflineUser | null
  profile: OfflineUserProfile | null
  isAuthenticated: boolean
  isOffline: boolean
  isLoading: boolean
  saveSession: (user: OfflineUser, profile: any) => void
  signOut: () => Promise<void>
  refreshOfflineSession: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAuthenticated: false,
  isOffline: false,
  isLoading: true,
  saveSession: () => {},
  signOut: async () => {},
  refreshOfflineSession: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OfflineUser | null>(null)
  const [profile, setProfile] = useState<OfflineUserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(!isOnlineSync())

  const applyStoredSession = useCallback(() => {
    const stored = getStoredOfflineSession()
    if (stored) {
      setUser(stored.user)
      setProfile(stored.profile)
    } else {
      setUser(null)
      setProfile(null)
    }
  }, [])

  // Sync with Supabase on initial load or reconnection
  const syncWithSupabase = useCallback(async () => {
    if (!isOnlineSync()) {
      // Offline: stick with stored session without network calls
      applyStoredSession()
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession()

      if (session && session.user && !error) {
        // Fetch fresh profile from database
        let userProfile: any = null
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, nombre, apellido_paterno, apellido_materno, rol, correo_personal')
            .eq('id', session.user.id)
            .maybeSingle()
          userProfile = data
        } catch {}

        const saved = saveOfflineSession(session.user, userProfile || {})
        setUser(saved.user)
        setProfile(saved.profile)
      } else {
        // Supabase reports no active session
        // Check if there is an offline session
        const stored = getStoredOfflineSession()
        if (stored) {
          setUser(stored.user)
          setProfile(stored.profile)
        } else {
          setUser(null)
          setProfile(null)
        }
      }
    } catch (err) {
      console.warn('Auth sync error, relying on offline session:', err)
      setKnownOffline()
      setIsOffline(true)
      applyStoredSession()
    } finally {
      setIsLoading(false)
    }
  }, [applyStoredSession])

  useEffect(() => {
    // 1. Instantly apply offline session from localStorage for 0ms initial render
    applyStoredSession()

    // 2. Perform background sync if online
    syncWithSupabase()

    // 3. Listen to online / offline events
    const handleOnline = () => {
      setIsOffline(false)
      syncWithSupabase()
    }
    const handleOffline = () => {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // 4. Listen to global knoten:auth-changed events (e.g. from AuthModal or other tabs)
    const handleAuthChanged = (e: Event) => {
      const custom = e as CustomEvent<{ session: OfflineUserSession | null }>
      if (custom.detail?.session) {
        setUser(custom.detail.session.user)
        setProfile(custom.detail.session.profile)
      } else {
        setUser(null)
        setProfile(null)
      }
    }
    window.addEventListener('knoten:auth-changed', handleAuthChanged)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('knoten:auth-changed', handleAuthChanged)
    }
  }, [applyStoredSession, syncWithSupabase])

  const handleSaveSession = useCallback((newUser: OfflineUser, newProfile: any) => {
    const saved = saveOfflineSession(newUser, newProfile)
    setUser(saved.user)
    setProfile(saved.profile)
  }, [])

  const handleSignOut = useCallback(async () => {
    clearStoredOfflineSession()
    setUser(null)
    setProfile(null)

    // Attempt online signout in background if connected
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
        await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {})
      } catch (err) {
        console.warn('Error signing out from Supabase server:', err)
      }
    }

    window.location.href = '/'
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated: Boolean(user && profile),
        isOffline,
        isLoading,
        saveSession: handleSaveSession,
        signOut: handleSignOut,
        refreshOfflineSession: applyStoredSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
