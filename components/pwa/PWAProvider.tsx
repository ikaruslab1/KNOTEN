'use client'

import { useEffect } from 'react'
import PWAInstallBanner from './PWAInstallBanner'
import SyncNotification from './SyncNotification'

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'development') {
        // In local development, unregister any active service worker to avoid stale caching & HMR conflicts
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister()
          }
        })
        return
      }

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for worker updates periodically
          registration.onupdatefound = () => {
            const installingWorker = registration.installing
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                  }
                }
              }
            }
          }
        })
        .catch((error) => {
          console.warn('PWA ServiceWorker registration issue:', error)
        })
    }
  }, [])

  return (
    <>
      {children}
      <PWAInstallBanner />
      <SyncNotification />
    </>
  )
}
