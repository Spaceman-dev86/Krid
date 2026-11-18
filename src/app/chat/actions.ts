'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  chatDb,
  clearChatThreadHistory,
  ensureDmThreadId,
  ensureGroupThreadId,
  forwardChatMessage,
  markThreadRead,
  mediaKindFromMime,
  resolveMentions,
  saveChatMediaToDrive,
  sendChatMessage,
  hideChatMessageForMe,
  softDeleteChatMessage,
  toggleMessageReaction,
  togglePinChatMessage,
  upsertThreadUserState,
} from '../../lib/chat/chat'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  // Même fallback session que requireCoachAppUser (évite faux logout si getUser timeout)
  const { requireCoachAppUser } = await import('../../lib/auth/requireCoachAppUser')
  const { supabase, userId } = await requireCoachAppUser()
  return { supabase, userId }
}

/** DM avec client archivé → pas d’envoi (lecture seule). */
async function assertDmWritable(supabase: Awaited<ReturnType<typeof createClient>>, threadId: string, coachId: string) {
  const { data: thread } = await chatDb(supabase)
    .from('chat_threads')
    .select('type, client_id')
    .eq('id', threadId)
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!thread) redirect('/chat')
  if (thread.type !== 'dm' || !thread.client_id) return
  const { data: client } = await supabase
    .from('clients')
    .select('status')
    .eq('id', thread.client_id)
    .eq('coach_id', coachId)
    .maybeSingle()
  if (client?.status === 'archived') {
    redirect(`/chat/${threadId}?error=${encodeURIComponent('Client archivé — lecture seule')}`)
  }
}

export async function openDmWithClientAction(formData: FormData) {
  const clientId = String(formData.get('client_id') ?? '').trim()
  if (!clientId) redirect('/chat')

  const draft = String(formData.get('draft') ?? '').trim()

  const { supabase, userId } = await requireCoach()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect('/chat?error=client')

  let threadId: string
  try {
    threadId = await ensureDmThreadId(supabase, clientId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/chat')
  const qs = draft ? `?draft=${encodeURIComponent(draft)}` : ''
  redirect(`/chat/${threadId}${qs}`)
}

/** Ouvre / crée le DM sans redirect — pour popup Message sur fiche plan / client. */
export async function ensureClientDmThreadAction(
  clientId: string,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const id = String(clientId ?? '').trim()
  if (!id) return { ok: false, error: 'client' }

  const { supabase, userId } = await requireCoach()

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) return { ok: false, error: 'Client introuvable' }

  try {
    const threadId = await ensureDmThreadId(supabase, id)
    return { ok: true, threadId }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'error' }
  }
}

