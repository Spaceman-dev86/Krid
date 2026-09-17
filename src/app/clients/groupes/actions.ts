'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function createManualGroupAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = clean(formData.get('name'))
  if (!name) redirect('/clients/groupes?error=name')

  const chat_enabled = formData.get('chat_enabled') === 'on'
  const drive_enabled = formData.get('drive_enabled') === 'on'

  const { data, error } = await supabase
    .from('client_groups')
    .insert({
      coach_id: user.id,
      name,
      type: 'manual',
      chat_enabled,
      drive_enabled,
    })
    .select('id')
    .maybeSingle()

  if (error) redirect(`/clients/groupes?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/clients/groupes')
  redirect(`/clients/groupes/${data!.id}?created=1`)
}

export async function updateGroupAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients/groupes')

  const name = clean(formData.get('name'))
  if (!name) redirect(`/clients/groupes/${id}?error=name`)

  const { error } = await supabase
    .from('client_groups')
    .update({
      name,
      chat_enabled: formData.get('chat_enabled') === 'on',
      drive_enabled: formData.get('drive_enabled') === 'on',
    })
    .eq('id', id)
    .eq('coach_id', user.id)
    .eq('type', 'manual')

  if (error) redirect(`/clients/groupes/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${id}`)
  redirect(`/clients/groupes/${id}?saved=1`)
}

export async function addGroupMemberAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = clean(formData.get('group_id'))
  const clientId = clean(formData.get('client_id'))
  if (!groupId || !clientId) redirect('/clients/groupes')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type')
    .eq('id', groupId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!group || group.type !== 'manual') {
    redirect(`/clients/groupes/${groupId}?error=readonly`)
  }

  const { error } = await supabase.from('client_group_members').insert({
    group_id: groupId,
    client_id: clientId,
  })

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    redirect(`/clients/groupes/${groupId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/clients/groupes/${groupId}`)
  redirect(`/clients/groupes/${groupId}?saved=1`)
}

export async function removeGroupMemberAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = clean(formData.get('group_id'))
  const clientId = clean(formData.get('client_id'))
  if (!groupId || !clientId) redirect('/clients/groupes')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type')
    .eq('id', groupId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!group || group.type !== 'manual') {
    redirect(`/clients/groupes/${groupId}?error=readonly`)
  }

  await supabase.from('client_group_members').delete().eq('group_id', groupId).eq('client_id', clientId)

  revalidatePath(`/clients/groupes/${groupId}`)
  redirect(`/clients/groupes/${groupId}?saved=1`)
}

export async function deleteGroupAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients/groupes')

  const { error } = await supabase
    .from('client_groups')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)
    .eq('type', 'manual')

  if (error) redirect(`/clients/groupes/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/clients/groupes')
  redirect('/clients/groupes?deleted=1')
}
