export type ChatThreadRow = {
  id: string
  coach_id: string
  type: 'dm' | 'group'
  client_id: string | null
  group_id: string | null
  title: string | null
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string
}

export type ChatMediaKind = 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'gif'

export type ChatMessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
  reply_to_id?: string | null
  forwarded_from_id?: string | null
  mentions?: string[]
  media_kind?: ChatMediaKind | null
  media_path?: string | null
  media_mime?: string | null
  media_name?: string | null
  media_bytes?: number | null
  media_duration_ms?: number | null
  tag?: string | null
  pinned_at?: string | null
  /** Joined reply preview (optional). */
  reply?: {
    id: string
    body: string
    sender_id: string
    media_kind?: ChatMediaKind | null
  } | null
  /** Aggregated reactions. */
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>
}

export type ChatInboxItem = {
  threadId: string
  title: string
  preview: string
  at: string | null
  unread: boolean
  clientId: string | null
  groupId?: string | null
  kind: 'dm' | 'group'
  pinned?: boolean
  archived?: boolean
}

export type ChatThreadUserState = {
  pinned: boolean
  archived: boolean
  clearedBefore: string | null
}

export function clientDisplayName(c: {
  first_name: string | null
  last_name: string | null
  email: string
}): string {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

/** Nom affiché du coach côté portail (pas le nom d’app branding). */
export async function loadCoachDisplayName(
  supabase: unknown,
  coachId: string
): Promise<string> {
  const db = chatDb(supabase)
  const { data } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', coachId)
    .maybeSingle()

  const fromSession = String(data?.full_name ?? '').trim()
  if (fromSession) return fromSession

  // RLS client → coach peut bloquer ; fallback service_role si dispo
  try {
    const { createServiceRoleClient } = await import('../supabase/serviceRole')
    const admin = createServiceRoleClient()
    if (admin) {
      const { data: p } = await admin
        .from('profiles')
        .select('full_name, email')
        .eq('id', coachId)
        .maybeSingle()
      const name = String(p?.full_name ?? '').trim()
      if (name) return name
      const email = String(p?.email ?? '').trim()
      if (email) return email
    }
  } catch {
    // ignore
  }

  const email = String(data?.email ?? '').trim()
  return email || 'Mon coach'
}

export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
  }
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function relativeChatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return formatChatTime(iso)
}

/** Pastille heure type WhatsApp (inbox). */
export function inboxListTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000)
  if (dayDiff === 0) {
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d)
  }
  if (dayDiff === 1) return 'Hier'
  if (dayDiff < 7) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(d)
  }
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d)
}

/** Séparateur de jour dans le fil. */
export function chatDayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayDiff = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000)
  if (dayDiff === 0) return "Aujourd'hui"
  if (dayDiff === 1) return 'Hier'
  if (dayDiff > 1 && dayDiff < 7) {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d)
  }
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

export function chatDayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

/** Minimal thenable Postgrest-like client for tables not in generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function chatDb(supabase: unknown): any {
  return supabase as any
}

export async function ensureDmThreadId(
  supabase: unknown,
  clientId: string
): Promise<string> {
  const db = chatDb(supabase)
  const { data, error } = await db.rpc('ensure_dm_thread', { p_client_id: clientId })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ensure_dm_thread returned no id')
  return String(data)
}

export async function ensureGroupThreadId(
  supabase: unknown,
  groupId: string
): Promise<string> {
  const db = chatDb(supabase)
  const { data, error } = await db.rpc('ensure_group_thread', { p_group_id: groupId })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('ensure_group_thread returned no id')
  return String(data)
}

export function mediaKindFromMime(mime: string, fileName?: string): ChatMediaKind {
  const lower = (fileName || '').toLowerCase()
  if (mime === 'image/gif' || lower.endsWith('.gif')) return 'gif'
  if (mime.startsWith('image/') && (lower.includes('sticker') || lower.endsWith('.webp'))) {
    // sticker hint via name; default webp stays image unless flagged
    if (lower.includes('sticker')) return 'sticker'
  }
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'file'
}

export async function markThreadRead(
  supabase: unknown,
  threadId: string,
  readerId: string
): Promise<void> {
  const db = chatDb(supabase)
  await db.from('chat_thread_reads').upsert(
    {
      thread_id: threadId,
      reader_id: readerId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'thread_id,reader_id' }
  )
}

/**
 * Total conversations non lues (coach) — badge sidebar.
 * Léger : pas de noms / groupes. Ignore les fils dont le dernier msg est le sien.
 */
