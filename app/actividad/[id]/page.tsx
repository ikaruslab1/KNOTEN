import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import FlowCanvas, { Block, BlockConnection } from "@/components/canvas/FlowCanvas"

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
      .from("activities")
      .select(
        `
        id,
        titulo,
        enunciado,
        resultado_esperado,
        orden,
        session_id,
        sessions (
          id,
          nombre,
          curso_id,
          courses (
            id,
            nombre
          )
        ),
        blocks (
          id,
          activity_id,
          tipo,
          contenido,
          posicion_x,
          posicion_y,
          indent_level,
          orden_correcto
        ),
        connections (
          id,
          activity_id,
          source_block_id,
          target_block_id,
          source_handle,
          target_handle,
          orden
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

  const rawBlocks = (activity.blocks as any[]) ?? []
  const sortedBlocks: Block[] = [...rawBlocks].sort(
    (a, b) => (a.orden_correcto ?? 0) - (b.orden_correcto ?? 0)
  )

  const connections: BlockConnection[] = (activity.connections as any[]) ?? []
  const sessionData = activity.sessions as any
  const courseId = sessionData?.curso_id || sessionData?.courses?.id || ''
  const courseName = sessionData?.courses?.nombre || ''

  return (
    // Full-screen shell – Toolbar and top navigation handles routing
    <main className="w-full h-screen overflow-hidden">
      <FlowCanvas
        activityId={activity.id}
        activityTitle={activity.titulo}
        courseId={courseId}
        courseName={courseName}
        blocks={sortedBlocks}
        connections={connections}
        enunciado={activity.enunciado ?? ''}
        resultadoEsperado={activity.resultado_esperado ?? ''}
      />
    </main>
  )
}