'use client'

import { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import { getOfflineActivitiesBySession } from '@/lib/offline/db'

export default function OfflineSessionBadge({
  sessionId,
}: {
  sessionId: string
}) {
  const [isCached, setIsCached] = useState(false)

  useEffect(() => {
    let mounted = true

    const checkCache = () => {
      getOfflineActivitiesBySession(sessionId)
        .then((activities) => {
          if (mounted && activities && activities.length > 0) {
            setIsCached(true)
          }
        })
        .catch(() => {})
    }

    checkCache()

    // Re-check whenever sync completes
    const handleSyncComplete = () => {
      checkCache()
    }

    window.addEventListener('knoten:sync-complete', handleSyncComplete)

    return () => {
      mounted = false
      window.removeEventListener('knoten:sync-complete', handleSyncComplete)
    }
  }, [sessionId])

  if (!isCached) return null

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 border border-zinc-200 text-[10px] font-medium text-zinc-600 select-none"
      title="Esta sesión está descargada y disponible para resolver sin conexión a internet"
    >
      <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
      <span>Disponible offline</span>
    </span>
  )
}
