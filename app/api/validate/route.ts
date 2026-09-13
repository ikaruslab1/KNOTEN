import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { executePythonCode, compareExecutionResults } from '@/lib/python-executor'
import { reconstructCodeFromBlocks } from '@/lib/code-reconstructor'

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
  studentBlockOrder?: string[]
  reconstructedCode?: string
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

function deriveBlockOrder(
  connections: StudentConnection[],
  correctBlockIds: string[],
): string[] {
  if (!connections || connections.length === 0) return []
  const validIds = new Set(correctBlockIds)
  const nextMap = new Map<string, string>()
  const inDegree = new Map<string, number>()

  for (const c of connections) {
    if (validIds.has(c.sourceBlockId) && validIds.has(c.targetBlockId)) {
      nextMap.set(c.sourceBlockId, c.targetBlockId)
      inDegree.set(c.targetBlockId, (inDegree.get(c.targetBlockId) || 0) + 1)
    }
  }

  const startId = correctBlockIds.find(
    (id) => !inDegree.has(id) && nextMap.has(id),
  )

  const order: string[] = []
  const visited = new Set<string>()
  let curr = startId

  while (curr && !visited.has(curr)) {
    visited.add(curr)
    order.push(curr)
    curr = nextMap.get(curr)
  }

  return order
}

function connectionsMatch(
  student: StudentConnection[],
  correct: StudentConnection[],
): boolean {
  if (student.length !== correct.length) return false
  const correctSet = new Set(correct.map((c) => `${c.sourceBlockId}->${c.targetBlockId}`))
  return student.every((c) => correctSet.has(`${c.sourceBlockId}->${c.targetBlockId}`))
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

  const { activityId, studentConnections, studentBlockOrder, reconstructedCode } = body

  if (
    typeof activityId !== 'string' ||
    !Array.isArray(studentConnections)
  ) {
    return NextResponse.json(
      { success: false, message: 'Faltan campos requeridos.' },
      { status: 422 },
    )
  }

  // ── 2. Authenticate user (optional) ───────────────────────────────────
  let user: { id: string } | null = null
  try {
    const supabaseUser = await getServerClient()
    const { data } = await supabaseUser.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  const adminClient = getAdminClient()

  // ── 3. Fetch activity details, correct blocks & connections in parallel ──
  const [
    { data: activityData },
    { data: correctBlocks, error: blocksError },
    { data: correctConnections, error: connError },
  ] = await Promise.all([
    adminClient
      .from('activities')
      .select('id, resultado_esperado, session_id, sessions ( tipo )')
      .eq('id', activityId)
      .maybeSingle(),
    adminClient
      .from('blocks')
      .select('id, tipo, contenido, orden_correcto, indent_level, posicion_y')
      .eq('activity_id', activityId)
      .order('orden_correcto', { ascending: true }),
    adminClient
      .from('connections')
      .select('source_block_id, target_block_id, source_handle, target_handle')
      .eq('activity_id', activityId),
  ])

  if (blocksError || !correctBlocks) {
    console.error('[validate] Error fetching blocks:', blocksError)
    return NextResponse.json(
      { success: false, message: 'Error al obtener los bloques de la actividad.' },
      { status: 500 },
    )
  }

  if (connError) {
    console.error('[validate] Error fetching connections:', connError)
    return NextResponse.json(
      { success: false, message: 'Error al obtener las conexiones de la actividad.' },
      { status: 500 },
    )
  }

  // ── 5. Compare block order (structural fallback) ───────────────────────
  const correctOrder = correctBlocks.map((b) => b.id as string)

  const effectiveBlockOrder =
    Array.isArray(studentBlockOrder) && studentBlockOrder.length > 0
      ? studentBlockOrder
      : deriveBlockOrder(studentConnections, correctOrder)

  const orderCorrect =
    effectiveBlockOrder.length === correctOrder.length &&
    effectiveBlockOrder.every((id, i) => id === correctOrder[i])

  let isSuccess = false
  let responseMessage = ''
  let executionStdout = ''

  // ── 6. Dynamic execution validation by comparing against original code ─
  if (typeof reconstructedCode === 'string' && reconstructedCode.trim().length > 0) {
    const referenceCode = reconstructCodeFromBlocks(correctBlocks as any[])

    // Execute both reference code and student code concurrently
    const [refResult, studentResult] = await Promise.all([
      executePythonCode(referenceCode),
      executePythonCode(reconstructedCode),
    ])

    const comparison = compareExecutionResults(refResult, studentResult)

    const expectedOutput = (activityData?.resultado_esperado ?? '').trim()
    const stuStdout = (studentResult.stdout ?? '').trim()
    const matchesExpected =
      expectedOutput.length > 0 &&
      (stuStdout === expectedOutput ||
        stuStdout.replace(/\s+/g, '') === expectedOutput.replace(/\s+/g, '') ||
        (studentResult.state &&
          Object.entries(studentResult.state).some(
            ([k, v]) => `${k}=${v}` === expectedOutput || `${k} = ${v}` === expectedOutput
          )))

    isSuccess = comparison.isSuccess || matchesExpected || orderCorrect
    responseMessage = comparison.responseMessage
    executionStdout = comparison.displayOutput

    if (matchesExpected && !comparison.isSuccess) {
      isSuccess = true
      responseMessage = '¡Correcto! El código se ejecutó y produjo el resultado esperado.'
    }

    if (!isSuccess && !studentResult.success) {
      responseMessage = studentResult.stderr || 'Error de sintaxis o ejecución en Python.'
    }
  } else {
    // Legacy / fallback: compare block order & connections
    const mappedCorrectConnections: StudentConnection[] = (correctConnections ?? []).map(
      (c) => ({
        sourceBlockId: c.source_block_id as string,
        targetBlockId: c.target_block_id as string,
        sourceHandle: (c.source_handle as string | null) ?? undefined,
        targetHandle: (c.target_handle as string | null) ?? undefined,
      }),
    )

    const connectCorrect = connectionsMatch(studentConnections, mappedCorrectConnections)
    isSuccess =
      connectCorrect ||
      (orderCorrect && studentConnections.length >= mappedCorrectConnections.length)

    if (isSuccess) {
      responseMessage = '¡Correcto! Has completado la actividad.'
    } else {
      responseMessage =
        !orderCorrect && !connectCorrect
          ? 'El orden de los bloques y las conexiones no son correctas.'
          : !orderCorrect
            ? 'El orden de los bloques no es correcto.'
            : 'Las conexiones entre bloques no son correctas.'
    }
  }

  // ── 7. Upsert progress record (Only for 'repaso' sessions; 'clase' is stored in local cache)
  const sessionTipo = (activityData?.sessions as any)?.tipo
  const isClaseActivity = sessionTipo === 'clase'

  if (!isClaseActivity && user) {
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
      console.error('[validate] Error upserting progress:', upsertError)
    }
  }

  // ── 8. Return result ───────────────────────────────────────────────────
  return NextResponse.json(
    {
      success: isSuccess,
      message: responseMessage,
      stdout: executionStdout,
      sessionType: sessionTipo || 'clase',
    },
    { status: 200 },
  )
}