export async function countCoachChatUnread(
  supabase: unknown,
  coachId: string,
  readerId: string
): Promise<number> {
  try {
    const db = chatDb(supabase)
    const { data: threads, error } = await db
      .from('chat_threads')
      .select('id, last_message_at')
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .not('last_message_at', 'is', null)
    if (error || !threads?.length) return 0

    const threadIds = threads.map((t) => t.id as string)
    const [{ data: readRows }, { data: states }, { data: lastMsgs }] = await Promise.all([
      db
        .from('chat_thread_reads')
        .select('thread_id, last_read_at')
        .eq('reader_id', readerId)
        .in('thread_id', threadIds),
      db
        .from('chat_thread_user_state')
        .select('thread_id, archived_at')
        .eq('user_id', readerId)
        .in('thread_id', threadIds),
      db
        .from('chat_messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', threadIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(threadIds.length * 3, 400)),
    ])

    const reads = new Map<string, string>()
    for (const r of readRows ?? []) reads.set(r.thread_id, r.last_read_at)
    const archived = new Set(
      (states ?? []).filter((s) => s.archived_at).map((s) => s.thread_id as string)
    )
    const lastSender = new Map<string, string>()
    for (const m of lastMsgs ?? []) {
      if (!lastSender.has(m.thread_id)) lastSender.set(m.thread_id, m.sender_id)
    }

    let n = 0
    for (const t of threads) {
      const id = t.id as string
      if (archived.has(id)) continue
      if (lastSender.get(id) === readerId) continue
      const at = t.last_message_at as string
      const lastRead = reads.get(id)
      if (at && (!lastRead || new Date(at) > new Date(lastRead))) n += 1
    }
    return n
  } catch {
    return 0
  }
}

