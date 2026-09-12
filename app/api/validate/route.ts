import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── Types ────────────────────────────────────────────────────────────────────

type StudentConnection = {
  sourceBlockId: string
  targetBlockId: string
  sourceHandle?: string
  targetHandle?: string
}

type ValidateBody = {
  activityId: string
  studentConnections: StudentConnection[]
  studentBlockOrder: string[]
}

// ── Supabase clients ─────────────────────────────────────────────────────────

/** Admin client — bypasses RLS for reading activity answers. */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}

/** Server client — honours RLS, used to identify the current user. */
async function getServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        },
      },
    },
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a connection so order-independent comparison is easy.
 * Connections are considered matching when source+target+handles all agree.
 */
function normaliseConnection(c: StudentConnection): string {
  return JSON.stringify({
    s: c.sourceBlockId,
    t: c.targetBlockId,
    sh: c.sourceHandle ?? null,
    th: c.targetHandle ?? null,
  })
}

function connectionsMatch(
  student: StudentConnection[],
  correct: StudentConnection[],
): boolean {
  if (student.length !== correct.length) return false
  const correctSet = new Set(correct.map(normaliseConnection))
  return student.every((c) => correctSet.has(normaliseConnection(c)))
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────
  let body: ValidateBody

  try {
    body = (await request.json()) as ValidateBody
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cuerpo de la solicitud invalido.' },
      { status: 400 },
    )
  }

  const { activityId, studentConnections, studentBlockOrder } = body

  if (
    typeof activityId !== 'string' ||
    !Array.isArray(studentConnections) ||
    !Array.isArray(studentBlockOrder)
  ) {
    return NextResponse.json(
      { success: false, message: 'Faltan campos requeridos.' },
      { status: 422 },
    )
  }

  // ── 2. Authenticate user ───────────────────────────────────────────────
  const supabaseUser = await getServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { success: false, message: 'No autenticado.' },
      { status: 401 },
    )
  }

  const adminClient = getAdminClient()

  // ── 3. Fetch correct blocks (ordered by orden_correcto) ────────────────
  const { data: correctBlocks, error: blocksError } = await adminClient
    .from('blocks')
    .select('id, orden_correcto')
    .eq('activity_id', activityId)
    .order('orden_correcto', { ascending: true })

  if (blocksError || !correctBlocks) {
    console.error('[validate] Error fetching blocks:', blocksError)
    return NextResponse.json(
      { success: false, message: 'Error al obtener los bloques de la actividad.' },
      { status: 500 },
    )
  }

  // ── 4. Fetch correct connections ───────────────────────────────────────
  const { data: correctConnections, error: connError } = await adminClient
    .from('connections')
    .select('source_block_id, target_block_id, source_handle, target_handle')
    .eq('activity_id', activityId)

  if (connError) {
    console.error('[validate] Error fetching connections:', connError)
    return NextResponse.json(
      { success: false, message: 'Error al obtener las conexiones de la actividad.' },
      { status: 500 },
    )
  }

  // ── 5. Compare block order ─────────────────────────────────────────────
  const correctOrder = correctBlocks.map((b) => b.id as string)
  const orderCorrect =
    studentBlockOrder.length === correctOrder.length &&
    studentBlockOrder.every((id, i) => id === correctOrder[i])

  // ── 6. Compare connections ─────────────────────────────────────────────
  const mappedCorrectConnections: StudentConnection[] = (correctConnections ?? []).map(
    (c) => ({
      sourceBlockId: c.source_block_id as string,
      targetBlockId: c.target_block_id as string,
      sourceHandle: (c.source_handle as string | null) ?? undefined,
      targetHandle: (c.target_handle as string | null) ?? undefined,
    }),
  )

  const connectCorrect = connectionsMatch(studentConnections, mappedCorrectConnections)

  const isSuccess = orderCorrect && connectCorrect

  // ── 7. Upsert progress record ──────────────────────────────────────────
  const { data: existingProgress } = await adminClient
    .from('progress')
    .select('intentos, completado')
    .eq('student_id', user.id)
    .eq('activity_id', activityId)
    .maybeSingle()

  const prevAttempts = (existingProgress?.intentos as number | null) ?? 0
  const alreadyCompleted = (existingProgress?.completado as boolean | null) ?? false

  const progressUpdate: Record<string, unknown> = {
    student_id: user.id,
    activity_id: activityId,
    intentos: prevAttempts + 1,
    completado: alreadyCompleted || isSuccess,
    ...(isSuccess && !alreadyCompleted
      ? { fecha_completado: new Date().toISOString() }
      : {}),
  }

  const { error: upsertError } = await adminClient
    .from('progress')
    .upsert(progressUpdate, { onConflict: 'student_id,activity_id' })

  if (upsertError) {
    // Non-fatal — log but still return the validation result
    console.error('[validate] Error upserting progress:', upsertError)
  }

  // ── 8. Return result ───────────────────────────────────────────────────
  if (isSuccess) {
    return NextResponse.json(
      { success: true, message: '¡Correcto! Has completado la actividad.' },
      { status: 200 },
    )
  }

  const hint =
    !orderCorrect && !connectCorrect
      ? 'El orden de los bloques y las conexiones no son correctas.'
      : !orderCorrect
        ? 'El orden de los bloques no es correcto.'
        : 'Las conexiones entre bloques no son correctas.'

  return NextResponse.json(
    { success: false, message: hint },
    { status: 200 },
  )
}
