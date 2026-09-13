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
  const totalSag = sagBase + oscillation

  // Cubic bezier with horizontal departure from handle arista
  const curvature = Math.max(25, Math.min(100, Math.abs(dx) * 0.45))
  const c1x = fromX + curvature
  const c1y = fromY + totalSag * 0.6
  const c2x = toX - curvature * 0.5
  const c2y = toY + totalSag * 0.6
  const path = `M ${fromX} ${fromY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toX} ${toY}`

  return (
    <g className="pointer-events-none">
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
