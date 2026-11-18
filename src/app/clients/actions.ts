'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function createClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const email = clean(formData.get('email'))?.toLowerCase()
  if (!email || !email.includes('@')) {
    redirect('/clients?error=email')
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      coach_id: user.id,
      email,
      first_name: clean(formData.get('first_name')),
      last_name: clean(formData.get('last_name')),
      phone: clean(formData.get('phone')),
      status: 'invited',
      is_demo: false,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    redirect(`/clients?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/clients')
  redirect(`/clients/${data!.id}?created=1`)
}

/** Lifecycle hors archive : lié → active, sinon invited. */
function lifecycleStatus(userId: string | null | undefined) {
  return userId ? 'active' : 'invited'
}

/**
 * @deprecated Le statut invited/active n’est plus éditable à la main.
 * Conservé pour d’éventuels forms legacy → no-op redirect.
 */
export async function updateClientStatusAction(formData: FormData) {
  const id = clean(formData.get('id'))
  if (!id) redirect('/clients')
  redirect(`/clients/${id}`)
}

/** @deprecated */
export async function updateClientAction(formData: FormData) {
  return updateClientStatusAction(formData)
}

export async function archiveClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients')

  // Archivé = reste en base (visible via filtre), sans soft-delete
  const { error } = await supabase
    .from('clients')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    redirect(`/clients/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect('/clients?archived=1')
}

/** Désarchive → invited ou active selon présence du compte lié. */
export async function unarchiveClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients')

  const { data: row } = await supabase
    .from('clients')
    .select('id, user_id, status')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!row) redirect('/clients')

  const { error } = await supabase
    .from('clients')
    .update({
      status: lifecycleStatus(row.user_id),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    redirect(`/clients/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  redirect(`/clients/${id}?saved=1`)
}
