'use client'

import { memo, useState } from 'react'
import { NodeProps, useReactFlow, NodeResizer } from 'reactflow'
import { Trash2, Move } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RectangleSpecialEffect =
  | 'rainbow'
  | 'danger'
  | 'heart'
  | 'skull'
  | 'dino'
  | 'monkey'
  | 'correct'
  | 'incorrect'
  | 'question'

export type RectangleNodeData = {
  width?: number
  height?: number
  isRainbow?: boolean
  specialEffect?: RectangleSpecialEffect | null
  activeBorderColor?: string | null
  activeBgColor?: string | null
  onDelete?: (id: string) => void
  readOnly?: boolean
}

// ─── Subcomponents for Special Rectangle Effects ─────────────────────────────

const RADIOACTIVE_PARTICLES = [
  { left: '14%', bottom: '20%', rx: '-10px', dur: '2.0s', delay: '0s', size: 6 },
  { left: '26%', bottom: '15%', rx: '14px', dur: '2.4s', delay: '0.4s', size: 8 },
  { left: '40%', bottom: '24%', rx: '-16px', dur: '2.1s', delay: '0.8s', size: 5 },
  { left: '58%', bottom: '18%', rx: '12px', dur: '2.5s', delay: '0.2s', size: 7 },
  { left: '74%', bottom: '22%', rx: '-12px', dur: '2.0s', delay: '1.0s', size: 6 },
  { left: '88%', bottom: '15%', rx: '16px', dur: '2.3s', delay: '0.6s', size: 5 },
  { left: '20%', bottom: '46%', rx: '8px', dur: '2.6s', delay: '1.2s', size: 6 },
  { left: '50%', bottom: '42%', rx: '-10px', dur: '2.2s', delay: '1.4s', size: 8 },
  { left: '82%', bottom: '48%', rx: '14px', dur: '2.4s', delay: '0.9s', size: 6 },
]

function RadioactiveParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl select-none">
      {RADIOACTIVE_PARTICLES.map((p, idx) => (
        <div
          key={idx}
          className="radioactive-particle absolute rounded-full"
          style={{
            left: p.left,
            bottom: p.bottom,
            width: p.size,
            height: p.size,
            background: 'radial-gradient(circle, #fef08a 25%, #84cc16 80%, transparent)',
            boxShadow: '0 0 8px #a3e635, 0 0 14px #eab308',
            ['--rx' as any]: p.rx,
            ['--dur' as any]: p.dur,
            ['--delay' as any]: p.delay,
          }}
        />
      ))}
    </div>
  )
}

const HEART_PARTICLES = [
  { left: '12%', bottom: '8%', sway: '14px', rot: '12deg', dur: '2.8s', delay: '0s', icon: '❤️', size: 16 },
  { left: '28%', bottom: '6%', sway: '-16px', rot: '-10deg', dur: '3.2s', delay: '0.5s', icon: '💕', size: 14 },
  { left: '46%', bottom: '10%', sway: '18px', rot: '16deg', dur: '2.9s', delay: '1.1s', icon: '💖', size: 18 },
  { left: '64%', bottom: '5%', sway: '-12px', rot: '-14deg', dur: '3.4s', delay: '0.3s', icon: '💓', size: 15 },
  { left: '82%', bottom: '9%', sway: '15px', rot: '8deg', dur: '3.0s', delay: '0.8s', icon: '❤️', size: 14 },
  { left: '22%', bottom: '26%', sway: '-14px', rot: '-8deg', dur: '3.1s', delay: '1.6s', icon: '💖', size: 15 },
  { left: '74%', bottom: '24%', sway: '12px', rot: '14deg', dur: '2.7s', delay: '1.9s', icon: '💕', size: 14 },
]

function HeartParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl select-none">
      {HEART_PARTICLES.map((h, idx) => (
        <span
          key={idx}
          className="heart-particle absolute select-none leading-none"
          style={{
            left: h.left,
            bottom: h.bottom,
            fontSize: `${h.size}px`,
            ['--sway' as any]: h.sway,
            ['--rot' as any]: h.rot,
            ['--dur' as any]: h.dur,
            ['--delay' as any]: h.delay,
          }}
        >
          {h.icon}
        </span>
      ))}
    </div>
  )
}

