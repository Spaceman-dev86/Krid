'use server'

import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'
import {
  chatDb,
  clientDisplayName,
  loadMentionCandidates,
  loadPeerLastReadAt,
  loadSenderNames,
  loadThreadMessages,
  loadThreadUserState,
  markThreadRead,
  signedChatMediaUrl,
  type ChatInboxItem,
  type ChatMessageRow,
  listCoachInbox,
} from '@/src/lib/chat/chat'
export type CoachThreadBundle = {
  ok: true
  threadId: string
  title: string
  type: 'dm' | 'group'
  clientId: string | null
  groupId: string | null
  groupName: string | null
  groupDescription: string | null
  groupEditable: boolean
  clientPhone: string | null
  readOnly: boolean
  messages: ChatMessageRow[]
  mediaUrls: Record<string, string>
  senderNames: Record<string, string>
  peerLastReadAt: string | null
  archived: boolean
  mentionCandidates: Array<{ id: string; label: string }>
  groupMembers: Array<{ clientId: string; label: string }>
  allClients: Array<{ id: string; label: string }>
  rdvClients: Array<{ id: string; label: string }>
  rdvGroups: Array<{ id: string; label: string; memberIds: string[] }>
  defaultAudience: string
  nameMapEntries: Array<[string, string]>
  ficheHref: string | null
  currentUserId: string
}

export type CoachChatBoot = {
  inbox: ChatInboxItem[]
  clients: Array<{ id: string; first_name: string | null; last_name: string | null; email: string }>
  groups: Array<{ id: string; name: string; chat_enabled: boolean; memberCount: number }>
}

/** Boot inbox une fois (client) — ne bloque plus le layout SSR à chaque switch. */
export async function loadCoachChatBootAction(): Promise<CoachChatBoot> {
  const { supabase, userId } = await requireCoachAppUser()

  const [inbox, clients, groups] = await Promise.all([
    listCoachInbox(supabase, userId, userId).catch(() => [] as ChatInboxItem[]),
    (async () => {
      try {
        const { data } = await supabase
          .from('clients')
          .select('id, first_name, last_name, email')
          .eq('coach_id', userId)
          .is('deleted_at', null)
          .neq('status', 'archived')
          .order('first_name', { ascending: true })
          .limit(200)
        return data ?? []
      } catch {
        return [] as CoachChatBoot['clients']
      }
    })(),
    (async () => {
      try {
        const { data } = await supabase
          .from('client_groups')
          .select('id, name, chat_enabled, client_group_members(client_id)')
          .eq('coach_id', userId)
          .in('type', ['manual', 'linked'])
          .order('name', { ascending: true })
          .limit(100)
        return data ?? []
      } catch {
        return [] as Array<{
          id: string
          name: string
          chat_enabled: boolean
          client_group_members: unknown
        }>
      }
    })(),
  ])

  const groupOpts = (groups ?? []).map(
    (g: {
      id: string
      name: string
      chat_enabled: boolean
      client_group_members: unknown
    }) => {
      const members = Array.isArray(g.client_group_members)
        ? g.client_group_members
        : g.client_group_members
          ? [g.client_group_members]
          : []
      return {
        id: g.id,
        name: g.name || 'Groupe',
        chat_enabled: Boolean(g.chat_enabled),
        memberCount: members.length,
      }
    }
  )

  return {
    inbox,
    clients: clients as CoachChatBoot['clients'],
    groups: groupOpts,
  }
}

