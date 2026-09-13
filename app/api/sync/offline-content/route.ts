import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = supabaseAdmin

    // 1. Fetch courses with professor profile info
    const { data: courses, error: coursesError } = await supabase
      .from('courses')
      .select(`
        id,
        nombre,
        imagen_url,
        profesor_id,
        created_at,
        profiles (
          nombre,
          apellido_paterno
        )
      `)

    if (coursesError) {
      return NextResponse.json({ error: coursesError.message }, { status: 500 })
    }

    // 2. Fetch sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, curso_id, nombre, tipo, fecha_liberacion, orden, created_at')
      .order('orden', { ascending: true })

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 })
    }

    // 3. Fetch activities with blocks, connections, and session metadata
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select(`
        id,
        session_id,
        titulo,
        enunciado,
        resultado_esperado,
        orden,
        created_at,
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
          orden_correcto,
          indent_level
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
      `)
      .order('orden', { ascending: true })

    if (activitiesError) {
      return NextResponse.json({ error: activitiesError.message }, { status: 500 })
    }

    // Transform courses
    const formattedCourses = (courses || []).map((c: any) => ({
      id: c.id,
      nombre: c.nombre,
      imagen_url: c.imagen_url,
      profesor_id: c.profesor_id,
      profesor_nombre: c.profiles
        ? `${c.profiles.nombre} ${c.profiles.apellido_paterno}`.trim()
        : 'Profesor',
      updated_at: c.created_at,
    }))

    // Transform sessions
    const formattedSessions = (sessions || []).map((s: any) => ({
      id: s.id,
      curso_id: s.curso_id,
      nombre: s.nombre,
      tipo: s.tipo,
      fecha_liberacion: s.fecha_liberacion,
      orden: s.orden,
      updated_at: s.created_at,
    }))

    // Transform activities
    const formattedActivities = (activities || []).map((a: any) => {
      const sessionData = a.sessions as any
      return {
        id: a.id,
        session_id: a.session_id,
        titulo: a.titulo,
        enunciado: a.enunciado,
        resultado_esperado: a.resultado_esperado,
        orden: a.orden,
        updated_at: a.created_at,
        blocks: (a.blocks || []).sort(
          (b1: any, b2: any) => (b1.orden_correcto ?? 0) - (b2.orden_correcto ?? 0)
        ),
        connections: a.connections || [],
        session_nombre: sessionData?.nombre,
        session_tipo: sessionData?.tipo,
        curso_id: sessionData?.curso_id || sessionData?.courses?.id,
        curso_nombre: sessionData?.courses?.nombre,
      }
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      courses: formattedCourses,
      sessions: formattedSessions,
      activities: formattedActivities,
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Error syncing offline content' },
      { status: 500 }
    )
  }
}