/** Soft-delete tous les messages du fil (coach, effet global). */
export async function clearChatThreadHistory(
  supabase: unknown,
  threadId: string
): Promise<number> {
  const db = chatDb(supabase)
  const { data, error } = await db.rpc('clear_chat_thread_history', {
    p_thread_id: threadId,
  })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export async function listCoachInbox(
  supabase: unknown,
  coachId: string,
  readerId: string
): Promise<ChatInboxItem[]> {
  const db = chatDb(supabase)
  const { data: threads, error: threadsErr } = await db
    .from('chat_threads')
    .select('id, type, client_id, group_id, title, last_message_at, last_message_preview')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })

  if (threadsErr) throw new Error(threadsErr.message)

  const list = (threads ?? []) as Array<{
    id: string
    type: 'dm' | 'group'
    client_id: string | null
    group_id: string | null
    title: string | null
    last_message_at: string | null
    last_message_preview: string | null
  }>

  const clientIds = Array.from(
    new Set(list.map((t) => t.client_id).filter((id): id is string => Boolean(id)))
  )
  const clientNames = new Map<string, string>()
  if (clientIds.length) {
    const { data: clients } = await db
      .from('clients')
      .select('id, first_name, last_name, email')
      .in('id', clientIds)
    for (const c of clients ?? []) {
      clientNames.set(
        c.id,
        clientDisplayName({
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
        })
      )
    }
  }

  const groupIds = Array.from(
    new Set(list.map((t) => t.group_id).filter((id): id is string => Boolean(id)))
  )
  const groupNames = new Map<string, string>()
  if (groupIds.length) {
    const { data: groups } = await db
      .from('client_groups')
      .select('id, name, chat_title')
      .in('id', groupIds)
    for (const g of groups ?? []) {
      const label = (g.chat_title as string | null)?.trim() || (g.name as string) || 'Groupe'
      groupNames.set(g.id as string, label)
    }
  }

  const threadIds = list.map((t) => t.id)
  const reads = new Map<string, string>()
  const pins = new Map<string, { pinned: boolean; archived: boolean }>()
  const lastSender = new Map<string, string>()
  if (threadIds.length) {
    const [{ data: readRows }, { data: states }, { data: lastMsgs }] = await Promise.all([
      db
        .from('chat_thread_reads')
        .select('thread_id, last_read_at')
        .eq('reader_id', readerId)
        .in('thread_id', threadIds),
      db
        .from('chat_thread_user_state')
        .select('thread_id, pinned_at, archived_at')
        .eq('user_id', readerId)
        .in('thread_id', threadIds),
      db
        .from('chat_messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', threadIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(threadIds.length * 3, 400)),
    ])
    for (const r of readRows ?? []) {
      reads.set(r.thread_id, r.last_read_at)
    }
    for (const s of states ?? []) {
      pins.set(s.thread_id, {
        pinned: Boolean(s.pinned_at),
        archived: Boolean(s.archived_at),
      })
    }
    for (const m of lastMsgs ?? []) {
      if (!lastSender.has(m.thread_id)) lastSender.set(m.thread_id, m.sender_id)
    }
  }

  const items = list.map((t) => {
    const kind = t.type === 'group' ? 'group' : 'dm'
    const title =
      kind === 'group'
        ? groupNames.get(t.group_id!) || t.title?.trim() || 'Groupe'
        : (t.client_id && clientNames.get(t.client_id)) || t.title?.trim() || 'Conversation'
    const lastRead = reads.get(t.id)
    const fromOther = lastSender.get(t.id) !== readerId
    const unread = Boolean(
      fromOther &&
        t.last_message_at &&
        (!lastRead || new Date(t.last_message_at) > new Date(lastRead))
    )
    const st = pins.get(t.id)
    return {
      threadId: t.id,
      title,
      preview: t.last_message_preview?.trim() || 'Aucun message',
      at: t.last_message_at,
      unread,
      clientId: t.client_id,
      groupId: t.group_id,
      kind,
      pinned: st?.pinned ?? false,
      archived: st?.archived ?? false,
    } satisfies ChatInboxItem
  })

  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    const ta = a.at ? new Date(a.at).getTime() : 0
    const tb = b.at ? new Date(b.at).getTime() : 0
    return tb - ta
  })
}

