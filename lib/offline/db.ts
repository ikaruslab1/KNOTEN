/**
 * IndexedDB storage client for Knoten Offline-First Architecture.
 * Allows storing large volumes of course, session, activity, block and connection data
 * far exceeding the 5MB quota of localStorage.
 */

const DB_NAME = 'knoten_offline_db'
const DB_VERSION = 1

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

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'))
    }

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

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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
    store.put(activity)
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
