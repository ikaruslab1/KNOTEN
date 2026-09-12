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
  correoInstitucional: string
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
    await resend.emails.send({
      from: 'PyNodes <noreply@pynodes.app>', // update domain as needed
      to: data.correoPersonal,
      subject: '¡Bienvenido a PyNodes! Confirmación de registro',
      html: buildWelcomeEmailHTML(data),
    })
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

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a PyNodes</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);
                        padding:36px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                PyNodes
              </h1>
              <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">
                Plataforma de aprendizaje de Python
              </p>
            </td>
          </tr>
          <!-- Greeting -->
          <tr>
            <td style="padding:32px 40px 16px;">
              <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:700;">
                Hola, ${data.nombre}!
              </h2>
              <p style="margin:0;color:#6b7280;font-size:15px;line-height:1.6;">
                Tu cuenta en <strong>PyNodes</strong> ha sido creada exitosamente.
                A continuacion encontraras los datos de tu registro. Guardalos en un lugar seguro.
              </p>
            </td>
          </tr>
          <!-- Data table -->
          <tr>
            <td style="padding:8px 40px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:14px;">
                ${row('Nombre completo', fullName)}
                ${row('Grupo', data.grupo)}
                ${row('Semestre', data.semestre)}
                ${row('Carrera', data.carrera)}
                ${row('Correo personal', data.correoPersonal)}
                ${row('Correo institucional', data.correoInstitucional)}
              </table>
            </td>
          </tr>
          <!-- Password warning box -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;overflow:hidden;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#b91c1c;
                               text-transform:uppercase;letter-spacing:0.05em;">
                      Contrasena temporal
                    </p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#991b1b;
                               letter-spacing:2px;font-family:'Courier New',monospace;">
                      ${data.password}
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:#b91c1c;">
                      Por seguridad, cambia tu contrasena la primera vez que inicies sesion.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 36px;text-align:center;">
              <a href="https://pynodes.app/login"
                 style="display:inline-block;background:#2563eb;color:#ffffff;
                         text-decoration:none;font-size:15px;font-weight:600;
                         padding:14px 36px;border-radius:8px;letter-spacing:0.02em;">
                Iniciar sesion
              </a>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Este es un correo automatico. No respondas a este mensaje.<br />
                &copy; ${year} PyNodes. Todos los derechos reservados.
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