export async function listClientInbox(
  supabase: unknown,
  clientId: string,
  readerId: string,
  coachLabel: string
): Promise<ChatInboxItem[]> {
  const db = chatDb(supabase)

  const { data: dmThreads } = await db
    .from('chat_threads')
    .select('id, type, client_id, group_id, title, last_message_at, last_message_preview')
    .eq('client_id', clientId)
    .eq('type', 'dm')
    .is('deleted_at', null)

  const { data: memberships } = await db
    .from('client_group_members')
    .select('group_id')
    .eq('client_id', clientId)
  const groupIds = (memberships ?? []).map((m: { group_id: string }) => m.group_id).filter(Boolean)

  let groupThreads: ChatThreadRow[] = []
  if (groupIds.length) {
    const { data } = await db
      .from('chat_threads')
      .select('id, type, client_id, group_id, title, last_message_at, last_message_preview')
      .eq('type', 'group')
      .in('group_id', groupIds)
      .is('deleted_at', null)
    groupThreads = (data ?? []) as ChatThreadRow[]
  }

  const list = [...((dmThreads ?? []) as ChatThreadRow[]), ...groupThreads].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
    return tb - ta
  })

  const threadIds = list.map((t) => t.id)
  const reads = new Map<string, string>()
  const lastSender = new Map<string, string>()
  if (threadIds.length) {
    const [{ data: readRows }, { data: lastMsgs }] = await Promise.all([
      db
        .from('chat_thread_reads')
        .select('thread_id, last_read_at')
        .eq('reader_id', readerId)
        .in('thread_id', threadIds),
      db
        .from('chat_messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', threadIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(Math.min(threadIds.length * 3, 400)),
    ])
    for (const r of readRows ?? []) {
      reads.set(r.thread_id, r.last_read_at)
    }
    for (const m of lastMsgs ?? []) {
      if (!lastSender.has(m.thread_id)) lastSender.set(m.thread_id, m.sender_id)
    }
  }

  const gIds = list.map((t) => t.group_id).filter(Boolean) as string[]
  const groupNames = new Map<string, string>()
  if (gIds.length) {
    const { data: groups } = await db
      .from('client_groups')
      .select('id, name, chat_title')
      .in('id', gIds)
    for (const g of groups ?? []) {
      const label = (g.chat_title as string | null)?.trim() || (g.name as string) || 'Groupe'
      groupNames.set(g.id as string, label)
    }
  }

  const pins = new Map<string, { pinned: boolean; archived: boolean }>()
  if (threadIds.length) {
    const { data: states } = await db
      .from('chat_thread_user_state')
      .select('thread_id, pinned_at, archived_at')
      .eq('user_id', readerId)
      .in('thread_id', threadIds)
    for (const s of states ?? []) {
      pins.set(s.thread_id, {
        pinned: Boolean(s.pinned_at),
        archived: Boolean(s.archived_at),
      })
    }
  }

  const items = list.map((t) => {
    const lastRead = reads.get(t.id)
    const fromOther = lastSender.get(t.id) !== readerId
    const unread = Boolean(
      fromOther &&
        t.last_message_at &&
        (!lastRead || new Date(t.last_message_at) > new Date(lastRead))
    )
    const kind = t.type === 'group' ? 'group' : 'dm'
    const st = pins.get(t.id)
    return {
      threadId: t.id,
      title: kind === 'group' ? groupNames.get(t.group_id!) || t.title || 'Groupe' : coachLabel,
      preview: t.last_message_preview?.trim() || 'Aucun message',
      at: t.last_message_at,
      unread,
      clientId: t.client_id,
      groupId: t.group_id,
      kind,
      pinned: st?.pinned ?? false,
      archived: st?.archived ?? false,
    } satisfies ChatInboxItem
  })

  return items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    const ta = a.at ? new Date(a.at).getTime() : 0
    const tb = b.at ? new Date(b.at).getTime() : 0
    return tb - ta
  })
}

export async function loadThreadUserState(
  supabase: unknown,
  threadId: string,
  userId: string
): Promise<ChatThreadUserState> {
  const db = chatDb(supabase)
  const { data } = await db
    .from('chat_thread_user_state')
    .select('pinned_at, archived_at, cleared_before')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle()
  return {
    pinned: Boolean(data?.pinned_at),
    archived: Boolean(data?.archived_at),
    clearedBefore: (data?.cleared_before as string | null) ?? null,
  }
}

export async function loadPeerLastReadAt(
  supabase: unknown,
  threadId: string,
  excludeUserId: string
): Promise<string | null> {
  const db = chatDb(supabase)
  // Guard : le caller doit pouvoir lire le thread (RLS user)
  const { data: access } = await db
    .from('chat_threads')
    .select('id')
    .eq('id', threadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!access?.id) return null

  // Les reads du pair sont filtrés par RLS « own » (slice 16) — lire via service role
  // après le guard. Slice 70 ouvre le SELECT peer ; ce bypass reste safe.
  try {
    const { createServiceRoleClient } = await import('../supabase/serviceRole')
    const admin = createServiceRoleClient()
    if (admin) {
      const { data } = await admin
        .from('chat_thread_reads')
        .select('last_read_at')
        .eq('thread_id', threadId)
        .neq('reader_id', excludeUserId)
        .order('last_read_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return (data?.last_read_at as string | null) ?? null
    }
  } catch {
    // fallback user client ci-dessous
  }

  const { data } = await db
    .from('chat_thread_reads')
    .select('last_read_at')
    .eq('thread_id', threadId)
    .neq('reader_id', excludeUserId)
    .order('last_read_at', { ascending: false })
    .limit(1)
  const row = Array.isArray(data) ? data[0] : data
  return (row?.last_read_at as string | null) ?? null
}

export async function loadSenderNames(
  supabase: unknown,
  userIds: string[]
): Promise<Record<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return {}
  const db = chatDb(supabase)
  const out: Record<string, string> = {}

  // Préférer le nom client (prénom/nom) plutôt que l’email du profil
  const { data: clients } = await db
    .from('clients')
    .select('user_id, first_name, last_name, email')
    .in('user_id', ids)
    .is('deleted_at', null)
  for (const c of clients ?? []) {
    if (!c.user_id) continue
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
    if (name) out[c.user_id as string] = name
  }

  const missing = ids.filter((id) => !out[id])
  if (missing.length) {
    const { data } = await db.from('profiles').select('id, full_name, email').in('id', missing)
    for (const p of data ?? []) {
      const name = String(p.full_name ?? '').trim()
      // Ne jamais afficher l’email comme label de réponse si on a un nom
      out[p.id] = name || 'Utilisateur'
    }
  }

  return out
}

