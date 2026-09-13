'use client'

import SessionOfflineControls from './SessionOfflineControls'

export default function OfflineSessionBadge({
  sessionId,
  className,
}: {
  sessionId: string
  className?: string
}) {
  return <SessionOfflineControls sessionId={sessionId} className={className} />
}