export async function openGroupThreadAction(formData: FormData) {
  const groupId = String(formData.get('group_id') ?? '').trim()
  if (!groupId) redirect('/chat')

  const { supabase, userId } = await requireCoach()
  const { data: group } = await supabase
    .from('client_groups')
    .select('id')
    .eq('id', groupId)
    .eq('coach_id', userId)
    .maybeSingle()
  if (!group) redirect('/chat?error=groupe')

  let threadId: string
  try {
    threadId = await ensureGroupThreadId(supabase, groupId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/chat')
  redirect(`/chat/${threadId}`)
}

/** Crée un groupe manuel chat ON + membres + ouvre le thread. */
export async function createChatGroupAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  const memberIds = formData.getAll('member_id').map(String).filter(Boolean)

  if (!name) redirect('/chat?error=Nom%20requis')
  if (memberIds.length < 1) redirect('/chat?error=Ajoute%20au%20moins%201%20membre')

  const { data: owned } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .in('id', memberIds)
  const okIds = (owned ?? []).map((c) => c.id)
  if (!okIds.length) redirect('/chat?error=Membres%20invalides')

  const { data: group, error } = await supabase
    .from('client_groups')
    .insert({
      coach_id: userId,
      name,
      description,
      type: 'manual',
      chat_enabled: true,
      drive_enabled: false,
    })
    .select('id')
    .maybeSingle()

  if (error || !group) {
    redirect(`/chat?error=${encodeURIComponent(error?.message || 'Groupe impossible')}`)
  }

  await supabase.from('client_group_members').insert(
    okIds.map((client_id) => ({ group_id: group.id, client_id })),
  )

  let threadId: string
  try {
    threadId = await ensureGroupThreadId(supabase, group.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/chat')
  revalidatePath('/clients/groupes')
  redirect(`/chat/${threadId}`)
}

export async function coachSendMessageAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const body = String(formData.get('body') ?? '')
  const replyToId = String(formData.get('reply_to_id') ?? '').trim() || null
  if (!threadId) redirect('/chat')

  const { supabase, userId } = await requireCoach()
  await assertDmWritable(supabase, threadId, userId)

  // Mentions: map display names from clients linked to this coach
  const { data: clients } = await supabase
    .from('clients')
    .select('user_id, first_name, last_name, email')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .not('user_id', 'is', null)
    .limit(300)
  const nameToId: Record<string, string> = {}
  for (const c of clients ?? []) {
    if (!c.user_id) continue
    const label = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email
    if (label) nameToId[label] = c.user_id
  }
  const mentions = resolveMentions(body, nameToId)

  try {
    await sendChatMessage(supabase, threadId, userId, {
      body,
      replyToId,
      mentions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'empty') return { ok: true as const }
    return { ok: false as const, error: msg }
  }

  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  return { ok: true as const }
}

export async function coachUploadChatMediaAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const replyToId = String(formData.get('reply_to_id') ?? '').trim() || null
  const caption = String(formData.get('body') ?? '')
  const file = formData.get('file')
  if (!threadId) redirect('/chat')
  if (!(file instanceof File) || !file.size) {
    redirect(`/chat/${threadId}?error=Fichier%20manquant`)
  }

  const { supabase, userId } = await requireCoach()
  await assertDmWritable(supabase, threadId, userId)
  const db = chatDb(supabase)
  const { data: thread } = await db
    .from('chat_threads')
    .select('id, coach_id')
    .eq('id', threadId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!thread) redirect('/chat?error=thread')

  const mime = file.type || 'application/octet-stream'
  const asKind = String(formData.get('media_as') ?? '').trim()
  let kind = mediaKindFromMime(mime, file.name)
  if (asKind === 'sticker') kind = 'sticker'
  if (asKind === 'gif') kind = 'gif'
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8)
  const path = `${userId}/${threadId}/${crypto.randomUUID()}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (supabase as any).storage.from('chat-media').upload(path, buf, {
    contentType: mime,
    upsert: false,
  })
  if (upErr) {
    return { ok: false as const, error: upErr.message }
  }

  const durationRaw = String(formData.get('duration_ms') ?? '').trim()
  const durationMs = durationRaw ? Number(durationRaw) : undefined

  try {
    await sendChatMessage(supabase, threadId, userId, {
      body: caption,
      replyToId,
      media: {
        kind,
        path,
        mime,
        name: file.name.slice(0, 180),
        bytes: file.size,
        durationMs: Number.isFinite(durationMs) ? durationMs : undefined,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return { ok: false as const, error: msg }
  }

  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  return { ok: true as const }
}

export async function coachToggleReactionAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const emoji = String(formData.get('emoji') ?? '').trim()
  if (!threadId || !messageId || !emoji) return

  const { supabase, userId } = await requireCoach()
  try {
    await toggleMessageReaction(supabase, messageId, userId, emoji)
  } catch {
    // ignore if slice 65 missing
  }
  revalidatePath(`/chat/${threadId}`)
}

export async function coachMarkReadAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!threadId) return
  const { supabase, userId } = await requireCoach()
  await markThreadRead(supabase, threadId, userId)
  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
}

export async function coachDeleteMessageAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const scope = String(formData.get('scope') ?? 'everyone').trim() // me | everyone
  if (!threadId || !messageId) return
  const { supabase, userId } = await requireCoach()
  try {
    if (scope === 'me') {
      await hideChatMessageForMe(supabase, messageId, userId)
    } else {
      await softDeleteChatMessage(supabase, messageId)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/chat/${threadId}`)
  return { ok: true as const }
}