/** Candidats @mention : id user + label affichable (jamais email seul). */
export async function loadMentionCandidates(
  supabase: unknown,
  coachId: string
): Promise<Array<{ id: string; label: string }>> {
  const db = chatDb(supabase)
  const { data: clients } = await db
    .from('clients')
    .select('user_id, first_name, last_name')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .not('user_id', 'is', null)
    .limit(300)
  const out: Array<{ id: string; label: string }> = []
  for (const c of clients ?? []) {
    if (!c.user_id) continue
    const label = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
    if (!label) continue
    out.push({ id: c.user_id as string, label })
  }
  return out
}

export async function loadThreadMessages(
  supabase: unknown,
  threadId: string,
  readerId?: string
): Promise<ChatMessageRow[]> {
  const db = chatDb(supabase)
  let clearedBefore: string | null = null
  if (readerId) {
    try {
      const st = await loadThreadUserState(supabase, threadId, readerId)
      clearedBefore = st.clearedBefore
    } catch {
      clearedBefore = null
    }
  }

  const full =
    'id, thread_id, sender_id, body, created_at, reply_to_id, forwarded_from_id, mentions, media_kind, media_path, media_mime, media_name, media_bytes, media_duration_ms, tag, pinned_at'
  let query = db
    .from('chat_messages')
    .select(full)
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200)
  if (clearedBefore) query = query.gt('created_at', clearedBefore)

  let { data, error } = await query

  if (error) {
    const fallback = await db
      .from('chat_messages')
      .select('id, thread_id, sender_id, body, created_at, tag')
      .eq('thread_id', threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(200)
    data = fallback.data
  }

  let rows = (data ?? []) as ChatMessageRow[]

  // Filtrer « effacer pour moi »
  if (readerId && rows.length) {
    const ids = rows.map((r) => r.id)
    const { data: hides } = await db
      .from('chat_message_hides')
      .select('message_id')
      .eq('user_id', readerId)
      .in('message_id', ids)
    if (hides?.length) {
      const hidden = new Set(hides.map((h: { message_id: string }) => h.message_id))
      rows = rows.filter((r) => !hidden.has(r.id))
    }
  }

  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const r of rows) {
    if (r.reply_to_id && byId.has(r.reply_to_id)) {
      const parent = byId.get(r.reply_to_id)!
      r.reply = {
        id: parent.id,
        body: parent.body,
        sender_id: parent.sender_id,
        media_kind: parent.media_kind,
      }
    }
  }

  const ids = rows.map((r) => r.id)
  if (ids.length && readerId) {
    const { data: reacts } = await db
      .from('chat_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', ids)
    const map = new Map<string, Map<string, { count: number; mine: boolean }>>()
    for (const r of reacts ?? []) {
      const mid = r.message_id as string
      const emoji = r.emoji as string
      if (!map.has(mid)) map.set(mid, new Map())
      const em = map.get(mid)!
      const cur = em.get(emoji) ?? { count: 0, mine: false }
      cur.count += 1
      if (r.user_id === readerId) cur.mine = true
      em.set(emoji, cur)
    }
    for (const row of rows) {
      const em = map.get(row.id)
      if (!em) continue
      row.reactions = Array.from(em.entries()).map(([emoji, v]) => ({
        emoji,
        count: v.count,
        mine: v.mine,
      }))
    }
  }

  return rows
}

