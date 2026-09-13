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
  if (!navigator.onLine) {
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

    // Pre-cache activity URLs and shells in Cache API in background
    if (typeof window !== 'undefined' && 'caches' in window) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)

          // Precache first course shell
          if (incomingCourses.length > 0) {
            try {
              const courseRes = await fetch(`/curso/${incomingCourses[0].id}`)
              if (courseRes.ok) {
                await cache.put(`/curso/${incomingCourses[0].id}`, courseRes.clone())
                await cache.put('/curso-shell', courseRes.clone())
              }
            } catch {}
          }

          // Precache first activity shell
          if (incomingActivities.length > 0) {
            try {
              const actRes = await fetch(`/actividad/${incomingActivities[0].id}`)
              if (actRes.ok) {
                await cache.put(`/actividad/${incomingActivities[0].id}`, actRes.clone())
                await cache.put('/actividad-shell', actRes.clone())
              }
            } catch {}
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

  if (!navigator.onLine) {
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

    // Pre-cache into Cache API in background (shells for instant navigation)
    if ('caches' in window) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)
          const courseRes = await fetch(`/curso/${cursoId}`)
          if (courseRes.ok) {
            await cache.put(`/curso/${cursoId}`, courseRes.clone())
            await cache.put('/curso-shell', courseRes.clone())
          }

          if (activities.length > 0) {
            const firstAct = activities[0]
            const actRes = await fetch(`/actividad/${firstAct.id}`)
            if (actRes.ok) {
              await cache.put(`/actividad/${firstAct.id}`, actRes.clone())
              await cache.put('/actividad-shell', actRes.clone())
            }
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

  if (!navigator.onLine) {
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

    // Pre-cache into Cache API in background (shell for instant offline navigation)
    if ('caches' in window && activities.length > 0) {
      ;(async () => {
        try {
          const cache = await window.caches.open(OFFLINE_CACHE_NAME)
          const firstAct = activities[0]
          const actRes = await fetch(`/actividad/${firstAct.id}`)
          if (actRes.ok) {
            await cache.put(`/actividad/${firstAct.id}`, actRes.clone())
            await cache.put('/actividad-shell', actRes.clone())
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