export async function coachPinMessageAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  if (!threadId || !messageId) return
  const { supabase } = await requireCoach()
  try {
    await togglePinChatMessage(supabase, messageId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    return { ok: false as const, error: msg }
  }
  revalidatePath(`/chat/${threadId}`)
  return { ok: true as const }
}

export async function coachForwardMessageAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const target = String(formData.get('target_thread_id') ?? '').trim()
  if (!threadId || !messageId || !target) return
  const { supabase, userId } = await requireCoach()
  try {
    await forwardChatMessage(supabase, messageId, target, userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/chat')
  revalidatePath(`/chat/${target}`)
  redirect(`/chat/${target}`)
}

export async function coachSaveMediaToDriveAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  if (!threadId || !messageId) return
  const { supabase, userId } = await requireCoach()
  try {
    await saveChatMediaToDrive(supabase, userId, messageId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/drive')
  redirect(`/chat/${threadId}?ok=drive`)
}

export async function coachThreadStateAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!threadId) return
  const { supabase } = await requireCoach()
  const pinned = formData.get('pinned')
  const archived = formData.get('archived')
  const clear = formData.get('clear')
  try {
    await upsertThreadUserState(supabase, threadId, {
      pinned: pinned === '1' ? true : pinned === '0' ? false : undefined,
      archived: archived === '1' ? true : archived === '0' ? false : undefined,
      clearNow: clear === '1',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  redirect(`/chat/${threadId}`)
}

/** Soft-delete global de tout l’historique du fil (coach). */
export async function coachClearHistoryAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const confirm = String(formData.get('confirm') ?? '').trim()
  if (!threadId) return
  if (confirm !== '1') redirect(`/chat/${threadId}?error=confirm`)

  const { supabase, userId } = await requireCoach()
  const { data: thread } = await chatDb(supabase)
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!thread) redirect('/chat')

  try {
    await clearChatThreadHistory(supabase, threadId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`/chat/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  redirect(`/chat/${threadId}?ok=cleared`)
}

/** Renommer un groupe (+ description) depuis le menu chat. */
export async function coachRenameGroupAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const groupId = String(formData.get('group_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim() || null
  if (!threadId || !groupId) return
  if (!name) redirect(`/chat/${threadId}?error=Nom%20requis`)

  const { supabase, userId } = await requireCoach()
  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type')
    .eq('id', groupId)
    .eq('coach_id', userId)
    .maybeSingle()
  if (!group) redirect(`/chat/${threadId}?error=groupe`)
  if (group.type !== 'manual') {
    redirect(`/chat/${threadId}?error=Groupe%20auto%20:%20nom%20non%20modifiable`)
  }

  const { error } = await supabase
    .from('client_groups')
    .update({ name, description })
    .eq('id', groupId)
    .eq('coach_id', userId)

  if (error) redirect(`/chat/${threadId}?error=${encodeURIComponent(error.message)}`)

  await chatDb(supabase)
    .from('chat_threads')
    .update({ title: name, updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('coach_id', userId)

  revalidatePath('/chat')
  revalidatePath(`/chat/${threadId}`)
  revalidatePath(`/clients/groupes/${groupId}`)
  redirect(`/chat/${threadId}`)
}

/** Coach : ajouter / retirer un membre d’un groupe depuis le chat. */
export async function coachGroupMemberAction(formData: FormData) {
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const groupId = String(formData.get('group_id') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const op = String(formData.get('op') ?? '').trim() // add | remove
  if (!threadId || !groupId || !clientId || !op) return

  const { supabase, userId } = await requireCoach()
  const { data: group } = await supabase
    .from('client_groups')
    .select('id')
    .eq('id', groupId)
    .eq('coach_id', userId)
    .maybeSingle()
  if (!group) redirect(`/chat/${threadId}?error=groupe`)

  if (op === 'add') {
    await supabase.from('client_group_members').upsert({ group_id: groupId, client_id: clientId })
  } else if (op === 'remove') {
    await supabase
      .from('client_group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('client_id', clientId)
  }

  revalidatePath(`/chat/${threadId}`)
  revalidatePath(`/clients/groupes/${groupId}`)
  redirect(`/chat/${threadId}`)
}
