'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  backfillLinkedGroupMembers,
  endNutritionForClients,
  endProgramForClients,
  pushGroupCatalogToClient,
  pushNutritionToClients,
  pushProgramToActiveGrants,
  pushProgramToClients,
} from '../../../lib/coach/linkedGroups'
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

  const memberIds = [...new Set(formData.getAll('member_id').map(String).filter(Boolean))]

  // Chat / Drive : off à la création — activation sur la fiche groupe.
  const { data, error } = await supabase
    .from('client_groups')
    .insert({
      coach_id: user.id,
      name,
      type: 'manual',
      chat_enabled: false,
      drive_enabled: false,
    })
    .select('id')
    .maybeSingle()

  if (error) redirect(`/clients/groupes?error=${encodeURIComponent(error.message)}`)

  if (memberIds.length && data?.id) {
    const { data: owned } = await supabase
      .from('clients')
      .select('id')
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .in('id', memberIds)
    const ok = new Set((owned ?? []).map((c) => c.id))
    for (const clientId of memberIds) {
      if (!ok.has(clientId)) continue
      await supabase.from('client_group_members').insert({
        group_id: data.id,
        client_id: clientId,
      })
    }
  }

  revalidatePath('/clients/groupes')
  redirect(`/clients/groupes/${data!.id}?created=1`)
}

function safeGroupReturnTo(raw: string | null, fallback: string) {
  if (raw && raw.startsWith('/clients/groupes/')) return raw
  return fallback
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
  const description = clean(formData.get('description'))
  const prestationId = clean(formData.get('prestation_id'))
  const returnTo = safeGroupReturnTo(clean(formData.get('return_to')), `/clients/groupes/${id}`)

  const patch: Record<string, unknown> = {
    name,
    description,
  }
  // Ne toucher chat/drive que si le form les envoie explicitement (évite de les couper depuis Infos).
  if (formData.has('chat_enabled')) {
    patch.chat_enabled = formData.get('chat_enabled') === 'on'
  }
  if (formData.has('drive_enabled')) {
    patch.drive_enabled = formData.get('drive_enabled') === 'on'
  }
  // Tag presta optionnel (présent dans le form Infos).
  if (formData.has('prestation_id')) {
    patch.prestation_id = prestationId
  }

  // Linked : ne pas écraser prestation_id via le form Infos
  const { data: existing } = await supabase
    .from('client_groups')
    .select('type')
    .eq('id', id)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (!existing || (existing.type !== 'manual' && existing.type !== 'linked')) {
    redirect(`/clients/groupes/${id}?error=readonly`)
  }

  if (existing.type === 'linked') {
    delete patch.prestation_id
  }

  const { error } = await supabase
    .from('client_groups')
    .update(patch as never)
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])

  if (error) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${id}`)
  revalidatePath(`/clients/groupes/${id}/drive`)
  revalidatePath(`/clients/groupes/${id}/prestation`)
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}saved=1`)
}

