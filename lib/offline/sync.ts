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