/** Bundle fil — léger, cacheable côté client. Mark-read en fire-and-forget. */
export async function loadCoachThreadBundleAction(
  threadId: string
): Promise<CoachThreadBundle | { ok: false; error: string }> {
  const { supabase, userId } = await requireCoachAppUser()
  const db = chatDb(supabase)

  const { data: thread } = await db
    .from('chat_threads')
    .select(
      'id, coach_id, client_id, type, group_id, clients(first_name, last_name, email, phone, status)'
    )
    .eq('id', threadId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!thread) return { ok: false, error: 'introuvable' }

  // Mark read sans bloquer le rendu (best-effort parallèle)
  void markThreadRead(supabase, threadId, userId).catch(() => {})
  // Uniquement les notifs de CE thread (payload.thread_id), pas toutes les convos.
  void chatDb(supabase)
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('type', 'chat_message')
    .is('read_at', null)
    .contains('payload', { thread_id: threadId })
    .then(() => {})
    .catch(() => {})

  const clientRaw = Array.isArray(thread.clients) ? thread.clients[0] : thread.clients
  const clientPhone =
    clientRaw && typeof clientRaw === 'object' && 'phone' in clientRaw
      ? (clientRaw.phone as string | null)
      : null
  const clientStatus =
    clientRaw && typeof clientRaw === 'object' && 'status' in clientRaw
      ? (clientRaw.status as string | null)
      : null
  const readOnly = thread.type === 'dm' && clientStatus === 'archived'

  let title = clientRaw ? clientDisplayName(clientRaw) : 'Conversation'
  let groupName: string | null = null
  let groupDescription: string | null = null
  let groupEditable = false

  if (thread.type === 'group' && thread.group_id) {
    const { data: group } = await supabase
      .from('client_groups')
      .select('name, description, type')
      .eq('id', thread.group_id)
      .maybeSingle()
    if (group?.name) {
      title = group.name
      groupName = group.name
    }
    groupDescription = group?.description ?? null
    groupEditable = group?.type === 'manual'
  }

  const [messages, peerLastReadAt, threadState, mentionCandidates] = await Promise.all([
    loadThreadMessages(supabase, threadId, userId),
    loadPeerLastReadAt(supabase, threadId, userId).catch(() => null),
    loadThreadUserState(supabase, threadId, userId).catch(() => ({
      pinned: false,
      archived: false,
      clearedBefore: null,
    })),
    loadMentionCandidates(supabase, userId).catch(() => [] as Array<{ id: string; label: string }>),
  ])

  const senderNames = await loadSenderNames(
    supabase,
    messages.flatMap((m) => [m.sender_id, m.reply?.sender_id].filter(Boolean) as string[])
  ).catch(() => ({} as Record<string, string>))

  if (thread.type === 'dm' && clientRaw && thread.client_id) {
    const { data: cRow } = await supabase
      .from('clients')
      .select('user_id, first_name, last_name')
      .eq('id', thread.client_id)
      .maybeSingle()
    if (cRow?.user_id) {
      const n = [cRow.first_name, cRow.last_name].filter(Boolean).join(' ').trim()
      if (n) senderNames[cRow.user_id] = n
    }
  }

  senderNames[userId] = senderNames[userId] || 'Vous'

  // Signer au plus 12 médias (le reste au clic / refresh) — gros gain switch
  const mediaPaths = messages.map((m) => m.media_path).filter(Boolean) as string[]
  const mediaUrls: Record<string, string> = {}
  await Promise.all(
    mediaPaths.slice(0, 12).map(async (path) => {
      const url = await signedChatMediaUrl(supabase, path)
      if (url) mediaUrls[path] = url
    })
  )

  const rdvClients: Array<{ id: string; label: string }> = []
  const rdvGroups: Array<{ id: string; label: string; memberIds: string[] }> = []
  let defaultAudience = ''
  const nameMap = new Map<string, string>()

  if (thread.type === 'dm' && thread.client_id && clientRaw) {
    const label = clientDisplayName(clientRaw)
    rdvClients.push({ id: thread.client_id, label })
    nameMap.set(thread.client_id, label)
    defaultAudience = `client:${thread.client_id}`
  } else if (thread.type === 'group' && thread.group_id) {
    const { data: group } = await supabase
      .from('client_groups')
      .select('id, name, client_group_members(client_id, clients(id, first_name, last_name, email))')
      .eq('id', thread.group_id)
      .eq('coach_id', userId)
      .maybeSingle()
    if (group) {
      const members = Array.isArray(group.client_group_members)
        ? group.client_group_members
        : group.client_group_members
          ? [group.client_group_members]
          : []
      const memberIds: string[] = []
      for (const m of members) {
        const cid = m.client_id as string
        if (!cid) continue
        memberIds.push(cid)
        const cRaw = Array.isArray(m.clients) ? m.clients[0] : m.clients
        if (cRaw) {
          const label = clientDisplayName(cRaw)
          rdvClients.push({ id: cid, label })
          nameMap.set(cid, label)
        }
      }
      rdvGroups.push({ id: group.id, label: group.name || 'Groupe', memberIds })
      defaultAudience = `group:${group.id}`
    }
  }

  const ficheHref =
    thread.type === 'dm' && thread.client_id
      ? `/clients/${thread.client_id}`
      : thread.type === 'group' && thread.group_id
        ? `/clients/groupes/${thread.group_id}`
        : null

  return {
    ok: true,
    threadId,
    title,
    type: thread.type === 'group' ? 'group' : 'dm',
    clientId: thread.client_id,
    groupId: thread.group_id,
    groupName,
    groupDescription,
    groupEditable,
    clientPhone,
    readOnly,
    messages,
    mediaUrls,
    senderNames,
    peerLastReadAt,
    archived: threadState.archived,
    mentionCandidates,
    groupMembers:
      thread.type === 'group'
        ? rdvClients.map((c) => ({ clientId: c.id, label: c.label }))
        : [],
    // Liste complète fournie par le workspace boot (évite un 2e SELECT lourds)
    allClients: [],
    rdvClients,
    rdvGroups,
    defaultAudience,
    nameMapEntries: Array.from(nameMap.entries()),
    ficheHref,
    currentUserId: userId,
  }
}
