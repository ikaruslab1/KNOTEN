const CACHE_NAME = 'knoten-cache-v2'

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

  // Ignore non-GET requests or non-http protocols
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return
  }

  // API calls: Network-first, return JSON offline status if network fails
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

  // Next.js RSC payload requests (headers: RSC: 1 or query _rsc)
  const isRSC = url.searchParams.has('_rsc') || request.headers.get('RSC')
  if (isRSC) {
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
          // Returning 503 instructs Next.js client router to perform a full document navigation,
          // which will be handled by our offline App Shell below!
          return new Response('', { status: 503, statusText: 'Offline' })
        })
    )
    return
  }

  // Navigation requests: Network-First with Cache Fallback and Activity Shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              // If this is an activity page, save as the generic activity shell for offline usage
              if (url.pathname.startsWith('/actividad/')) {
                cache.put('/actividad-shell', response.clone())
              }
              // If this is a course page, save as the generic course shell
              if (url.pathname.startsWith('/curso/')) {
                cache.put('/curso-shell', response.clone())
              }
            })
          }
          return response
        })
        .catch(async () => {
          // 1. Exact match in cache
          const cached = await caches.match(request)
          if (cached) return cached

          // 2. If navigating to an activity URL while offline, return the activity shell or any cached activity page
          if (url.pathname.startsWith('/actividad/')) {
            const shell = await caches.match('/actividad-shell')
            if (shell) return shell

            const cache = await caches.open(CACHE_NAME)
            const keys = await cache.keys()
            const activityKey = keys.find((k) => new URL(k.url).pathname.startsWith('/actividad/'))
            if (activityKey) {
              const anyActivity = await cache.match(activityKey)
              if (anyActivity) return anyActivity
            }
          }

          // 3. If navigating to a course URL while offline, try course shell or any cached course page
          if (url.pathname.startsWith('/curso/')) {
            const shell = await caches.match('/curso-shell')
            if (shell) return shell

            const cache = await caches.open(CACHE_NAME)
            const keys = await cache.keys()
            const courseKey = keys.find((k) => new URL(k.url).pathname.startsWith('/curso/'))
            if (courseKey) {
              const anyCourse = await cache.match(courseKey)
              if (anyCourse) return anyCourse
            }
          }

          // 4. Try root page
          if (url.pathname === '/') {
            const root = await caches.match('/')
            if (root) return root
          }

          // 5. Final fallback to offline.html
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