const FLIES = [
  { left: '18%', top: '22%', cls: 'fly-particle-1', dur: '2.3s', delay: '0s' },
  { left: '42%', top: '32%', cls: 'fly-particle-2', dur: '2.7s', delay: '0.3s' },
  { left: '68%', top: '18%', cls: 'fly-particle-3', dur: '3.0s', delay: '0.7s' },
  { left: '28%', top: '62%', cls: 'fly-particle-2', dur: '2.5s', delay: '1.1s' },
  { left: '58%', top: '68%', cls: 'fly-particle-1', dur: '2.8s', delay: '0.5s' },
  { left: '82%', top: '52%', cls: 'fly-particle-3', dur: '2.6s', delay: '1.3s' },
]

function BuzzingFlies() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible rounded-xl select-none">
      {FLIES.map((f, idx) => (
        <div
          key={idx}
          className={cn("absolute pointer-events-none select-none", f.cls)}
          style={{
            left: f.left,
            top: f.top,
            ['--dur' as any]: f.dur,
            ['--delay' as any]: f.delay,
          }}
        >
          <div className="relative w-3.5 h-3 flex items-center justify-center">
            {/* Fly body */}
            <div className="w-2.5 h-1.5 bg-zinc-900 rounded-full shadow-xs" />
            {/* Rapidly vibrating wings */}
            <div className="fly-wings absolute -top-1 left-0.5 w-1.5 h-1.5 bg-white/75 rounded-full border border-zinc-400/50 -rotate-15" />
            <div className="fly-wings absolute -top-1 right-0.5 w-1.5 h-1.5 bg-white/75 rounded-full border border-zinc-400/50 rotate-15" />
          </div>
        </div>
      ))}
    </div>
  )
}

const EMBERS = [
  { left: '10%', bottom: '3px', drift: '8px', dur: '1.6s', delay: '0s', size: 4, bg: '#facc15' },
  { left: '22%', bottom: '5px', drift: '-10px', dur: '2.0s', delay: '0.3s', size: 5, bg: '#f97316' },
  { left: '35%', bottom: '3px', drift: '12px', dur: '1.7s', delay: '0.7s', size: 6, bg: '#ef4444' },
  { left: '48%', bottom: '6px', drift: '-8px', dur: '2.2s', delay: '0.2s', size: 4, bg: '#facc15' },
  { left: '60%', bottom: '4px', drift: '10px', dur: '1.8s', delay: '0.9s', size: 5, bg: '#f97316' },
  { left: '72%', bottom: '5px', drift: '-12px', dur: '2.1s', delay: '0.4s', size: 6, bg: '#ef4444' },
  { left: '85%', bottom: '3px', drift: '6px', dur: '1.5s', delay: '0.8s', size: 4, bg: '#facc15' },
  { left: '93%', bottom: '6px', drift: '-8px', dur: '1.9s', delay: '1.2s', size: 5, bg: '#f97316' },
]

function FireFlamesAndEmbers() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl select-none">
      {/* Warm flame aura at base */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-red-600/25 via-orange-500/10 to-transparent rounded-b-xl" />
      {/* Rising incandescent embers */}
      {EMBERS.map((e, idx) => (
        <div
          key={idx}
          className="fire-ember absolute rounded-full"
          style={{
            left: e.left,
            bottom: e.bottom,
            width: e.size,
            height: e.size,
            backgroundColor: e.bg,
            boxShadow: `0 0 8px ${e.bg}, 0 0 14px #ea580c`,
            ['--drift' as any]: e.drift,
            ['--dur' as any]: e.dur,
            ['--delay' as any]: e.delay,
          }}
        />
      ))}
    </div>
  )
}