/** Crée le groupe lié (0..1) à une presta + backfill grants actifs. */
export async function createLinkedGroupFromPrestaAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const prestationId = clean(formData.get('prestation_id'))
  if (!prestationId) redirect('/profile/prestations')

  const { data: presta } = await supabase
    .from('prestations')
    .select('id, name')
    .eq('id', prestationId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta) redirect('/profile/prestations?error=presta')

  const { data: existing } = await supabase
    .from('client_groups')
    .select('id')
    .eq('coach_id', user.id)
    .eq('type', 'linked')
    .eq('prestation_id', prestationId)
    .maybeSingle()

  if (existing?.id) {
    redirect(`/clients/groupes/${existing.id}`)
  }

  const name = clean(formData.get('name')) || presta.name

  const { data, error } = await supabase
    .from('client_groups')
    .insert({
      coach_id: user.id,
      name,
      type: 'linked',
      prestation_id: prestationId,
      chat_enabled: false,
      drive_enabled: false,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    redirect(
      `/profile/prestations/${prestationId}?error=` + encodeURIComponent(error.message)
    )
  }

  try {
    await backfillLinkedGroupMembers(supabase, {
      coachId: user.id,
      groupId: data!.id,
      prestationId,
    })
  } catch {
    /* non-bloquant */
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/profile/prestations/${prestationId}`)
  redirect(`/clients/groupes/${data!.id}?created=1`)
}

/**
 * Tags classement groupe libre (prestation | program, max 3).
 * Form: champs `tag` répétés = `prestation:<uuid>` | `program:<uuid>`.
 * Sync aussi `client_groups.prestation_id` = 1er tag presta (rétrocompat).
 */
export async function updateGroupManualTagsAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients/groupes')

  const returnTo = safeGroupReturnTo(
    clean(formData.get('return_to')),
    `/clients/groupes/${id}/prestation`,
  )

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type')
    .eq('id', id)
    .eq('coach_id', user.id)
    .eq('type', 'manual')
    .maybeSingle()

  if (!group) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent('Groupe introuvable'))
  }

  const rawTags = formData.getAll('tag').map((v) => String(v ?? '').trim()).filter(Boolean)
  const parsed: { kind: 'prestation' | 'program'; ref_id: string }[] = []
  const seen = new Set<string>()
  for (const raw of rawTags) {
    const [kind, refId] = raw.split(':')
    if ((kind !== 'prestation' && kind !== 'program') || !refId) continue
    const key = `${kind}:${refId}`
    if (seen.has(key)) continue
    seen.add(key)
    parsed.push({ kind, ref_id: refId })
    if (parsed.length >= 3) break
  }

  // Valider ownership des refs
  const prestaIds = parsed.filter((t) => t.kind === 'prestation').map((t) => t.ref_id)
  const programIds = parsed.filter((t) => t.kind === 'program').map((t) => t.ref_id)
  if (prestaIds.length) {
    const { data: rows } = await supabase
      .from('prestations')
      .select('id')
      .eq('coach_id', user.id)
      .in('id', prestaIds)
    const ok = new Set((rows ?? []).map((r: { id: string }) => r.id))
    if (prestaIds.some((pid) => !ok.has(pid))) {
      const sep = returnTo.includes('?') ? '&' : '?'
      redirect(`${returnTo}${sep}error=` + encodeURIComponent('Presta invalide'))
    }
  }
  if (programIds.length) {
    const { data: rows } = await supabase
      .from('programs')
      .select('id')
      .eq('coach_id', user.id)
      .is('deleted_at', null)
      .in('id', programIds)
    const ok = new Set((rows ?? []).map((r: { id: string }) => r.id))
    if (programIds.some((pid) => !ok.has(pid))) {
      const sep = returnTo.includes('?') ? '&' : '?'
      redirect(`${returnTo}${sep}error=` + encodeURIComponent('Programme invalide'))
    }
  }

  await supabase.from('client_group_tags').delete().eq('group_id', id)

  if (parsed.length) {
    const { error: insertErr } = await supabase.from('client_group_tags').insert(
      parsed.map((t, i) => ({
        group_id: id,
        kind: t.kind,
        ref_id: t.ref_id,
        sort_order: i,
      })),
    )
    if (insertErr) {
      const sep = returnTo.includes('?') ? '&' : '?'
      redirect(`${returnTo}${sep}error=${encodeURIComponent(insertErr.message)}`)
    }
  }

  const firstPresta = parsed.find((t) => t.kind === 'prestation')?.ref_id ?? null
  await supabase
    .from('client_groups')
    .update({ prestation_id: firstPresta })
    .eq('id', id)
    .eq('coach_id', user.id)
    .eq('type', 'manual')

  revalidatePath(`/clients/groupes/${id}`)
  revalidatePath(`/clients/groupes/${id}/prestation`)
  revalidatePath('/clients/groupes')
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}saved=1`)
}

