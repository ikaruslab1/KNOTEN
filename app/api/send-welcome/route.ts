import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail, WelcomeEmailData } from '@/lib/resend'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { success: false, message: 'Cuerpo de la solicitud inválido.' },
      { status: 400 },
    )
  }

  // Normalize incoming fields supporting both camelCase and snake_case
  const nombre = String(body.nombre ?? '').trim()
  const apellidoPaterno = String(body.apellidoPaterno ?? body.apellido_paterno ?? '').trim()
  const apellidoMaterno = String(body.apellidoMaterno ?? body.apellido_materno ?? '').trim()
  const grupo = String(body.grupo ?? '').trim()
  const semestre = String(body.semestre ?? '').trim()
  const carrera = String(body.carrera ?? '').trim()
  const correoPersonal = String(body.correoPersonal ?? body.correo_personal ?? '').trim()
  const correoInstitucional = String(body.correoInstitucional ?? body.correo_institucional ?? '').trim()
  const password = String(body.password ?? '')

  if (
    !nombre ||
    !apellidoPaterno ||
    !apellidoMaterno ||
    !grupo ||
    !semestre ||
    !carrera ||
    !correoPersonal ||
    !password
  ) {
    return NextResponse.json(
      {
        success: false,
        message: 'Faltan campos obligatorios para el correo de bienvenida.',
      },
      { status: 422 },
    )
  }

  const emailData: WelcomeEmailData = {
    nombre,
    apellidoPaterno,
    apellidoMaterno,
    grupo,
    semestre,
    carrera,
    correoPersonal,
    correoInstitucional,
    password,
  }

  const result = await sendWelcomeEmail(emailData)

  if (!result.success) {
    console.error('[send-welcome] Resend error:', result.error)
    return NextResponse.json(
      { success: false, message: 'No se pudo enviar el correo de bienvenida.', error: result.error },
      { status: 502 },
    )
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
