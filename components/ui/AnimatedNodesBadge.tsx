'use client'

import { useState } from 'react'

export default function AnimatedNodesBadge() {
  const [hovered, setHovered] = useState(false)

  return (
    <span
      className="relative inline-block whitespace-nowrap cursor-pointer select-none group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background connecting nodes SVG */}
      <svg
        className="absolute -inset-x-3 -inset-y-2.5 w-[calc(100%+24px)] h-[calc(100%+20px)] pointer-events-none overflow-visible z-0 opacity-80 group-hover:opacity-100 transition-opacity"
        viewBox="0 0 240 50"
        fill="none"
        preserveAspectRatio="none"
      >
        {/* Animated connection path */}
        <path
          d="M 12 38 Q 60 8 120 38 T 228 16"
          stroke="currentColor"
          strokeWidth="1.75"
          className="text-zinc-300 dark:text-zinc-600 animate-line-dash"
        />

        {/* Node 1 */}
        <g className="animate-node-pulse" style={{ transformOrigin: '12px 38px', animationDelay: '0s' }}>
          <circle cx="12" cy="38" r="5" className="fill-zinc-100 stroke-zinc-900" strokeWidth="2" />
          <circle cx="12" cy="38" r="2" className="fill-zinc-900" />
        </g>

        {/* Node 2 (center) */}
        <g className="animate-node-pulse" style={{ transformOrigin: '120px 38px', animationDelay: '0.8s' }}>
          <circle cx="120" cy="38" r="5.5" className="fill-zinc-100 stroke-zinc-900" strokeWidth="2" />
          <circle cx="120" cy="38" r="2" className="fill-zinc-900" />
        </g>

        {/* Node 3 */}
        <g className="animate-node-pulse" style={{ transformOrigin: '228px 16px', animationDelay: '1.6s' }}>
          <circle cx="228" cy="16" r="5" className="fill-zinc-100 stroke-zinc-900" strokeWidth="2" />
          <circle cx="228" cy="16" r="2" className="fill-zinc-900" />
        </g>
      </svg>

      {/* Main Text */}
      <span className="relative z-10 font-black text-zinc-900 px-1 py-0.5 rounded-lg transition-colors group-hover:text-zinc-800">
        nodos lógicos
      </span>
    </span>
  )
}
