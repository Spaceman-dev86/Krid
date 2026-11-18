'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  chatDb,
  ensureDmThreadId,
  forwardChatMessage,
  markThreadRead,
  mediaKindFromMime,
  sendChatMessage,
  hideChatMessageForMe,
  softDeleteChatMessage,
  toggleMessageReaction,
  togglePinChatMessage,
  upsertThreadUserState,
} from '../../../../lib/chat/chat'
import { createClient } from '../../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requirePortalClient(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/messages')}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, app_name')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}/showroom?error=not_your_coach`)

  return {
    supabase,
    userId: user.id,
    clientId: client.id,
    coachId: client.coach_id as string,
    slug,
    appName: branding.app_name as string | null,
  }
}

export async function startCoachDmAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  if (!slug) redirect('/login/client')

  const ctx = await requirePortalClient(slug)

  let threadId: string
  try {
    threadId = await ensureDmThreadId(ctx.supabase, ctx.clientId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/coach?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`${portalBase(slug)}/messages`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientSendMessageAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const body = String(formData.get('body') ?? '')
  const replyToId = String(formData.get('reply_to_id') ?? '').trim() || null
  if (!slug || !threadId) redirect('/login/client')

  const ctx = await requirePortalClient(slug)

  try {
    await sendChatMessage(ctx.supabase, threadId, ctx.userId, { body, replyToId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    if (msg === 'empty') return { ok: true as const }
    return { ok: false as const, error: msg }
  }

  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  return { ok: true as const }
}

export async function clientUploadChatMediaAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const replyToId = String(formData.get('reply_to_id') ?? '').trim() || null
  const caption = String(formData.get('body') ?? '')
  const file = formData.get('file')
  if (!slug || !threadId) redirect('/login/client')
  if (!(file instanceof File) || !file.size) {
    redirect(`${portalBase(slug)}/messages/${threadId}?error=Fichier%20manquant`)
  }

  const ctx = await requirePortalClient(slug)
  const db = chatDb(ctx.supabase)
  const { data: thread } = await db
    .from('chat_threads')
    .select('id, coach_id, type, client_id, group_id')
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!thread) redirect(`${portalBase(slug)}/messages`)

  const mime = file.type || 'application/octet-stream'
  const asKind = String(formData.get('media_as') ?? '').trim()
  let kind = mediaKindFromMime(mime, file.name)
  if (asKind === 'sticker') kind = 'sticker'
  if (asKind === 'gif') kind = 'gif'
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8)
  const path = `${thread.coach_id}/${threadId}/${crypto.randomUUID()}.${ext}`

  const buf = Buffer.from(await file.arrayBuffer())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (ctx.supabase as any).storage.from('chat-media').upload(path, buf, {
    contentType: mime,
    upsert: false,
  })
  if (upErr) {
    return { ok: false as const, error: upErr.message }
  }

  const durationRaw = String(formData.get('duration_ms') ?? '').trim()
  const durationMs = durationRaw ? Number(durationRaw) : undefined

  try {
    await sendChatMessage(ctx.supabase, threadId, ctx.userId, {
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

  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  return { ok: true as const }
}

export async function clientToggleReactionAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const emoji = String(formData.get('emoji') ?? '').trim()
  if (!slug || !threadId || !messageId || !emoji) return

  const ctx = await requirePortalClient(slug)
  try {
    await toggleMessageReaction(ctx.supabase, messageId, ctx.userId, emoji)
  } catch {
    // ignore
  }
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientMarkReadAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!slug || !threadId) return
  const ctx = await requirePortalClient(slug)
  await markThreadRead(ctx.supabase, threadId, ctx.userId)
  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientDeleteMessageAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const scope = String(formData.get('scope') ?? 'everyone').trim()
  if (!slug || !threadId || !messageId) return
  const ctx = await requirePortalClient(slug)
  try {
    if (scope === 'me') {
      await hideChatMessageForMe(ctx.supabase, messageId, ctx.userId)
    } else {
      await softDeleteChatMessage(ctx.supabase, messageId)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/messages/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientPinMessageAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  if (!slug || !threadId || !messageId) return
  const ctx = await requirePortalClient(slug)
  try {
    await togglePinChatMessage(ctx.supabase, messageId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/messages/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}

export async function clientForwardMessageAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  const messageId = String(formData.get('message_id') ?? '').trim()
  const target = String(formData.get('target_thread_id') ?? '').trim()
  if (!slug || !threadId || !messageId || !target) return
  const ctx = await requirePortalClient(slug)
  try {
    await forwardChatMessage(ctx.supabase, messageId, target, ctx.userId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/messages/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath(`${portalBase(slug)}/messages`)
  redirect(`${portalBase(slug)}/messages/${target}`)
}

export async function clientThreadStateAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const threadId = String(formData.get('thread_id') ?? '').trim()
  if (!slug || !threadId) return
  const ctx = await requirePortalClient(slug)
  const pinned = formData.get('pinned')
  const archived = formData.get('archived')
  const clear = formData.get('clear')
  try {
    await upsertThreadUserState(ctx.supabase, threadId, {
      pinned: pinned === '1' ? true : pinned === '0' ? false : undefined,
      archived: archived === '1' ? true : archived === '0' ? false : undefined,
      clearNow: clear === '1',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error'
    redirect(`${portalBase(slug)}/messages/${threadId}?error=${encodeURIComponent(msg)}`)
  }
  revalidatePath(`${portalBase(slug)}/messages`)
  revalidatePath(`${portalBase(slug)}/messages/${threadId}`)
  redirect(`${portalBase(slug)}/messages/${threadId}`)
}
