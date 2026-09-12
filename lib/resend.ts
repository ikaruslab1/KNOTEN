import { Resend } from 'resend'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY || 're_placeholder_for_build'
  return new Resend(apiKey)
}

export type WelcomeEmailData = {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  grupo: string
  semestre: string
  carrera: string
  correoPersonal: string
  correoInstitucional?: string
  password: string // sent in plain text per design requirement
}

/**
 * Sends the welcome / registration-confirmation email to the student's
 * personal address via Resend.
 */
export async function sendWelcomeEmail(
  data: WelcomeEmailData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient()
    const fromConfig = process.env.RESEND_FROM_EMAIL || 'contacto@send.knoten.scherry.click'
    const fromAddress = fromConfig.includes('<') ? fromConfig : `Knoten <${fromConfig}>`

    const response = await resend.emails.send({
      from: fromAddress,
      to: data.correoPersonal,
      subject: '¡Bienvenido a Knoten! Datos de tu cuenta',
      html: buildWelcomeEmailHTML(data),
    })

    if (response.error) {
      return { success: false, error: response.error.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

// ---------------------------------------------------------------------------
// Internal HTML builder
// ---------------------------------------------------------------------------

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;width:220px;border-bottom:1px solid #e5e7eb;">
        ${label}
      </td>
      <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">
        ${value}
      </td>
    </tr>`
}

function buildWelcomeEmailHTML(data: WelcomeEmailData): string {
  const fullName = `${data.nombre} ${data.apellidoPaterno} ${data.apellidoMaterno}`
  const year = new Date().getFullYear()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://knoten.scherry.click'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a Knoten</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e4e4e7;max-width:600px;width:100%;">
          <!-- Header (Monochromatic) -->
          <tr>
            <td style="background:#18181b;padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">
                Knoten
              </h1>
              <p style="margin:6px 0 0;color:#a1a1aa;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">
                Programación Visual de Python
              </p>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 16px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:20px;font-weight:700;">
                ¡Hola, ${data.nombre}!
              </h2>
              <p style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">
                Tu cuenta en <strong>Knoten</strong> ha sido creada exitosamente.
                A continuación encontrarás el resumen con todos los datos registrados para tu cuenta:
              </p>
            </td>
          </tr>
          <!-- Data table -->
          <tr>
            <td style="padding:8px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;font-size:14px;">
                ${row('Nombre completo', fullName)}
                ${row('Grupo', data.grupo)}
                ${row('Semestre', data.semestre)}
                ${row('Carrera', data.carrera)}
                ${row('Correo personal', data.correoPersonal)}
                ${row('Correo institucional', data.correoInstitucional || 'No especificado')}
              </table>
            </td>
          </tr>
          <!-- Credentials box -->
          <tr>
            <td style="padding:0 40px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fafafa;border:1px solid #e4e4e7;border-left:4px solid #18181b;
                            border-radius:6px;padding:16px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#71717a;
                               text-transform:uppercase;letter-spacing:0.05em;">
                      Contraseña registrada
                    </p>
                    <p style="margin:0;font-size:20px;font-weight:700;color:#18181b;
                               letter-spacing:1px;font-family:'Courier New',monospace;">
                      ${data.password}
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:#71717a;">
                      Para acceder, tu usuario es tu correo personal: <strong>${data.correoPersonal}</strong>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="${appUrl}/login"
                 style="display:inline-block;background:#18181b;color:#ffffff;
                         text-decoration:none;font-size:14px;font-weight:600;
                         padding:12px 32px;border-radius:8px;letter-spacing:0.02em;">
                Iniciar sesión en Knoten
              </a>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Este es un correo automático. No respondas a este mensaje.<br />
                &copy; ${year} Knoten. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