function FurBorder() {
  const strandCountHoriz = 16
  const strandCountVert = 10

  return (
    <div className="absolute -inset-2 pointer-events-none overflow-visible select-none">
      {/* Top Edge */}
      <div className="absolute top-0 left-2 right-2 flex justify-between">
        {Array.from({ length: strandCountHoriz }).map((_, i) => (
          <div
            key={`top-${i}`}
            className="fur-strand w-1 h-3 rounded-full bg-amber-950/85 shadow-xs"
            style={{
              ['--rot' as any]: `${(i % 5 - 2) * 8}deg`,
              ['--sway' as any]: `${(i % 3 === 0 ? 1 : -1) * 8}deg`,
              ['--dur' as any]: `${1.3 + (i % 4) * 0.25}s`,
              ['--delay' as any]: `${(i % 5) * 0.15}s`,
            }}
          />
        ))}
      </div>
      {/* Bottom Edge */}
      <div className="absolute bottom-0 left-2 right-2 flex justify-between">
        {Array.from({ length: strandCountHoriz }).map((_, i) => (
          <div
            key={`bot-${i}`}
            className="fur-strand w-1 h-3 rounded-full bg-amber-900/85 shadow-xs"
            style={{
              ['--rot' as any]: `${180 + (i % 5 - 2) * 8}deg`,
              ['--sway' as any]: `${(i % 3 === 0 ? -1 : 1) * 8}deg`,
              ['--dur' as any]: `${1.4 + (i % 4) * 0.2}s`,
              ['--delay' as any]: `${(i % 5) * 0.12}s`,
            }}
          />
        ))}
      </div>
      {/* Left Edge */}
      <div className="absolute top-2 bottom-2 left-0 flex flex-col justify-between">
        {Array.from({ length: strandCountVert }).map((_, i) => (
          <div
            key={`left-${i}`}
            className="fur-strand h-1 w-3 rounded-full bg-amber-950/85 shadow-xs"
            style={{
              ['--rot' as any]: `${-90 + (i % 5 - 2) * 8}deg`,
              ['--sway' as any]: `${(i % 3 === 0 ? 1 : -1) * 8}deg`,
              ['--dur' as any]: `${1.5 + (i % 4) * 0.2}s`,
              ['--delay' as any]: `${(i % 5) * 0.18}s`,
            }}
          />
        ))}
      </div>
      {/* Right Edge */}
      <div className="absolute top-2 bottom-2 right-0 flex flex-col justify-between">
        {Array.from({ length: strandCountVert }).map((_, i) => (
          <div
            key={`right-${i}`}
            className="fur-strand h-1 w-3 rounded-full bg-amber-900/85 shadow-xs"
            style={{
              ['--rot' as any]: `${90 + (i % 5 - 2) * 8}deg`,
              ['--sway' as any]: `${(i % 3 === 0 ? -1 : 1) * 8}deg`,
              ['--dur' as any]: `${1.3 + (i % 4) * 0.22}s`,
              ['--delay' as any]: `${(i % 5) * 0.14}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

const RectangleNode = memo(({ id, data, selected }: NodeProps<RectangleNodeData>) => {
  const { setNodes } = useReactFlow()
  const [isHovered, setIsHovered] = useState(false)

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (data?.onDelete) {
      data.onDelete(id)
    }
    setNodes((nodes) => nodes.filter((n) => n.id !== id))
  }

  // Rectangles remain interactive even after code execution
  const showControls = selected || isHovered
  const specialEffect = data?.specialEffect
  const isRainbow = Boolean(data?.isRainbow || specialEffect === 'rainbow')
  const activeBorder = data?.activeBorderColor

  // Determine specific border CSS class based on effect
  let borderClass = "border-2"
  if (isRainbow) {
    borderClass = "rainbow-rectangle-border"
  } else if (specialEffect === 'danger') {
    borderClass = "danger-rectangle-border"
  } else if (specialEffect === 'dino') {
    borderClass = "dino-rectangle-border"
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-full select-none group"
      style={{ minWidth: 60, minHeight: 40 }}
    >
      {/* NodeResizer for resizing from aristas (lines) and corners */}
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-zinc-500/80 !border-dashed"
        handleClassName="!w-3 !h-3 !bg-white !border-2 !border-zinc-700 !rounded-xs !shadow-md hover:!scale-125 transition-transform"
      />

      {/* Center Action Pill: Mover & Borrar buttons (centered, away from aristas) */}
      {showControls && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-zinc-200 rounded-xl shadow-xl px-2 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Mover button / drag handle */}
          <div
            className="rect-drag-handle flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold cursor-grab active:cursor-grabbing transition-colors"
            title="Arrastra para mover el rectángulo"
          >
            <Move className="w-3.5 h-3.5 text-zinc-600" />
            <span>Mover</span>
          </div>

          <div className="w-px h-5 bg-zinc-200 mx-0.5" />

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            className="nodrag nopan flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            title="Eliminar rectángulo"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* Special Active Particle / Animation Overlays */}
      {specialEffect === 'danger' && <RadioactiveParticles />}
      {specialEffect === 'heart' && <HeartParticles />}
      {specialEffect === 'skull' && <BuzzingFlies />}
      {specialEffect === 'dino' && <FireFlamesAndEmbers />}
      {specialEffect === 'monkey' && <FurBorder />}

      {/* The Rectangle box */}
      <div
        className={cn(
          "w-full h-full rounded-xl transition-all duration-200",
          borderClass
        )}
        style={
          isRainbow
            ? undefined
            : {
                borderColor: activeBorder || "#a1a1aa", // default neutral gray border
                backgroundColor: "transparent", // overlay renders the 8% tint over elements
              }
        }
      />
    </div>
  )
})

RectangleNode.displayName = 'RectangleNode'

export default RectangleNode
