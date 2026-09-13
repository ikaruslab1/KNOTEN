'use client'

import { useEffect, useState, useRef } from 'react'
import { ConnectionLineComponentProps } from 'reactflow'

export default function ElasticConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const [oscillation, setOscillation] = useState(0)
  const lastPos = useRef({ x: toX, y: toY, time: Date.now() })
  const animFrame = useRef<number | null>(null)

  useEffect(() => {
    const now = Date.now()
    const dx = toX - lastPos.current.x
    const dy = toY - lastPos.current.y
    const speed = Math.sqrt(dx * dx + dy * dy)
    lastPos.current = { x: toX, y: toY, time: now }

    // When movement is small / settling, initiate a damped elastic oscillation
    let startTime = performance.now()
    const initialAmp = Math.min(22, Math.max(6, speed * 0.4))

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000 // in seconds
      if (elapsed > 0.6) {
        setOscillation(0)
        return
      }
      // Damped sine wave: y = A * e^(-lambda * t) * sin(omega * t)
      const decay = Math.exp(-elapsed * 6)
      const osc = initialAmp * decay * Math.sin(elapsed * 24)
      setOscillation(osc)
      animFrame.current = requestAnimationFrame(animate)
    }

    if (animFrame.current) cancelAnimationFrame(animFrame.current)
    animFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current)
    }
  }, [toX, toY])

  // Compute curve with elastic sag and oscillation
  const dx = toX - fromX
  const dy = toY - fromY
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Elastic tension sag: longer cables sag more, but high-tension straightens slightly
  const sagBase = Math.min(45, Math.max(12, dist * 0.12))
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2 + sagBase + oscillation

  // Quadratic/Cubic bezier elastic path
  const path = `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`

  return (
    <g className="pointer-events-none">
      {/* Subtle elastic shadow / glow */}
      <path
        d={path}
        fill="none"
        stroke="#71717a"
        strokeWidth="4"
        strokeOpacity="0.25"
        strokeLinecap="round"
      />

      {/* Main elastic rubber line */}
      <path
        d={path}
        fill="none"
        stroke="#18181b"
        strokeWidth="2.75"
        strokeLinecap="round"
        style={{
          ...connectionLineStyle,
          transition: 'stroke 0.15s ease',
        }}
      />

      {/* Elastic rubber tip indicator */}
      <circle
        cx={toX}
        cy={toY}
        r="5.5"
        fill="#18181b"
        stroke="#ffffff"
        strokeWidth="2"
        className="animate-pulse"
      />
    </g>
  )
}
