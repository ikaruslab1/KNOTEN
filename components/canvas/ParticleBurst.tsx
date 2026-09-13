'use client'

import { useEffect, useState } from 'react'

export interface ParticleBurstEvent {
  id: string
  x: number
  y: number
}

interface Particle {
  id: number
  tx: number
  ty: number
  size: number
  color: string
  delay: number
}

const COLORS = ['#18181b', '#3f3f46', '#71717a', '#f59e0b', '#ef4444']

export default function ParticleBurst({
  bursts,
  onClear,
}: {
  bursts: ParticleBurstEvent[]
  onClear?: (id: string) => void
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bursts.map((burst) => (
        <SingleBurst key={burst.id} burst={burst} onComplete={() => onClear?.(burst.id)} />
      ))}
    </div>
  )
}

function SingleBurst({
  burst,
  onComplete,
}: {
  burst: ParticleBurstEvent
  onComplete?: () => void
}) {
  const [particles] = useState<Particle[]>(() => {
    const list: Particle[] = []
    const count = 12
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * 2 * Math.PI + (Math.random() * 0.4 - 0.2)
      const distance = 25 + Math.random() * 45
      list.push({
        id: i,
        tx: Math.cos(angle) * distance,
        ty: Math.sin(angle) * distance,
        size: 3.5 + Math.random() * 3.5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.05,
      })
    }
    return list
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.()
    }, 550)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: burst.x,
        top: burst.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Shockwave expanding ring */}
      <div
        className="absolute -inset-4 rounded-full border-2 border-zinc-400/60 pointer-events-none"
        style={{
          animation: 'particlePop 0.4s ease-out forwards',
          ['--tx' as any]: '0px',
          ['--ty' as any]: '0px',
        }}
      />

      {/* Radiating sparks */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            left: '50%',
            top: '50%',
            marginLeft: `-${p.size / 2}px`,
            marginTop: `-${p.size / 2}px`,
            animation: 'particlePop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1) forwards',
            animationDelay: `${p.delay}s`,
            ['--tx' as any]: `${p.tx}px`,
            ['--ty' as any]: `${p.ty}px`,
          }}
        />
      ))}
    </div>
  )
}
