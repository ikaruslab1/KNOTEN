'use client'

import { useState, useEffect } from 'react'

let cachedOnlineStatus: boolean | null = null
let lastCheckTime = 0
const CACHE_TTL_MS = 3000 // 3 seconds cache to avoid ping flood

/**
 * Rapid check to verify REAL Internet connectivity.
 * On Windows PC, navigator.onLine often returns true even when disconnected
 * because of virtual network interfaces (WSL, Docker, Hyper-V, loopback).
 */
export async function checkIsOnline(force = false): Promise<boolean> {
  if (typeof window === 'undefined') return true

  // 1. If navigator.onLine is false, the device is definitely offline (100% reliable)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    cachedOnlineStatus = false
    return false
  }

  // 2. Use cached result if recent
  const now = Date.now()
  if (!force && cachedOnlineStatus !== null && now - lastCheckTime < CACHE_TTL_MS) {
    return cachedOnlineStatus
  }

  // 3. Fast WAN ping bypassing Service Worker (using HEAD request)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 900)

    // SW ignores non-GET requests, so HEAD goes directly to network
    const res = await fetch(`/manifest.json?_ping=${now}`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)

    const isOk = res.ok || res.status === 304 || res.status === 200
    cachedOnlineStatus = isOk
    lastCheckTime = Date.now()
    return isOk
  } catch {
    cachedOnlineStatus = false
    lastCheckTime = Date.now()
    return false
  }
}

/**
 * Synchronous read of the current known connectivity state.
 */
export function isOnlineSync(): boolean {
  if (typeof window === 'undefined') return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }
  if (cachedOnlineStatus !== null) {
    return cachedOnlineStatus
  }
  return navigator.onLine
}

/**
 * Manually set the cached online status (e.g. after a failed Supabase query or network error)
 */
export function setKnownOffline(): void {
  cachedOnlineStatus = false
  lastCheckTime = Date.now()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('knoten:connectivity-changed', { detail: { online: false } }))
  }
}

export function setKnownOnline(): void {
  cachedOnlineStatus = true
  lastCheckTime = Date.now()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('knoten:connectivity-changed', { detail: { online: true } }))
  }
}

/**
 * React hook to reactively track true network connectivity.
 */
export function useNetworkStatus(): { isOnline: boolean; isChecking: boolean } {
  const [online, setOnline] = useState<boolean>(isOnlineSync)
  const [checking, setChecking] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true

    const updateStatus = async (force = false) => {
      setChecking(true)
      const isUp = await checkIsOnline(force)
      if (isMounted) {
        setOnline(isUp)
        setChecking(false)
      }
    }

    // Initial check
    updateStatus(true)

    const handleOfflineEvent = () => {
      cachedOnlineStatus = false
      setOnline(false)
    }

    const handleOnlineEvent = () => {
      updateStatus(true)
    }

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<{ online: boolean }>
      if (custom.detail && typeof custom.detail.online === 'boolean') {
        setOnline(custom.detail.online)
      }
    }

    window.addEventListener('offline', handleOfflineEvent)
    window.addEventListener('online', handleOnlineEvent)
    window.addEventListener('knoten:connectivity-changed', handleCustomEvent)

    // Periodic lightweight check every 15s to keep PC status fresh
    const interval = setInterval(() => {
      updateStatus(false)
    }, 15000)

    return () => {
      isMounted = false
      window.removeEventListener('offline', handleOfflineEvent)
      window.removeEventListener('online', handleOnlineEvent)
      window.removeEventListener('knoten:connectivity-changed', handleCustomEvent)
      clearInterval(interval)
    }
  }, [])

  return { isOnline: online, isChecking: checking }
}

/**
 * Safe navigation that automatically picks between instant document navigation (offline)
 * and SPA client navigation (online).
 */
export function navigateSafely(
  targetUrl: string,
  router?: { push: (url: string) => void },
  delayMs = 0
): void {
  if (typeof window === 'undefined') return

  const execute = async () => {
    const online = await checkIsOnline()
    if (!online || !router) {
      // In offline mode, ALWAYS perform hard document navigation so Service Worker
      // serves the offline shell / cached document instantly without RSC fetch failures!
      window.location.assign(targetUrl)
      return
    }

    try {
      router.push(targetUrl)
    } catch {
      window.location.assign(targetUrl)
      return
    }

    // Safety fallback in case router.push stalls on desktop PC
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== targetUrl) {
        window.location.assign(targetUrl)
      }
    }, 500)
  }

  if (delayMs > 0) {
    setTimeout(execute, delayMs)
  } else {
    execute()
  }
}
