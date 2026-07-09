import { Resend } from 'resend'

type SendProgramShareEmailParams = {
  to: string
  programTitle: string
  message: string
  shareUrl: string
}

function getResend(): Resend | null {
  const key = String(process.env.RESEND_API_KEY ?? '').trim()
  if (!key) return null
  return new Resend(key)
}

export async function sendProgramShareEmail(params: SendProgramShareEmailParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResend()
  if (!resend) {
    return { ok: false, error: 'RESEND_API_KEY manquant dans .env.local.' }
  }

  const from = String(process.env.RESEND_FROM ?? 'Trainly <no-reply@trainly.app>').trim()
  const subject = `Programme : ${params.programTitle || 'Aperçu'}`

  const safeMessage = String(params.message ?? '').trim()
  const intro = safeMessage ? `<p style=\"margin:0 0 14px 0; font-size:14px; line-height:1.5; color:#111827;\">${escapeHtml(safeMessage).replace(/\n/g, '<br/>')}</p>` : ''

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 16px;">
    <h1 style="margin:0 0 10px 0; font-size:18px; color:#341c44;">Aperçu du programme</h1>
    ${intro}
    <p style="margin:0 0 14px 0; font-size:14px; color:#111827;">Clique ici pour voir le rendu :</p>
    <p style="margin:0;">
      <a href="${params.shareUrl}" style="display:inline-block; padding:12px 16px; border-radius:14px; background:linear-gradient(90deg,#d6c4e8,#9b6bb8,#341c44); color:white; font-weight:800; text-decoration:none;">Voir le programme</a>
    </p>
    <p style="margin:14px 0 0 0; font-size:12px; color:#6b7280;">Si le bouton ne marche pas, copie-colle ce lien : ${params.shareUrl}</p>
  </div>
  `.trim()

  try {
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html,
    })
    if (error) return { ok: false, error: error.message ?? 'Échec envoi email.' }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Échec envoi email.' }
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

