/**
 * IndexedDB storage client for Knoten Offline-First Architecture.
 * Allows storing large volumes of course, session, activity, block and connection data
 * far exceeding the 5MB quota of localStorage.
 */

const DB_NAME = 'knoten_offline_db'
const DB_VERSION = 1
export const OFFLINE_CACHE_NAME = 'knoten-cache-v5'

export interface OfflineCourse {
  id: string
  nombre: string
  imagen_url: string | null
  profesor_id: string
  profesor_nombre?: string
  updated_at?: string
}

export interface OfflineSession {
  id: string
  curso_id: string
  nombre: string
  tipo: 'clase' | 'repaso'
  fecha_liberacion: string | null
  orden: number
  updated_at?: string
  actividades_count?: number
}

export interface OfflineBlock {
  id: string
  activity_id?: string
  tipo: 'codigo' | 'indentacion' | 'sticker'
  contenido: string | null
  posicion_x?: number
  posicion_y?: number
  orden_correcto?: number
  indent_level?: number
}

export interface OfflineConnection {
  id: string
  activity_id?: string
  source_block_id: string
  target_block_id: string
  source_handle?: string | null
  target_handle?: string | null
  orden?: number
}

export interface OfflineActivity {
  id: string
  session_id: string
  titulo: string
  enunciado: string | null
  resultado_esperado: string | null
  orden: number
  updated_at?: string
  blocks: OfflineBlock[]
  connections: OfflineConnection[]
  session_nombre?: string
  session_tipo?: 'clase' | 'repaso'
  curso_id?: string
  curso_nombre?: string
}

export interface SyncMetadata {
  id: string // e.g. 'latest'
  last_sync: string
  new_activities: number
  updated_activities: number
  total_activities: number
  total_sessions: number
  total_courses: number
}

let cachedDbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'))
  }

  if (cachedDbPromise) {
    return cachedDbPromise
  }

  cachedDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Courses store
      if (!db.objectStoreNames.contains('courses')) {
        db.createObjectStore('courses', { keyPath: 'id' })
      }

      // Sessions store with index on curso_id
      if (!db.objectStoreNames.contains('sessions')) {
        const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' })
        sessionStore.createIndex('curso_id', 'curso_id', { unique: false })
      }

      // Activities store with index on session_id
      if (!db.objectStoreNames.contains('activities')) {
        const activityStore = db.createObjectStore('activities', { keyPath: 'id' })
        activityStore.createIndex('session_id', 'session_id', { unique: false })
      }

      // Sync metadata store
      if (!db.objectStoreNames.contains('sync_meta')) {
        db.createObjectStore('sync_meta', { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        cachedDbPromise = null
      }
      db.onclose = () => {
        cachedDbPromise = null
      }
      resolve(db)
    }

    request.onerror = () => {
      cachedDbPromise = null
      reject(request.error)
    }

    request.onblocked = () => {
      console.warn('IndexedDB connection blocked')
    }
  })

  return cachedDbPromise
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export async function saveCourses(courses: OfflineCourse[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('courses', 'readwrite')
    const store = tx.objectStore('courses')
    for (const c of courses) {
      store.put(c)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineCourses(): Promise<OfflineCourse[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('courses', 'readonly')
    const store = tx.objectStore('courses')
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function saveSessions(sessions: OfflineSession[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    for (const s of sessions) {
      store.put(s)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineSessionsByCourse(cursoId: string): Promise<OfflineSession[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly')
    const store = tx.objectStore('sessions')
    const index = store.index('curso_id')
    const req = index.getAll(cursoId)
    req.onsuccess = () => {
      const list: OfflineSession[] = req.result || []
      list.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function saveActivity(activity: OfflineActivity): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readwrite')
    const store = tx.objectStore('activities')

    // First inspect existing record to prevent overwriting valid session_id or curso_id
    const getReq = store.get(activity.id)
    getReq.onsuccess = () => {
      const existing: OfflineActivity | undefined = getReq.result
      const finalSessionId = activity.session_id?.trim() || existing?.session_id || ''
      const finalCursoId = activity.curso_id?.trim() || existing?.curso_id || ''

      const merged: OfflineActivity = {
        ...existing,
        ...activity,
        session_id: finalSessionId,
        curso_id: finalCursoId,
        blocks: activity.blocks && activity.blocks.length > 0 ? activity.blocks : existing?.blocks || [],
        connections: activity.connections && activity.connections.length > 0 ? activity.connections : existing?.connections || [],
      }
      store.put(merged)
    }
    getReq.onerror = () => {
      store.put(activity)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function saveActivities(activities: OfflineActivity[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readwrite')
    const store = tx.objectStore('activities')
    for (const a of activities) {
      store.put(a)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getOfflineActivity(id: string): Promise<OfflineActivity | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readonly')
    const store = tx.objectStore('activities')
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}

export async function getOfflineActivitiesBySession(sessionId: string): Promise<OfflineActivity[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readonly')
    const store = tx.objectStore('activities')
    const index = store.index('session_id')
    const req = index.getAll(sessionId)
    req.onsuccess = () => {
      const list: OfflineActivity[] = req.result || []
      list.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      resolve(list)
    }
    req.onerror = () => reject(req.error)
  })
}

// ─── Sync Metadata ────────────────────────────────────────────────────────────

export async function saveSyncMeta(meta: SyncMetadata): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_meta', 'readwrite')
    const store = tx.objectStore('sync_meta')
    store.put(meta)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getSyncMeta(): Promise<SyncMetadata | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_meta', 'readonly')
      const store = tx.objectStore('sync_meta')
      const req = store.get('latest')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function getOfflineDatabaseStats(): Promise<{
  coursesCount: number
  sessionsCount: number
  activitiesCount: number
}> {
  try {
    const db = await openDB()
    const getCount = (storeName: string): Promise<number> =>
      new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly')
        const req = tx.objectStore(storeName).count()
        req.onsuccess = () => resolve(req.result || 0)
        req.onerror = () => resolve(0)
      })

    const [coursesCount, sessionsCount, activitiesCount] = await Promise.all([
      getCount('courses'),
      getCount('sessions'),
      getCount('activities'),
    ])

    return { coursesCount, sessionsCount, activitiesCount }
  } catch {
    return { coursesCount: 0, sessionsCount: 0, activitiesCount: 0 }
  }
}

// ─── Course & Session Deletion (Free storage space) ───────────────────────────

export async function deleteOfflineCourse(cursoId: string): Promise<{ deletedActivities: number; deletedSessions: number }> {
  const db = await openDB()

  // 1. Get all sessions for this course
  const sessions = await getOfflineSessionsByCourse(cursoId)
  const sessionIds = sessions.map((s) => s.id)

  // 2. Get all activities for these sessions
  let activityIds: string[] = []
  for (const sId of sessionIds) {
    const acts = await getOfflineActivitiesBySession(sId)
    activityIds = activityIds.concat(acts.map((a) => a.id))
  }

  // 3. Delete activities
  if (activityIds.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('activities', 'readwrite')
      const store = tx.objectStore('activities')
      for (const actId of activityIds) {
        store.delete(actId)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // 4. Delete sessions
  if (sessionIds.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite')
      const store = tx.objectStore('sessions')
      for (const sId of sessionIds) {
        store.delete(sId)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // 5. Delete course
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('courses', 'readwrite')
    const store = tx.objectStore('courses')
    store.delete(cursoId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  // 6. Clean up Cache API
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(OFFLINE_CACHE_NAME)
      await cache.delete(`/curso/${cursoId}`)
      for (const actId of activityIds) {
        await cache.delete(`/actividad/${actId}`)
      }
    } catch {}
  }

  // 7. Update sync metadata
  const stats = await getOfflineDatabaseStats()
  await saveSyncMeta({
    id: 'latest',
    last_sync: new Date().toISOString(),
    new_activities: 0,
    updated_activities: 0,
    total_activities: stats.activitiesCount,
    total_sessions: stats.sessionsCount,
    total_courses: stats.coursesCount,
  })

  // 8. Dispatch events for listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('knoten:download-updated', {
        detail: { type: 'course-deleted', cursoId },
      })
    )
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', {
        detail: { stats },
      })
    )
  }

  return { deletedActivities: activityIds.length, deletedSessions: sessionIds.length }
}

export async function deleteOfflineSession(sessionId: string): Promise<{ deletedActivities: number }> {
  const db = await openDB()

  // 1. Get all activities for this session
  const activities = await getOfflineActivitiesBySession(sessionId)
  const activityIds = activities.map((a) => a.id)

  // 2. Delete activities
  if (activityIds.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('activities', 'readwrite')
      const store = tx.objectStore('activities')
      for (const actId of activityIds) {
        store.delete(actId)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  // 3. Delete session
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    store.delete(sessionId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  // 4. Clean up Cache API
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(OFFLINE_CACHE_NAME)
      for (const actId of activityIds) {
        await cache.delete(`/actividad/${actId}`)
      }
    } catch {}
  }

  // 5. Update sync metadata
  const stats = await getOfflineDatabaseStats()
  await saveSyncMeta({
    id: 'latest',
    last_sync: new Date().toISOString(),
    new_activities: 0,
    updated_activities: 0,
    total_activities: stats.activitiesCount,
    total_sessions: stats.sessionsCount,
    total_courses: stats.coursesCount,
  })

  // 6. Dispatch event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('knoten:download-updated', {
        detail: { type: 'session-deleted', sessionId },
      })
    )
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', {
        detail: { stats },
      })
    )
  }

  return { deletedActivities: activityIds.length }
}

