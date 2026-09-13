import { notFound } from "next/navigation"
import { createClient, getCurrentUser } from "@/lib/supabase/server"
import FlowCanvas, { Block, BlockConnection } from "@/components/canvas/FlowCanvas"

export default async function ActividadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()

  // Fetch current activity with blocks, connections, and session info
  const { data: activity, error: activityError } = await supabase
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
        tipo,
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
    .single()

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
  const sessionType: 'clase' | 'repaso' = sessionData?.tipo || 'clase'
  const sessionName: string = sessionData?.nombre || ''

  // Fetch all sibling activities in this session for the activity selector dropdown
  const { data: siblingActivities } = await supabase
    .from("activities")
    .select("id, titulo, orden")
    .eq("session_id", activity.session_id)
    .order("orden", { ascending: true })

  const sessionActivities = (siblingActivities ?? []).map((a) => ({
    id: a.id,
    titulo: a.titulo,
    orden: a.orden,
  }))

  // Fetch initial progress if user is authenticated
  const user = await getCurrentUser()
  const initialCompletedMap: Record<string, boolean> = {}

  if (user && sessionActivities.length > 0) {
    const { data: progressRows } = await supabase
      .from("progress")
      .select("activity_id, completado")
      .eq("student_id", user.id)
      .in("activity_id", sessionActivities.map((a) => a.id))

    if (progressRows) {
      for (const p of progressRows) {
        if (p.completado) {
          initialCompletedMap[p.activity_id] = true
        }
      }
    }
  }

  return (
    // Full-screen shell – Toolbar and top navigation handles routing
    <main className="w-full h-screen overflow-hidden">
      <FlowCanvas
        activityId={activity.id}
        activityTitle={activity.titulo}
        activityOrder={activity.orden}
        courseId={courseId}
        courseName={courseName}
        sessionName={sessionName}
        sessionType={sessionType}
        sessionActivities={sessionActivities}
        initialCompletedMap={initialCompletedMap}
        blocks={sortedBlocks}
        connections={connections}
        enunciado={activity.enunciado ?? ''}
        resultadoEsperado={activity.resultado_esperado ?? ''}
      />
    </main>
  )
}