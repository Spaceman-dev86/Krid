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

export async function updateClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients')

  const email = clean(formData.get('email'))?.toLowerCase()
  if (!email || !email.includes('@')) {
    redirect(`/clients/${id}?error=email`)
  }

  const status = clean(formData.get('status')) ?? 'invited'
  if (!['invited', 'active', 'archived'].includes(status)) {
    redirect(`/clients/${id}?error=status`)
  }

  const { error } = await supabase
    .from('clients')
    .update({
      email,
      first_name: clean(formData.get('first_name')),
      last_name: clean(formData.get('last_name')),
      phone: clean(formData.get('phone')),
      sex: clean(formData.get('sex')),
      birth_date: clean(formData.get('birth_date')),
      status,
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

export async function archiveClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients')

  const { error } = await supabase
    .from('clients')
    .update({
      status: 'archived',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    redirect(`/clients/${id}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/clients')
  redirect('/clients?archived=1')
}
