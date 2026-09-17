'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../../lib/auth/roles'
import { createClient } from '../../../lib/supabase/server'

export async function createSupportTicketAction(formData: FormData) {
  const subject = String(formData.get('subject') || '').trim()
  const category = String(formData.get('category') || 'autre')
  const body = String(formData.get('body') || '').trim()

  if (subject.length < 3 || body.length < 3) {
    redirect('/profile/aide?error=empty')
  }
  if (!['bug', 'billing', 'compte', 'produit', 'autre'].includes(category)) {
    redirect('/profile/aide?error=category')
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
    redirect(`/profile/aide?error=${encodeURIComponent(error?.message || 'create_failed')}`)
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: 'coach',
    body,
  })

  revalidatePath('/profile/aide')
  redirect(`/profile/aide?created=${ticket.id}`)
}

export async function replySupportTicketAsCoachAction(formData: FormData) {
  const ticketId = String(formData.get('ticket_id') || '')
  const body = String(formData.get('body') || '').trim()
  if (!ticketId || body.length < 1) redirect('/profile/aide?error=empty')

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

  if (!ticket) redirect('/profile/aide?error=not_found')

  await supabase.from('support_messages').insert({
    ticket_id: ticketId,
    sender_id: user.id,
    sender_role: 'coach',
    body,
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

  revalidatePath('/profile/aide')
  redirect(`/profile/aide?ticket=${ticketId}`)
}
