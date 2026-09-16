import {
  saveCourses,
  saveSessions,
  saveActivities,
  saveSyncMeta,
  getOfflineActivitiesBySession,
  getOfflineDatabaseStats,
  OFFLINE_CACHE_NAME,
  OfflineActivity,
  OfflineSession,
  OfflineCourse,
} from './db'
import { checkIsOnline, isOnlineSync } from './connectivity'

export interface SyncResult {
  success: boolean
  offline?: boolean
  error?: string
  newActivitiesCount: number
  updatedActivitiesCount: number
  newSessionsCount: number
  updatedSessionsCount: number
  totalActivitiesCount: number
  totalSessionsCount: number
  timestamp: string
}

const ASSET_REGEX = /\/_next\/static\/[^\s"'()<>,\\;]+/g

/**
 * Discovers and precaches all JavaScript chunks, CSS stylesheets, and font files
 * referenced within an HTML document or Next.js RSC payload into Cache Storage.
 */
export async function precacheExtractedAssets(text: string, cache: Cache): Promise<void> {
  const matches = text.match(ASSET_REGEX) || []
  if (!matches.length) return

  const uniqueAssets = Array.from(
    new Set(matches.map((u) => u.split('?')[0].split('#')[0]))
  ).filter(
    (u) =>
      u.endsWith('.js') ||
      u.endsWith('.css') ||
      u.endsWith('.woff2') ||
      u.endsWith('.woff') ||
      u.endsWith('.ico')
  )

  await Promise.allSettled(
    uniqueAssets.map(async (assetUrl) => {
      try {
        const cached = await cache.match(assetUrl)
        if (cached) return
        const r = await fetch(assetUrl)
        if (r.ok) {
          await cache.put(assetUrl, r)
        }
      } catch {}
    })
  )
}

/**
 * Precaches an HTML document, its RSC payload, and all static JS/CSS assets referenced in either.
 */
export async function precachePageAndAssets(
  url: string,
  cache: Cache,
  shellFallbackKey?: string
): Promise<void> {
  // 1. Fetch & cache HTML document + extract all static chunks
  try {
    const res = await fetch(url)
    if (res.ok) {
      await cache.put(url, res.clone())
      if (shellFallbackKey) {
        await cache.put(shellFallbackKey, res.clone())
      }
      const htmlText = await res.text()
      await precacheExtractedAssets(htmlText, cache)
    }
  } catch {}

  // 2. Fetch & cache RSC flight payload + extract chunks
  try {
    const rscUrl = url.includes('?') ? `${url}&_rsc=1` : `${url}?_rsc=1`
    const rscRes = await fetch(rscUrl, { headers: { RSC: '1' } })
    if (rscRes.ok) {
      await cache.put(rscUrl, rscRes.clone())
      const rscText = await rscRes.text()
      await precacheExtractedAssets(rscText, cache)
    }
  } catch {}
}

let isSyncing = false

export async function syncOfflineContent(): Promise<SyncResult> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      newActivitiesCount: 0,
      updatedActivitiesCount: 0,
      newSessionsCount: 0,
      updatedSessionsCount: 0,
      totalActivitiesCount: 0,
      totalSessionsCount: 0,
      timestamp: new Date().toISOString(),
    }
  }

  // If already syncing, avoid concurrent syncs
  if (isSyncing) {
    const stats = await getOfflineDatabaseStats()
    return {
      success: true,
      newActivitiesCount: 0,
      updatedActivitiesCount: 0,
      newSessionsCount: 0,
      updatedSessionsCount: 0,
      totalActivitiesCount: stats.activitiesCount,
      totalSessionsCount: stats.sessionsCount,
      timestamp: new Date().toISOString(),
    }
  }

  // If user is offline, return current offline stats without error
  const isOnline = await checkIsOnline()
  if (!isOnline) {
    const stats = await getOfflineDatabaseStats()
    return {
      success: true,
      offline: true,
      newActivitiesCount: 0,
      updatedActivitiesCount: 0,
      newSessionsCount: 0,
      updatedSessionsCount: 0,
      totalActivitiesCount: stats.activitiesCount,
      totalSessionsCount: stats.sessionsCount,
      timestamp: new Date().toISOString(),
    }
  }

  isSyncing = true

  try {
    const res = await fetch('/api/sync/offline-content', {
      method: 'GET',
      cache: 'no-store',
    })

    if (!res.ok) {
      throw new Error(`Sync failed with HTTP ${res.status}`)
    }

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Unknown sync error')
    }

    const incomingCourses: OfflineCourse[] = data.courses || []
    const incomingSessions: OfflineSession[] = data.sessions || []
    const incomingActivities: OfflineActivity[] = data.activities || []

    // Read previous counts from IndexedDB
    const initialStats = await getOfflineDatabaseStats()
    const isFirstTimeSync = initialStats.activitiesCount === 0

    let newActivitiesCount = 0
    let updatedActivitiesCount = 0

    if (!isFirstTimeSync) {
      newActivitiesCount = incomingActivities.length
    } else {
      newActivitiesCount = incomingActivities.length
      updatedActivitiesCount = 0
    }

    // Persist to IndexedDB
    await saveCourses(incomingCourses)
    await saveSessions(incomingSessions)
    await saveActivities(incomingActivities)

    const finalStats = await getOfflineDatabaseStats()

    if (!isFirstTimeSync) {
      const added = Math.max(0, finalStats.activitiesCount - initialStats.activitiesCount)
      newActivitiesCount = added
      updatedActivitiesCount = Math.max(0, incomingActivities.length - added)
    }

    const timestamp = new Date().toISOString()

    // Save sync metadata
    await saveSyncMeta({
      id: 'latest',
      last_sync: timestamp,
      new_activities: newActivitiesCount,
      updated_activities: updatedActivitiesCount,
      total_activities: finalStats.activitiesCount,
      total_sessions: finalStats.sessionsCount,
      total_courses: finalStats.coursesCount,
    })

    // Pre-cache activity URLs, shells, and all static JS/CSS chunks in Cache API in background
    if (typeof window !== 'undefined' && 'caches' in window) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)

          if (incomingCourses.length > 0) {
            await precachePageAndAssets(`/curso/${incomingCourses[0].id}`, cache, '/curso-shell')
          }
          if (incomingActivities.length > 0) {
            await precachePageAndAssets(`/actividad/${incomingActivities[0].id}`, cache, '/actividad-shell')
          }
        } catch (e) {
          console.warn('Error during offline page pre-caching:', e)
        }
      })()
    }

    const result: SyncResult = {
      success: true,
      newActivitiesCount,
      updatedActivitiesCount,
      newSessionsCount: incomingSessions.length,
      updatedSessionsCount: 0,
      totalActivitiesCount: finalStats.activitiesCount,
      totalSessionsCount: finalStats.sessionsCount,
      timestamp,
    }

    // Dispatch global event for listeners
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', { detail: result })
    )

    return result
  } catch (err: any) {
    const stats = await getOfflineDatabaseStats()
    return {
      success: false,
      error: err.message,
      newActivitiesCount: 0,
      updatedActivitiesCount: 0,
      newSessionsCount: 0,
      updatedSessionsCount: 0,
      totalActivitiesCount: stats.activitiesCount,
      totalSessionsCount: stats.sessionsCount,
      timestamp: new Date().toISOString(),
    }
  } finally {
    isSyncing = false
  }
}

