import { createClient, getCurrentUser } from "@/lib/supabase/server"
import { Block, BlockConnection } from "@/components/canvas/FlowCanvas"
import ActivityView, { ActivityViewInitialData } from "@/components/canvas/ActivityView"

export default async function ActividadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let initialData: ActivityViewInitialData | null = null

  try {
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
      .maybeSingle()

    if (activity && !activityError) {
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
      let initialCompletedMap: Record<string, boolean> = {}
      try {
        const user = await getCurrentUser()
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
      } catch {}

      initialData = {
        id: activity.id,
        titulo: activity.titulo,
        orden: activity.orden,
        enunciado: activity.enunciado,
        resultado_esperado: activity.resultado_esperado,
        blocks: sortedBlocks,
        connections,
        courseId,
        courseName,
        sessionType,
        sessionName,
        sessionActivities,
        initialCompletedMap,
      }
    }
  } catch (err) {
    console.warn("Could not fetch activity from Supabase on server (offline or build time):", err)
  }

  return (
    <main className="w-full h-screen overflow-hidden">
      <ActivityView activityId={id} initialActivity={initialData} />
    </main>
  )
}