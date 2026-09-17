'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import { isUploadFile, storageSafeName } from '../../../lib/admin/trainlyMedia'
import { createClient } from '../../../lib/supabase/server'

const STATUSES = ['nouveau', 'en_cours', 'attente_coach', 'resolu'] as const

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase, user }
}

function revalidateTicket(ticketId: string) {
  revalidatePath(`/admin/sav/${ticketId}`)
  revalidatePath('/admin/sav')
}

export async function updateTicketStatusAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  const status = String(formData.get('status') || '')
  if (!ticketId || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect('/admin/sav?error=invalid')
  }

  const { supabase } = await requireAdmin()
  await supabase
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  revalidateTicket(ticketId)
  redirect(`/admin/sav/${ticketId}`)
}

/** Fermer → Résolu */
export async function closeTicketAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  if (!ticketId) redirect('/admin/sav')

  const { supabase } = await requireAdmin()
  await supabase
    .from('support_tickets')
    .update({ status: 'resolu', updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  revalidateTicket(ticketId)
  redirect(`/admin/sav/${ticketId}?ok=closed`)
}

/** Rouvrir un ticket résolu → En cours */
export async function reopenTicketAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  if (!ticketId) redirect('/admin/sav')

  const { supabase } = await requireAdmin()
  await supabase
    .from('support_tickets')
    .update({ status: 'en_cours', updated_at: new Date().toISOString() })
    .eq('id', ticketId)
    .eq('status', 'resolu')

  revalidateTicket(ticketId)
  redirect(`/admin/sav/${ticketId}?ok=reopened`)
}

/** Relancer le coach → Attente coach + message in-app */
export async function nudgeCoachAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  const note = String(formData.get('nudge_note') || '').trim()
  if (!ticketId) redirect('/admin/sav')

  const { supabase, user } = await requireAdmin()

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, status')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) redirect('/admin/sav')
  if (ticket.status === 'resolu') {
    redirect(`/admin/sav/${ticketId}?error=` + encodeURIComponent('Rouvre le ticket avant de relancer'))
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: user.id,
    sender_role: 'admin',
    body: note || 'Relance : peux-tu répondre sur ce ticket ?',
  })

  await supabase
    .from('support_tickets')
    .update({
      status: 'attente_coach',
      updated_at: new Date().toISOString(),
      admin_last_read_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  revalidateTicket(ticketId)
  redirect(`/admin/sav/${ticketId}?ok=nudged`)
}

export async function replyTicketAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  const body = String(formData.get('body') || '').trim()
  const file = formData.get('attachment')
  if (!ticketId) redirect('/admin/sav')
  if (body.length < 1 && !isUploadFile(file)) redirect(`/admin/sav/${ticketId}?error=empty`)

  const { supabase, user } = await requireAdmin()

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, status')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) redirect('/admin/sav')
  if (ticket.status === 'resolu') {
    redirect(`/admin/sav/${ticketId}?error=` + encodeURIComponent('Ticket résolu — rouvre-le pour répondre'))
  }

  const messageId = crypto.randomUUID()
  let attachment: { path: string; name: string; mime: string } | null = null

  if (isUploadFile(file) && file.size > 0) {
    if (file.size > 25 * 1024 * 1024) {
      redirect(`/admin/sav/${ticketId}?error=` + encodeURIComponent('Max 25 Mo'))
    }
    const safeName = storageSafeName(file.name)
    const path = `${ticketId}/${messageId}/${safeName}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await supabase.storage.from('support-attachments').upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (upErr) redirect(`/admin/sav/${ticketId}?error=` + encodeURIComponent(upErr.message))
    attachment = { path, name: file.name.slice(0, 240), mime: file.type || 'application/octet-stream' }
  }

  await supabase.from('support_messages').insert({
    id: messageId,
    ticket_id: ticketId,
    sender_id: user.id,
    sender_role: 'admin',
    body: body || '(pièce jointe)',
    attachment_path: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_mime: attachment?.mime ?? null,
  })

  await supabase
    .from('support_tickets')
    .update({
      status: 'attente_coach',
      updated_at: new Date().toISOString(),
      admin_last_read_at: new Date().toISOString(),
    })
    .eq('id', ticketId)

  revalidateTicket(ticketId)
  redirect(`/admin/sav/${ticketId}`)
}

export async function openAdminSupportAttachmentAction(formData: FormData) {
  const path = String(formData.get('path') || '')
  const ticketId = String(formData.get('ticket_id') || '')
  if (!path) redirect(ticketId ? `/admin/sav/${ticketId}` : '/admin/sav')

  const { supabase } = await requireAdmin()

  const { data, error } = await supabase.storage.from('support-attachments').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) redirect(ticketId ? `/admin/sav/${ticketId}` : '/admin/sav')
  redirect(data.signedUrl)
}