export type SendChatPayload = {
  body?: string
  tag?: string | null
  replyToId?: string | null
  forwardedFromId?: string | null
  mentions?: string[]
  media?: {
    kind: ChatMediaKind
    path: string
    mime: string
    name: string
    bytes?: number
    durationMs?: number
  } | null
}

/** Extract @Name mentions matched against known display names → user ids. */
export function resolveMentions(
  body: string,
  nameToId: Record<string, string>
): string[] {
  const ids = new Set<string>()
  const re = /@([^\s@]+(?:\s+[^\s@]+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const raw = m[1].trim().toLowerCase()
    for (const [name, id] of Object.entries(nameToId)) {
      if (name.toLowerCase() === raw || name.toLowerCase().startsWith(raw)) {
        ids.add(id)
      }
    }
  }
  return Array.from(ids)
}

export async function sendChatMessage(
  supabase: unknown,
  threadId: string,
  senderId: string,
  bodyOrPayload: string | SendChatPayload,
  tag?: string | null
): Promise<void> {
  const payload: SendChatPayload =
    typeof bodyOrPayload === 'string' ? { body: bodyOrPayload, tag } : bodyOrPayload

  const trimmed = (payload.body ?? '').trim()
  if (!trimmed && !payload.media) throw new Error('empty')

  const db = chatDb(supabase)
  const row: Record<string, unknown> = {
    thread_id: threadId,
    sender_id: senderId,
    body: trimmed.slice(0, 4000),
  }
  if (payload.tag) row.tag = payload.tag
  if (payload.replyToId) row.reply_to_id = payload.replyToId
  if (payload.forwardedFromId) row.forwarded_from_id = payload.forwardedFromId
  if (payload.mentions?.length) row.mentions = payload.mentions
  if (payload.media) {
    row.media_kind = payload.media.kind
    row.media_path = payload.media.path
    row.media_mime = payload.media.mime
    row.media_name = payload.media.name
    row.media_bytes = payload.media.bytes ?? null
    row.media_duration_ms = payload.media.durationMs ?? null
  }

  const { error } = await db.from('chat_messages').insert(row)
  if (error) {
    if (payload.tag && /tag/i.test(error.message)) {
      delete row.tag
      const { error: err2 } = await db.from('chat_messages').insert(row)
      if (err2) throw new Error(err2.message)
    } else if (/forwarded_from|mentions/i.test(error.message)) {
      delete row.forwarded_from_id
      delete row.mentions
      const { error: err2 } = await db.from('chat_messages').insert(row)
      if (err2) throw new Error(err2.message)
    } else if (/reply_to|media_/i.test(error.message)) {
      const { error: err2 } = await db.from('chat_messages').insert({
        thread_id: threadId,
        sender_id: senderId,
        body: trimmed || '[média — lance la tranche SQL 65]',
      })
      if (err2) throw new Error(err2.message)
    } else {
      throw new Error(error.message)
    }
  }
  await markThreadRead(supabase, threadId, senderId)
}

export async function softDeleteChatMessage(
  supabase: unknown,
  messageId: string
): Promise<void> {
  const db = chatDb(supabase)
  const { error } = await db.rpc('soft_delete_chat_message', { p_message_id: messageId })
  if (error) throw new Error(error.message)
}

/** Effacer pour moi uniquement. */
export async function hideChatMessageForMe(
  supabase: unknown,
  messageId: string,
  userId: string
): Promise<void> {
  const db = chatDb(supabase)
  const { error } = await db.from('chat_message_hides').upsert({
    message_id: messageId,
    user_id: userId,
  })
  if (error) throw new Error(error.message)
}

export async function togglePinChatMessage(
  supabase: unknown,
  messageId: string
): Promise<void> {
  const db = chatDb(supabase)
  const { error } = await db.rpc('toggle_pin_chat_message', { p_message_id: messageId })
  if (error) throw new Error(error.message)
}

export async function upsertThreadUserState(
  supabase: unknown,
  threadId: string,
  opts: { pinned?: boolean; archived?: boolean; clearNow?: boolean }
): Promise<void> {
  const db = chatDb(supabase)
  const { error } = await db.rpc('upsert_chat_thread_user_state', {
    p_thread_id: threadId,
    p_pinned: opts.pinned ?? null,
    p_archived: opts.archived ?? null,
    p_clear_now: Boolean(opts.clearNow),
  })
  if (error) throw new Error(error.message)
}

export async function forwardChatMessage(
  supabase: unknown,
  sourceMessageId: string,
  targetThreadId: string,
  senderId: string
): Promise<void> {
  const db = chatDb(supabase)
  const { data: src, error } = await db
    .from('chat_messages')
    .select(
      'id, body, media_kind, media_path, media_mime, media_name, media_bytes, media_duration_ms'
    )
    .eq('id', sourceMessageId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !src) throw new Error(error?.message || 'message introuvable')

  await sendChatMessage(supabase, targetThreadId, senderId, {
    body: src.body || '',
    forwardedFromId: src.id,
    media: src.media_path
      ? {
          kind: (src.media_kind as ChatMediaKind) || 'file',
          path: src.media_path,
          mime: src.media_mime || 'application/octet-stream',
          name: src.media_name || 'fichier',
          bytes: src.media_bytes ?? undefined,
          durationMs: src.media_duration_ms ?? undefined,
        }
      : null,
  })
}

export async function saveChatMediaToDrive(
  supabase: unknown,
  coachId: string,
  messageId: string
): Promise<void> {
  const db = chatDb(supabase)
  const { data: msg, error } = await db
    .from('chat_messages')
    .select('media_path, media_mime, media_name, media_bytes, thread_id')
    .eq('id', messageId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !msg?.media_path) throw new Error(error?.message || 'pas de média')

  const { data: thread } = await db
    .from('chat_threads')
    .select('coach_id')
    .eq('id', msg.thread_id)
    .maybeSingle()
  if (!thread || thread.coach_id !== coachId) throw new Error('not allowed')

  const { data: blob, error: dlErr } = await db.storage.from('chat-media').download(msg.media_path)
  if (dlErr || !blob) throw new Error(dlErr?.message || 'download failed')

  const safe =
    String(msg.media_name || 'chat-media')
      .replace(/[^\w.\-]+/g, '_')
      .slice(0, 120) || 'file'
  const fileId = crypto.randomUUID()
  const storagePath = `${coachId}/${fileId}/${safe}`
  const buf = Buffer.from(await blob.arrayBuffer())
  const { error: upErr } = await db.storage.from('drive').upload(storagePath, buf, {
    contentType: msg.media_mime || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) throw new Error(upErr.message)

  const { error: insErr } = await db.from('drive_files').insert({
    id: fileId,
    coach_id: coachId,
    folder_id: null,
    name: String(msg.media_name || safe).slice(0, 240),
    storage_path: storagePath,
    mime_type: msg.media_mime || null,
    size_bytes: msg.media_bytes ?? buf.length,
  })
  if (insErr) {
    await db.storage.from('drive').remove([storagePath])
    throw new Error(insErr.message)
  }
}

export async function toggleMessageReaction(
  supabase: unknown,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  const db = chatDb(supabase)
  const { data: existing } = await db
    .from('chat_message_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    await db
      .from('chat_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
  } else {
    const { error } = await db.from('chat_message_reactions').insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    })
    if (error) throw new Error(error.message)
  }
}

export async function signedChatMediaUrl(
  supabase: unknown,
  path: string,
  expiresSec = 3600
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any
  const { data, error } = await client.storage.from('chat-media').createSignedUrl(path, expiresSec)
  if (error) return null
  return data?.signedUrl ?? null
}