// ─── Manual Targeted Course & Session Downloader ──────────────────────────────

export async function downloadCourseOffline(cursoId: string): Promise<{
  success: boolean
  error?: string
  activitiesCount: number
  sessionsCount: number
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Entorno no soportado', activitiesCount: 0, sessionsCount: 0 }
  }

  const isOnline = await checkIsOnline()
  if (!isOnline) {
    return {
      success: false,
      error: 'Se requiere conexión a internet para descargar el curso',
      activitiesCount: 0,
      sessionsCount: 0,
    }
  }

  try {
    const res = await fetch(`/api/sync/offline-content?cursoId=${cursoId}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al obtener curso')

    const courses: OfflineCourse[] = data.courses || []
    const sessions: OfflineSession[] = data.sessions || []
    const activities: OfflineActivity[] = data.activities || []

    await saveCourses(courses)
    await saveSessions(sessions)
    await saveActivities(activities)

    const finalStats = await getOfflineDatabaseStats()
    await saveSyncMeta({
      id: 'latest',
      last_sync: new Date().toISOString(),
      new_activities: activities.length,
      updated_activities: 0,
      total_activities: finalStats.activitiesCount,
      total_sessions: finalStats.sessionsCount,
      total_courses: finalStats.coursesCount,
    })

    // Dispatch update events immediately so badges update instantly
    window.dispatchEvent(
      new CustomEvent('knoten:download-updated', {
        detail: { type: 'course-downloaded', cursoId, activitiesCount: activities.length },
      })
    )
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', {
        detail: { newActivitiesCount: activities.length },
      })
    )

    // Pre-cache into Cache API in background (shells, exact pages, RSC payloads, and ALL referenced JS/CSS chunks)
    if ('caches' in window) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)
          await precachePageAndAssets(`/curso/${cursoId}`, cache, '/curso-shell')

          for (const act of activities) {
            await precachePageAndAssets(`/actividad/${act.id}`, cache, '/actividad-shell')
          }
        } catch (cacheErr) {
          console.warn('Cache API precaching error:', cacheErr)
        }
      })()
    }

    return {
      success: true,
      activitiesCount: activities.length,
      sessionsCount: sessions.length,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error al descargar curso',
      activitiesCount: 0,
      sessionsCount: 0,
    }
  }
}

export async function downloadSessionOffline(sessionId: string): Promise<{
  success: boolean
  error?: string
  activitiesCount: number
}> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Entorno no soportado', activitiesCount: 0 }
  }

  const isOnline = await checkIsOnline()
  if (!isOnline) {
    return {
      success: false,
      error: 'Se requiere conexión a internet para descargar la sesión',
      activitiesCount: 0,
    }
  }

  try {
    const res = await fetch(`/api/sync/offline-content?sessionId=${sessionId}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al obtener sesión')

    const courses: OfflineCourse[] = data.courses || []
    const sessions: OfflineSession[] = data.sessions || []
    const activities: OfflineActivity[] = data.activities || []

    if (courses.length > 0) await saveCourses(courses)
    if (sessions.length > 0) await saveSessions(sessions)
    if (activities.length > 0) await saveActivities(activities)

    const finalStats = await getOfflineDatabaseStats()
    await saveSyncMeta({
      id: 'latest',
      last_sync: new Date().toISOString(),
      new_activities: activities.length,
      updated_activities: 0,
      total_activities: finalStats.activitiesCount,
      total_sessions: finalStats.sessionsCount,
      total_courses: finalStats.coursesCount,
    })

    // Dispatch update events immediately so badge updates instantly
    window.dispatchEvent(
      new CustomEvent('knoten:download-updated', {
        detail: { type: 'session-downloaded', sessionId, activitiesCount: activities.length },
      })
    )
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', {
        detail: { newActivitiesCount: activities.length },
      })
    )

    // Pre-cache into Cache API in background (shells, exact pages, RSC payloads, and ALL referenced JS/CSS chunks)
    if ('caches' in window && activities.length > 0) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)
          for (const act of activities) {
            await precachePageAndAssets(`/actividad/${act.id}`, cache, '/actividad-shell')
          }
        } catch (cacheErr) {
          console.warn('Cache API precaching error:', cacheErr)
        }
      })()
    }

    return {
      success: true,
      activitiesCount: activities.length,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error al descargar sesión',
      activitiesCount: 0,
    }
  }
}