export async function clearAllOfflineStorage(): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['courses', 'sessions', 'activities', 'sync_meta'], 'readwrite')
    tx.objectStore('courses').clear()
    tx.objectStore('sessions').clear()
    tx.objectStore('activities').clear()
    tx.objectStore('sync_meta').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(OFFLINE_CACHE_NAME)
      const keys = await cache.keys()
      for (const req of keys) {
        const u = new URL(req.url)
        if (u.pathname.startsWith('/curso/') || u.pathname.startsWith('/actividad/')) {
          await cache.delete(req)
        }
      }
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('knoten:download-updated', {
        detail: { type: 'all-cleared' },
      })
    )
    window.dispatchEvent(
      new CustomEvent('knoten:sync-complete', {
        detail: { allCleared: true },
      })
    )
  }
}

// ─── Status Checkers ──────────────────────────────────────────────────────────

export async function getCourseOfflineStatus(cursoId: string): Promise<{
  isDownloaded: boolean
  sessionsCount: number
  activitiesCount: number
}> {
  try {
    const db = await openDB()
    const course = await new Promise<any>((resolve) => {
      const tx = db.transaction('courses', 'readonly')
      const req = tx.objectStore('courses').get(cursoId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })

    const sessions = await getOfflineSessionsByCourse(cursoId)
    let activitiesCount = 0
    for (const s of sessions) {
      const acts = await getOfflineActivitiesBySession(s.id)
      activitiesCount += acts.length
    }

    return {
      isDownloaded: activitiesCount > 0 || (Boolean(course) && sessions.length > 0),
      sessionsCount: sessions.length,
      activitiesCount,
    }
  } catch {
    return { isDownloaded: false, sessionsCount: 0, activitiesCount: 0 }
  }
}

export async function getSessionOfflineStatus(sessionId: string): Promise<{
  isDownloaded: boolean
  activitiesCount: number
}> {
  try {
    const acts = await getOfflineActivitiesBySession(sessionId)
    return {
      isDownloaded: acts.length > 0,
      activitiesCount: acts.length,
    }
  } catch {
    return { isDownloaded: false, activitiesCount: 0 }
  }
}

/**
 * Auto-repairs activities in IndexedDB whose session_id might have been cleared
 * due to previous unpatched client code.
 */
export async function repairCorruptedOfflineActivities(): Promise<number> {
  try {
    const db = await openDB()
    const sessions = await new Promise<OfflineSession[]>((resolve) => {
      const tx = db.transaction('sessions', 'readonly')
      const req = tx.objectStore('sessions').getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })

    if (sessions.length === 0) return 0

    const activities = await new Promise<OfflineActivity[]>((resolve) => {
      const tx = db.transaction('activities', 'readonly')
      const req = tx.objectStore('activities').getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    })

    const toFix: OfflineActivity[] = []
    for (const act of activities) {
      if (!act.session_id || act.session_id.trim() === '') {
        const matched = sessions.find(
          (s) =>
            (act.curso_id && s.curso_id === act.curso_id && act.session_nombre && s.nombre === act.session_nombre) ||
            (act.session_nombre && s.nombre === act.session_nombre)
        )
        if (matched) {
          act.session_id = matched.id
          if (!act.curso_id) act.curso_id = matched.curso_id
          toFix.push(act)
        }
      }
    }

    if (toFix.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('activities', 'readwrite')
        const store = tx.objectStore('activities')
        for (const act of toFix) {
          store.put(act)
        }
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    }

    return toFix.length
  } catch {
    return 0
  }
}


