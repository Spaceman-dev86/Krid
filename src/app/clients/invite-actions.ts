'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

const INVITE_DAYS = 30

export async function createClientInviteAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = String(formData.get('client_id') ?? '').trim()
  if (!clientId) redirect('/clients')

  const { data: client } = await supabase
    .from('clients')
    .select('id, email, user_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect('/clients')

  if (client.user_id) {
    redirect(`/clients/${clientId}?error=already_linked`)
  }

  // Révoquer les invites ouvertes
  await supabase
    .from('client_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('coach_id', user.id)
    .is('revoked_at', null)
    .is('accepted_at', null)

  const token = randomBytes(24).toString('hex')
  const expires = new Date()
  expires.setUTCDate(expires.getUTCDate() + INVITE_DAYS)

  const { error } = await supabase.from('client_invites').insert({
    token,
    coach_id: user.id,
    client_id: clientId,
    email: client.email,
    expires_at: expires.toISOString(),
  })

  if (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}?invited=1&token=${token}`)
}

export async function unlinkClientAuthAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = String(formData.get('client_id') ?? '').trim()
  if (!clientId) redirect('/clients')

  const { error } = await supabase
    .from('clients')
    .update({
      user_id: null,
      status: 'invited',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .eq('coach_id', user.id)

  if (error) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/clients/${clientId}`)
  redirect(`/clients/${clientId}?unlinked=1`)
}