/** @deprecated — préférer updateGroupManualTagsAction */
export async function updateGroupPrestationTagAction(formData: FormData) {
  return updateGroupManualTagsAction(formData)
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

  // Contenus déjà envoyés depuis le groupe → aussi pour ce nouveau membre
  try {
    await pushGroupCatalogToClient(supabase, {
      coachId: user.id,
      groupId,
      clientId,
    })
  } catch {
    /* non-bloquant */
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${groupId}`)
  revalidatePath(`/clients/groupes/${groupId}/prestation`)
  revalidatePath('/clients')
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

  if (!group || (group.type !== 'manual' && group.type !== 'linked')) {
    redirect(`/clients/groupes/${groupId}?error=readonly`)
  }

  if (group.type === 'linked') {
    const { excludeClientFromLinkedGroup } = await import('../../../lib/coach/linkedGroups')
    await excludeClientFromLinkedGroup(supabase, { groupId, clientId })
  } else {
    await supabase.from('client_group_members').delete().eq('group_id', groupId).eq('client_id', clientId)
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${groupId}`)
  redirect(`/clients/groupes/${groupId}?saved=1`)
}

export async function deleteGroupAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('group_id')) || clean(formData.get('id'))
  if (!id) redirect('/clients/groupes')

  const { error } = await supabase
    .from('client_groups')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])

  if (error) redirect(`/clients/groupes/${id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/clients/groupes')
  redirect('/clients/groupes?deleted=1')
}

/** Active le chat groupe : nom + thread + 1er message → ouvre le fil. */
export async function enableGroupChatAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/clients/groupes')

  const chatTitle = clean(formData.get('chat_title'))
  const firstMessage = clean(formData.get('first_message'))
  if (!chatTitle) redirect(`/clients/groupes/${id}?error=` + encodeURIComponent('Nom du chat requis'))
  if (!firstMessage) {
    redirect(`/clients/groupes/${id}?error=` + encodeURIComponent('Premier message requis'))
  }

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, name, type')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) redirect('/clients/groupes')

  const { error } = await supabase
    .from('client_groups')
    .update({
      chat_enabled: true,
      chat_title: chatTitle,
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    redirect(`/clients/groupes/${id}?error=` + encodeURIComponent(error.message))
  }

  const { ensureGroupThreadId, sendChatMessage } = await import('../../../lib/chat/chat')
  let threadId: string
  try {
    threadId = await ensureGroupThreadId(supabase, id)
    await supabase
      .from('chat_threads')
      .update({ title: chatTitle })
      .eq('id', threadId)
      .eq('coach_id', user.id)
    await sendChatMessage(supabase, threadId, user.id, firstMessage)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'thread'
    redirect(`/clients/groupes/${id}?error=` + encodeURIComponent(msg))
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${id}`)
  revalidatePath('/chat')
  redirect(`/chat/${threadId}`)
}

/** Ajoute un dossier Drive au groupe (N dossiers via drive_shares). */
export async function linkGroupDriveFolderAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  const folderId = clean(formData.get('drive_folder_id'))
  const returnTo = safeGroupReturnTo(
    clean(formData.get('return_to')),
    id ? `/clients/groupes/${id}/drive` : '/clients/groupes',
  )
  if (!id) redirect('/clients/groupes')
  if (!folderId) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent('Choisis un dossier'))
  }

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type, drive_folder_id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) redirect('/clients/groupes')

  const { data: folder } = await supabase
    .from('drive_folders')
    .select('id')
    .eq('id', folderId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!folder) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent('Dossier introuvable'))
  }

  const { error: shareErr } = await supabase.from('drive_shares').insert({
    coach_id: user.id,
    folder_id: folderId,
    group_id: id,
    file_id: null,
    client_id: null,
  })
  if (shareErr && !/duplicate|unique/i.test(shareErr.message)) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent(shareErr.message))
  }

  // drive_enabled + drive_folder_id = 1er dossier (hint UI) ; la vérité = drive_shares
  const patch: Record<string, unknown> = { drive_enabled: true }
  if (!group.drive_folder_id) patch.drive_folder_id = folderId

  const { error } = await supabase
    .from('client_groups')
    .update(patch as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${id}`)
  revalidatePath(`/clients/groupes/${id}/drive`)
  revalidatePath('/drive')
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}saved=1`)
}

