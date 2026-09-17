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

export type ChatMessageRow = {
  id: string
  thread_id: string
  sender_id: string
  body: string
  created_at: string
}

export type ChatInboxItem = {
  threadId: string
  title: string
  preview: string
  at: string | null
  unread: boolean
  clientId: string | null
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

export async function listCoachInbox(
  supabase: unknown,
  coachId: string,
  readerId: string
): Promise<ChatInboxItem[]> {
  const db = chatDb(supabase)
  const { data: threads, error: threadsErr } = await db
    .from('chat_threads')
    .select('id, client_id, title, last_message_at, last_message_preview')
    .eq('coach_id', coachId)
    .eq('type', 'dm')
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })

  if (threadsErr) throw new Error(threadsErr.message)

  const list = (threads ?? []) as Array<{
    id: string
    client_id: string | null
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

  const threadIds = list.map((t) => t.id)
  const reads = new Map<string, string>()
  if (threadIds.length) {
    const { data: readRows } = await db
      .from('chat_thread_reads')
      .select('thread_id, last_read_at')
      .eq('reader_id', readerId)
      .in('thread_id', threadIds)
    for (const r of readRows ?? []) {
      reads.set(r.thread_id, r.last_read_at)
    }
  }

  return list.map((t) => {
    const title =
      (t.client_id && clientNames.get(t.client_id)) || t.title?.trim() || 'Conversation'
    const lastRead = reads.get(t.id)
    const unread = Boolean(
      t.last_message_at && (!lastRead || new Date(t.last_message_at) > new Date(lastRead))
    )
    return {
      threadId: t.id,
      title,
      preview: t.last_message_preview?.trim() || 'Aucun message',
      at: t.last_message_at,
      unread,
      clientId: t.client_id,
    }
  })
}

export async function listClientInbox(
  supabase: unknown,
  clientId: string,
  readerId: string,
  coachLabel: string
): Promise<ChatInboxItem[]> {
  const db = chatDb(supabase)
  const { data: threads } = await db
    .from('chat_threads')
    .select('id, client_id, title, last_message_at, last_message_preview')
    .eq('client_id', clientId)
    .eq('type', 'dm')
    .is('deleted_at', null)
    .order('last_message_at', { ascending: false })

  const list = (threads ?? []) as ChatThreadRow[]
  const threadIds = list.map((t) => t.id)
  const reads = new Map<string, string>()
  if (threadIds.length) {
    const { data: readRows } = await db
      .from('chat_thread_reads')
      .select('thread_id, last_read_at')
      .eq('reader_id', readerId)
      .in('thread_id', threadIds)
    for (const r of readRows ?? []) {
      reads.set(r.thread_id, r.last_read_at)
    }
  }

  return list.map((t) => {
    const lastRead = reads.get(t.id)
    const unread = Boolean(
      t.last_message_at && (!lastRead || new Date(t.last_message_at) > new Date(lastRead))
    )
    return {
      threadId: t.id,
      title: coachLabel,
      preview: t.last_message_preview?.trim() || 'Aucun message',
      at: t.last_message_at,
      unread,
      clientId: t.client_id,
    }
  })
}

export async function loadThreadMessages(
  supabase: unknown,
  threadId: string
): Promise<ChatMessageRow[]> {
  const db = chatDb(supabase)
  const { data } = await db
    .from('chat_messages')
    .select('id, thread_id, sender_id, body, created_at')
    .eq('thread_id', threadId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(200)
  return (data ?? []) as ChatMessageRow[]
}

export async function sendChatMessage(
  supabase: unknown,
  threadId: string,
  senderId: string,
  body: string,
  tag?: string | null
): Promise<void> {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('empty')
  const db = chatDb(supabase)
  const row: Record<string, unknown> = {
    thread_id: threadId,
    sender_id: senderId,
    body: trimmed.slice(0, 4000),
  }
  if (tag) row.tag = tag
  const { error } = await db.from('chat_messages').insert(row)
  if (error) {
    // Colonne tag absente (slice 18 pas encore run) → retry sans tag
    if (tag && /tag/i.test(error.message)) {
      const { error: err2 } = await db.from('chat_messages').insert({
        thread_id: threadId,
        sender_id: senderId,
        body: trimmed.slice(0, 4000),
      })
      if (err2) throw new Error(err2.message)
    } else {
      throw new Error(error.message)
    }
  }
  await markThreadRead(supabase, threadId, senderId)
}
