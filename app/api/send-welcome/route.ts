import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail, WelcomeEmailData } from '@/lib/resend'

export async function POST(request: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cuerpo de la solicitud invalido.' },
      { status: 400 },
    )
  }

  // ── Validate required fields ─────────────────────────────────────────────
  const required: (keyof WelcomeEmailData)[] = [
    'nombre',
    'apellidoPaterno',
    'apellidoMaterno',
    'grupo',
    'semestre',
    'carrera',
    'correoPersonal',
    'correoInstitucional',
    'password',
  ]

  const data = body as Record<string, unknown>

  for (const field of required) {
    if (typeof data[field] !== 'string' || (data[field] as string).trim() === '') {
      return NextResponse.json(
        { success: false, message: `El campo '${field}' es obligatorio.` },
        { status: 422 },
      )
    }
  }

  // ── Send email ───────────────────────────────────────────────────────────
  const result = await sendWelcomeEmail(data as WelcomeEmailData)

  if (!result.success) {
    console.error('[send-welcome] Resend error:', result.error)
    return NextResponse.json(
      { success: false, message: 'No se pudo enviar el correo de bienvenida.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
