const CACHE_NAME = 'knoten-cache-v3'

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
]

// Fast fetch with AbortController timeout to prevent hanging on PC/Windows TCP timeouts (10-21s)
function fetchWithTimeout(request, timeoutMs = 1500) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject(new Error('Device is offline'))
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(request, { signal: controller.signal })
    .then((response) => {
      clearTimeout(timer)
      return response
    })
    .catch((err) => {
      clearTimeout(timer)
      throw err
    })
}

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

  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

  // ── 1. API calls ─────────────────────────────────────────────────────────────
  if (url.pathname.startsWith('/api/')) {
    if (isOffline) {
      event.respondWith(
        new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      return
    }

    event.respondWith(
      fetchWithTimeout(request, 2000).catch(() => {
        return new Response(JSON.stringify({ error: 'offline', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      })
    )
    return
  }

  // ── 2. Next.js RSC payload requests ──────────────────────────────────────────
  const isRSC = url.searchParams.has('_rsc') || request.headers.get('RSC')
  if (isRSC) {
    if (isOffline) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached
          // Instruct Next.js client router to perform a full document navigation,
          // which will be handled immediately by our offline App Shell below!
          return new Response('', { status: 503, statusText: 'Offline' })
        })
      )
      return
    }

    event.respondWith(
      fetchWithTimeout(request, 1200)
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
          return new Response('', { status: 503, statusText: 'Offline' })
        })
    )
    return
  }

  // ── 3. Navigation requests ───────────────────────────────────────────────────
  if (request.mode === 'navigate') {
    const serveOfflineNavigation = async () => {
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

      // 5. Fallback to offline.html if cached
      const fallback = await caches.match('/offline.html')
      if (fallback) return fallback

      // 6. Safe inline fallback document
      return new Response(
        `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knoten - Sin conexión</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #18181b; padding: 20px; box-sizing: border-box; text-align: center; }
    .card { background: white; border: 1px solid #e4e4e7; border-radius: 20px; padding: 36px 28px; max-width: 420px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
    h1 { font-size: 19px; margin: 0 0 10px; font-weight: 700; color: #18181b; }
    p { font-size: 14px; color: #71717a; line-height: 1.5; margin: 0 0 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; background: #18181b; color: white; padding: 11px 22px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: background 0.15s ease; }
    .btn:hover { background: #27272a; }
  </style>
</head>
<body>
  <div class="card">
    <h1>No se pudo conectar</h1>
    <p>Comprueba tu conexión a internet o intenta recargar la página.</p>
    <button class="btn" onclick="window.location.reload()">Reintentar</button>
  </div>
</body>
</html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      )
    }

    // If offline, respond IMMEDIATELY with cached document (0 ms)
    if (isOffline) {
      event.respondWith(serveOfflineNavigation())
      return
    }

    // Online: Fast network race with 1.5s timeout, then fall back immediately to cache
    event.respondWith(
      fetchWithTimeout(request, 1500)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone)
              if (url.pathname.startsWith('/actividad/')) {
                cache.put('/actividad-shell', response.clone())
              }
              if (url.pathname.startsWith('/curso/')) {
                cache.put('/curso-shell', response.clone())
              }
            })
          }
          return response
        })
        .catch(() => serveOfflineNavigation())
    )
    return
  }

  // ── 4. Static assets (Next.js chunks, CSS, fonts, images) ───────────────────
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // If cached and online, revalidate in background with timeout
        if (!isOffline) {
          fetchWithTimeout(request, 2000)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone()
                caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
              }
            })
            .catch(() => {})
        }
        return cachedResponse
      }

      // Not in cache
      if (isOffline) {
        return new Response('', { status: 503, statusText: 'Offline Asset Not Cached' })
      }

      return fetchWithTimeout(request, 2000)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return networkResponse
        })
        .catch(() => new Response('', { status: 503, statusText: 'Network Failed' }))
    })
  )
})
