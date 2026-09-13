const CACHE_NAME = 'knoten-cache-v1'

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
]

// Install event: precache vital assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  )
})

// Activate event: clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key)
            }
          })
        )
      )
      .then(() => self.clients.claim())
  )
})

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignore non-GET requests or chrome-extension URLs
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return
  }

  // API calls: Network-first, do not fallback to offline page
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    return
  }

  // Navigation requests: Network-First with Cache Fallback and offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const fallback = await caches.match('/offline.html')
          return fallback || Response.error()
        })
    )
    return
  }

  // Static assets (Next.js chunks, css, fonts, images): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})
