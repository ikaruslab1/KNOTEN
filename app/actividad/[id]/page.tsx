import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import FlowCanvas from "@/components/canvas/FlowCanvas"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockType = "codigo" | "indentacion" | "sticker"

export interface Block {
  id: string
  actividad_id: string
  tipo: BlockType
  contenido: string
  posicion_x: number
  posicion_y: number
  orden: number
}

export interface BlockConnection {
  id: string
  actividad_id: string
  source_block_id: string
  target_block_id: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ActividadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  // Parallel fetch: activity data + current user
  const [
    { data: activity, error: activityError },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("actividades")
      .select(
        `
        id,
        titulo,
        enunciado,
        resultado_esperado,
        bloques (
          id,
          actividad_id,
          tipo,
          contenido,
          posicion_x,
          posicion_y,
          orden
        ),
        conexiones (
          id,
          actividad_id,
          source_block_id,
          target_block_id
        )
      `
      )
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (activityError || !activity) {
    notFound()
  }

  // Sort blocks by their intended order so the canvas initialises predictably
  const sortedBlocks: Block[] = [...((activity as any).bloques ?? [])].sort(
    (a: Block, b: Block) => a.orden - b.orden
  )

  const connections: BlockConnection[] = (activity as any).conexiones ?? []

  return (
    // Full-screen shell – no header, the FlowCanvas Toolbar IS the navigation
    <main className="w-full h-screen overflow-hidden">
      <FlowCanvas
        activityId={(activity as any).id}
        blocks={sortedBlocks}
        connections={connections}
        enunciado={(activity as any).enunciado}
        resultadoEsperado={(activity as any).resultado_esperado}
      />
    </main>
  )
}