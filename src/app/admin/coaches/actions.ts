'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import { createClient } from '../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../lib/supabase/serviceRole'

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

export async function saveCoachAdminNotesAction(formData: FormData) {
  const coachId = String(formData.get('coach_id') || '')
  const notes = String(formData.get('admin_notes') || '')
  if (!coachId) redirect('/admin/coaches')

  const { supabase } = await requireAdmin()
  await supabase
    .from('profiles')
    .update({ admin_notes: notes, updated_at: new Date().toISOString() })
    .eq('id', coachId)
    .eq('role', 'coach')

  revalidatePath(`/admin/coaches/${coachId}`)
  redirect(`/admin/coaches/${coachId}?ok=notes`)
}

export async function setCoachSuspendedAction(formData: FormData) {
  const coachId = String(formData.get('coach_id') || '')
  const next = String(formData.get('next') || '') // 'suspend' | 'unsuspend'
  if (!coachId || !['suspend', 'unsuspend'].includes(next)) redirect('/admin/coaches')

  const { supabase, user } = await requireAdmin()

  const suspended_at = next === 'suspend' ? new Date().toISOString() : null
  await supabase
    .from('profiles')
    .update({ suspended_at, updated_at: new Date().toISOString() })
    .eq('id', coachId)
    .eq('role', 'coach')

  if (next === 'suspend') {
    const subject = 'Compte suspendu — Trainly'
    const body =
      'Ton compte coach a été suspendu par l’équipe Trainly. Tu ne peux plus te connecter. Réponds ici si tu as une question.'
    const { data: ticket } = await supabase
      .from('support_tickets')
      .insert({
        coach_id: coachId,
        category: 'compte',
        status: 'attente_coach',
        subject,
        opened_by: 'admin',
        admin_last_read_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()

    if (ticket?.id) {
      await supabase.from('support_messages').insert({
        ticket_id: ticket.id,
        sender_id: user.id,
        sender_role: 'admin',
        body,
      })
    }
  }

  revalidatePath(`/admin/coaches/${coachId}`)
  revalidatePath('/admin/coaches')
  revalidatePath('/admin/sav')
  redirect(`/admin/coaches/${coachId}?ok=${next}`)
}

export async function openAdminSupportTicketAction(formData: FormData) {
  const coachId = String(formData.get('coach_id') || '')
  const category = String(formData.get('category') || 'autre')
  const subject = String(formData.get('subject') || '').trim()
  const body = String(formData.get('body') || '').trim()

  if (!coachId || subject.length < 3 || body.length < 1) {
    redirect(`/admin/coaches/${coachId}?error=ticket_invalid`)
  }
  if (!['bug', 'billing', 'compte', 'produit', 'autre'].includes(category)) {
    redirect(`/admin/coaches/${coachId}?error=ticket_invalid`)
  }

  const { supabase, user } = await requireAdmin()

  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      coach_id: coachId,
      category,
      status: 'attente_coach',
      subject,
      opened_by: 'admin',
      admin_last_read_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (error || !ticket?.id) {
    redirect(`/admin/coaches/${coachId}?error=${encodeURIComponent(error?.message || 'ticket_failed')}`)
  }

  await supabase.from('support_messages').insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    sender_role: 'admin',
    body,
  })

  revalidatePath(`/admin/coaches/${coachId}`)
  revalidatePath('/admin/sav')
  redirect(`/admin/sav/${ticket.id}`)
}

export async function sendCoachPasswordResetAction(formData: FormData) {
  const coachId = String(formData.get('coach_id') || '')
  if (!coachId) redirect('/admin/coaches')

  const { supabase, user } = await requireAdmin()
  const { data: coach } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', coachId)
    .eq('role', 'coach')
    .maybeSingle()

  const email = coach?.email?.trim()
  if (!email) redirect(`/admin/coaches/${coachId}?error=no_email`)

  try {
    const admin = createServiceRoleClient()
    if (!admin) {
      redirect(`/admin/coaches/${coachId}?error=${encodeURIComponent('SUPABASE_SERVICE_ROLE_KEY manquante')}`)
    }
    const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/login`,
    })
    if (error) {
      redirect(`/admin/coaches/${coachId}?error=${encodeURIComponent(error.message)}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'service_role_missing'
    redirect(`/admin/coaches/${coachId}?error=${encodeURIComponent(msg)}`)
  }

  const { data: ticket } = await supabase
    .from('support_tickets')
    .insert({
      coach_id: coachId,
      category: 'compte',
      status: 'attente_coach',
      subject: 'Réinitialisation mot de passe',
      opened_by: 'admin',
      admin_last_read_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle()

  if (ticket?.id) {
    await supabase.from('support_messages').insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_role: 'admin',
      body: `Un e-mail de réinitialisation de mot de passe a été envoyé à ${email}. Si tu ne le reçois pas, vérifie tes spams ou réponds ici.`,
    })
  }

  revalidatePath(`/admin/coaches/${coachId}`)
  redirect(`/admin/coaches/${coachId}?ok=reset`)
}

export async function markAdminTicketReadAction(ticketId: string) {
  const { supabase } = await requireAdmin()
  await supabase
    .from('support_tickets')
    .update({ admin_last_read_at: new Date().toISOString() })
    .eq('id', ticketId)
  revalidatePath('/admin/sav')
  revalidatePath(`/admin/sav/${ticketId}`)
}
