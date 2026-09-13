import {
  saveCourses,
  saveSessions,
  saveActivities,
  saveSyncMeta,
  getOfflineActivitiesBySession,
  getOfflineDatabaseStats,
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

    // Compare activities if not first time
    if (!isFirstTimeSync) {
      // Create set of existing activity IDs
      for (const incAct of incomingActivities) {
        // Simple hash comparison or check presence
        newActivitiesCount++ // Will be adjusted if already existed
      }
      // Accurate diffing:
      const existingActivityIds = new Set<string>()
      // We can check with openDB or compare directly
    } else {
      newActivitiesCount = incomingActivities.length
      updatedActivitiesCount = 0
    }

    // Persist to IndexedDB
    await saveCourses(incomingCourses)
    await saveSessions(incomingSessions)
    await saveActivities(incomingActivities)

    // Pre-cache activity URLs and shells in Cache API for instant offline navigation
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await window.caches.open('knoten-cache-v2')

        // Precache courses
        for (const c of incomingCourses) {
          try {
            const courseRes = await fetch(`/curso/${c.id}`)
            if (courseRes.ok) {
              await cache.put(`/curso/${c.id}`, courseRes.clone())
              await cache.put('/curso-shell', courseRes.clone())
            }
          } catch {}
        }

        // Precache activities and create generic /actividad-shell
        for (const act of incomingActivities) {
          try {
            const actRes = await fetch(`/actividad/${act.id}`)
            if (actRes.ok) {
              await cache.put(`/actividad/${act.id}`, actRes.clone())
              await cache.put('/actividad-shell', actRes.clone())
            }
          } catch {}
        }
      } catch (e) {
        console.warn('Error during offline page pre-caching:', e)
      }
    }

    const finalStats = await getOfflineDatabaseStats()

    if (!isFirstTimeSync) {
      const added = Math.max(0, finalStats.activitiesCount - initialStats.activitiesCount)
      newActivitiesCount = added
      // If activities were modified (or same count with revisions)
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

    // Pre-cache into Cache API
    if ('caches' in window) {
      try {
        const cache = await window.caches.open('knoten-cache-v2')
        const courseRes = await fetch(`/curso/${cursoId}`)
        if (courseRes.ok) {
          await cache.put(`/curso/${cursoId}`, courseRes.clone())
          await cache.put('/curso-shell', courseRes.clone())
        }

        for (const act of activities) {
          try {
            const actRes = await fetch(`/actividad/${act.id}`)
            if (actRes.ok) {
              await cache.put(`/actividad/${act.id}`, actRes.clone())
              await cache.put('/actividad-shell', actRes.clone())
            }
          } catch {}
        }
      } catch (cacheErr) {
        console.warn('Cache API precaching error:', cacheErr)
      }
    }

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

    // Pre-cache into Cache API
    if ('caches' in window) {
      try {
        const cache = await window.caches.open('knoten-cache-v2')
        for (const act of activities) {
          try {
            const actRes = await fetch(`/actividad/${act.id}`)
            if (actRes.ok) {
              await cache.put(`/actividad/${act.id}`, actRes.clone())
              await cache.put('/actividad-shell', actRes.clone())
            }
          } catch {}
        }
      } catch (cacheErr) {
        console.warn('Cache API precaching error:', cacheErr)
      }
    }

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

