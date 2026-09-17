'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp, isPlatformAdmin } from '../../../lib/auth/roles'
import { isUploadFile, storageSafeName } from '../../../lib/admin/trainlyMedia'
import { createClient } from '../../../lib/supabase/server'

const SUPPORT_BASE = '/settings/support'

async function uploadSupportAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ticketId: string,
  messageId: string,
  file: File
): Promise<{ path: string; name: string; mime: string } | { error: string }> {
  if (file.size === 0) return { error: 'Fichier vide' }
  if (file.size > 25 * 1024 * 1024) return { error: 'Pièce jointe max 25 Mo' }
  const safeName = storageSafeName(file.name)
  const path = `${ticketId}/${messageId}/${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from('support-attachments').upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) return { error: error.message }
  return { path, name: file.name.slice(0, 240), mime: file.type || 'application/octet-stream' }
}

export async function createSupportTicketAction(formData: FormData) {
  const subject = String(formData.get('subject') || '').trim()
  const category = String(formData.get('category') || 'autre')
  const body = String(formData.get('body') || '').trim()
  const file = formData.get('attachment')

  if (subject.length < 3) redirect(`${SUPPORT_BASE}?error=empty`)
  if (body.length < 1 && !isUploadFile(file)) redirect(`${SUPPORT_BASE}?error=empty`)
  if (!['bug', 'billing', 'compte', 'produit', 'autre'].includes(category)) {
    redirect(`${SUPPORT_BASE}?error=category`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      coach_id: user.id,
      subject,
      category,
      status: 'nouveau',
      opened_by: 'coach',
      coach_last_read_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !ticket) {
    redirect(`${SUPPORT_BASE}?error=${encodeURIComponent(error?.message || 'create_failed')}`)
  }

  const messageId = crypto.randomUUID()
  let attachment: { path: string; name: string; mime: string } | null = null
  if (isUploadFile(file) && file.size > 0) {
    const up = await uploadSupportAttachment(supabase, ticket.id, messageId, file)
    if ('error' in up) {
      redirect(`${SUPPORT_BASE}?error=${encodeURIComponent(up.error)}`)
    }
    attachment = up
  }

  await supabase.from('support_messages').insert({
    id: messageId,
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: 'coach',
    body: body || '(pièce jointe)',
    attachment_path: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_mime: attachment?.mime ?? null,
  })

  revalidatePath(SUPPORT_BASE)
  revalidatePath('/profile/aide')
  redirect(`${SUPPORT_BASE}?created=${ticket.id}`)
}

export async function replySupportTicketAsCoachAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  const body = String(formData.get('body') || '').trim()
  const file = formData.get('attachment')
  if (!ticketId) redirect(`${SUPPORT_BASE}?error=empty`)
  if (body.length < 1 && !isUploadFile(file)) redirect(`${SUPPORT_BASE}?ticket=${ticketId}&error=empty`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, coach_id, status')
    .eq('id', ticketId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!ticket) redirect(`${SUPPORT_BASE}?error=not_found`)

  const messageId = crypto.randomUUID()
  let attachment: { path: string; name: string; mime: string } | null = null
  if (isUploadFile(file) && file.size > 0) {
    const up = await uploadSupportAttachment(supabase, ticketId, messageId, file)
    if ('error' in up) {
      redirect(`${SUPPORT_BASE}?ticket=${ticketId}&error=${encodeURIComponent(up.error)}`)
    }
    attachment = up
  }

  await supabase.from('support_messages').insert({
    id: messageId,
    ticket_id: ticketId,
    sender_id: user.id,
    sender_role: 'coach',
    body: body || '(pièce jointe)',
    attachment_path: attachment?.path ?? null,
    attachment_name: attachment?.name ?? null,
    attachment_mime: attachment?.mime ?? null,
  })

  if (ticket.status === 'attente_coach') {
    await supabase
      .from('support_tickets')
      .update({
        status: 'en_cours',
        updated_at: new Date().toISOString(),
        coach_last_read_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
  } else {
    await supabase
      .from('support_tickets')
      .update({ coach_last_read_at: new Date().toISOString() })
      .eq('id', ticketId)
  }

  revalidatePath(SUPPORT_BASE)
  redirect(`${SUPPORT_BASE}?ticket=${ticketId}`)
}

export async function openSupportAttachmentAction(formData: FormData) {
  const path = String(formData.get('path') || '')
  const download = formData.get('download') === '1'
  if (!path) redirect(SUPPORT_BASE)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const admin = isPlatformAdmin(profile?.role)

  if (!admin) {
    const ticketId = path.split('/')[0]
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('coach_id', user.id)
      .maybeSingle()
    if (!ticket) redirect(SUPPORT_BASE)
  }

  const { data, error } = await supabase.storage
    .from('support-attachments')
    .createSignedUrl(path, 3600, download ? { download: true } : undefined)

  if (error || !data?.signedUrl) redirect(SUPPORT_BASE)
  redirect(data.signedUrl)
}