/** Retire un dossier partagé du groupe. */
export async function unlinkGroupDriveFolderAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  const folderId = clean(formData.get('drive_folder_id'))
  const returnTo = safeGroupReturnTo(
    clean(formData.get('return_to')),
    id ? `/clients/groupes/${id}/drive` : '/clients/groupes',
  )
  if (!id || !folderId) redirect('/clients/groupes')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, drive_folder_id')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) redirect('/clients/groupes')

  await supabase
    .from('drive_shares')
    .delete()
    .eq('coach_id', user.id)
    .eq('group_id', id)
    .eq('folder_id', folderId)

  const { data: remaining } = await supabase
    .from('drive_shares')
    .select('folder_id')
    .eq('group_id', id)
    .eq('coach_id', user.id)
    .not('folder_id', 'is', null)

  const left = (remaining ?? []).map((r: { folder_id: string | null }) => r.folder_id).filter(Boolean) as string[]
  const nextPrimary = left[0] ?? null

  await supabase
    .from('client_groups')
    .update({
      drive_enabled: left.length > 0,
      drive_folder_id: nextPrimary,
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  revalidatePath('/clients/groupes')
  revalidatePath(`/clients/groupes/${id}`)
  revalidatePath(`/clients/groupes/${id}/drive`)
  revalidatePath('/drive')
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}saved=1`)
}

/** Push sport ou nutrition : lié = grants actifs · libre = membres. */
export async function pushContentFromGroupAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = clean(formData.get('group_id'))
  const kind = clean(formData.get('kind')) === 'nutrition' ? 'nutrition' : 'fitness'
  const contentId = clean(formData.get('content_id'))
  const mode = clean(formData.get('mode')) === 'replace' ? 'replace' : 'add'
  const returnTo = safeGroupReturnTo(
    clean(formData.get('return_to')),
    groupId ? `/clients/groupes/${groupId}/prestation` : '/clients/groupes',
  )

  if (!groupId || !contentId) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent('Choix requis'))
  }

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type, prestation_id')
    .eq('id', groupId)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) {
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent('Groupe introuvable'))
  }

  async function resolveClientIds(): Promise<string[]> {
    if (group!.type === 'linked') {
      if (!group!.prestation_id) return []
      const { data: grants } = await supabase
        .from('client_grants')
        .select('client_id')
        .eq('coach_id', user!.id)
        .eq('prestation_id', group!.prestation_id)
        .eq('status', 'active')
      return [...new Set((grants ?? []).map((g: { client_id: string }) => g.client_id).filter(Boolean))]
    }
    const { data: members } = await supabase
      .from('client_group_members')
      .select('client_id')
      .eq('group_id', groupId!)
    return (members ?? []).map((m: { client_id: string }) => m.client_id)
  }

  let pushed = 0
  try {
    const clientIds = await resolveClientIds()
    if (kind === 'nutrition') {
      const result = await pushNutritionToClients(supabase, {
        coachId: user.id,
        clientIds,
        nutritionPlanId: contentId,
      })
      pushed = result.pushed
    } else if (group.type === 'linked' && group.prestation_id) {
      const result = await pushProgramToActiveGrants(supabase, {
        coachId: user.id,
        prestationId: group.prestation_id,
        programId: contentId,
        mode,
      })
      pushed = result.pushed
    } else {
      const result = await pushProgramToClients(supabase, {
        coachId: user.id,
        clientIds,
        programId: contentId,
        mode,
      })
      pushed = result.pushed
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'push'
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent(msg))
  }

  // Liste des contenus envoyés depuis ce groupe (upsert)
  const now = new Date().toISOString()
  const { data: existingPush } = await supabase
    .from('client_group_pushed_content')
    .select('id')
    .eq('group_id', groupId)
    .eq('kind', kind)
    .eq('content_id', contentId)
    .maybeSingle()

  if (existingPush?.id) {
    await supabase
      .from('client_group_pushed_content')
      .update({ last_pushed_at: now, last_pushed_count: pushed })
      .eq('id', existingPush.id)
  } else {
    await supabase.from('client_group_pushed_content').insert({
      group_id: groupId,
      kind,
      content_id: contentId,
      last_pushed_at: now,
      last_pushed_count: pushed,
    })
  }

  revalidatePath(`/clients/groupes/${groupId}`)
  revalidatePath(`/clients/groupes/${groupId}/prestation`)
  revalidatePath('/clients')
  revalidatePath('/nutrition')
  const sep = returnTo.includes('?') ? '&' : '?'
  redirect(`${returnTo}${sep}pushed=${pushed}`)
}

/** Retire de la liste « contenus envoyés » et termine le plan chez les membres du groupe. */
export async function removeGroupPushedContentAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const groupId = clean(formData.get('group_id'))
  const rowId = clean(formData.get('pushed_id'))
  const returnTo = safeGroupReturnTo(
    clean(formData.get('return_to')),
    groupId ? `/clients/groupes/${groupId}/prestation` : '/clients/groupes',
  )

  if (!groupId || !rowId) redirect(returnTo)

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type, prestation_id')
    .eq('id', groupId)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) redirect(returnTo)

  const { data: row } = await supabase
    .from('client_group_pushed_content')
    .select('id, kind, content_id')
    .eq('id', rowId)
    .eq('group_id', groupId)
    .maybeSingle()

  if (!row) redirect(returnTo)

  async function resolveClientIds(): Promise<string[]> {
    if (group!.type === 'linked') {
      if (!group!.prestation_id) return []
      const { data: grants } = await supabase
        .from('client_grants')
        .select('client_id')
        .eq('coach_id', user!.id)
        .eq('prestation_id', group!.prestation_id)
        .eq('status', 'active')
      return [...new Set((grants ?? []).map((g: { client_id: string }) => g.client_id).filter(Boolean))]
    }
    const { data: members } = await supabase
      .from('client_group_members')
      .select('client_id')
      .eq('group_id', groupId!)
    return (members ?? []).map((m: { client_id: string }) => m.client_id)
  }

  try {
    const clientIds = await resolveClientIds()
    if (row.kind === 'nutrition') {
      await endNutritionForClients(supabase, {
        coachId: user.id,
        clientIds,
        nutritionPlanId: row.content_id,
      })
    } else {
      await endProgramForClients(supabase, {
        coachId: user.id,
        clientIds,
        programId: row.content_id,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'revoke'
    const sep = returnTo.includes('?') ? '&' : '?'
    redirect(`${returnTo}${sep}error=` + encodeURIComponent(msg))
  }

  await supabase
    .from('client_group_pushed_content')
    .delete()
    .eq('id', rowId)
    .eq('group_id', groupId)

  revalidatePath(`/clients/groupes/${groupId}/prestation`)
  revalidatePath(`/clients/groupes/${groupId}`)
  revalidatePath('/clients')
  revalidatePath('/nutrition')
  redirect(returnTo)
}

export async function pushProgramFromGroupAction(formData: FormData) {
  if (!formData.has('kind')) formData.set('kind', 'fitness')
  if (!formData.has('content_id') && formData.has('program_id')) {
    formData.set('content_id', String(formData.get('program_id')))
  }
  return pushContentFromGroupAction(formData)
}

export async function pushProgramFromLinkedGroupAction(formData: FormData) {
  return pushProgramFromGroupAction(formData)
}
