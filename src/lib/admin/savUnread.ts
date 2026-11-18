import type { SupabaseClient } from '@supabase/supabase-js'

type Untyped = SupabaseClient<any>

type TicketRead = {
  id: string
  admin_last_read_at?: string | null
  coach_last_read_at?: string | null
}

/** Dernier message par ticket (1 requête) — évite le N+1 qui freinait chaque nav shell. */
async function latestMessageAtByTicket(
  supabase: Untyped,
  ticketIds: string[],
  senderRole: 'coach' | 'admin',
): Promise<Map<string, number>> {
  const latest = new Map<string, number>()
  if (!ticketIds.length) return latest

  const { data: msgs } = await supabase
    .from('support_messages')
    .select('ticket_id, created_at')
    .in('ticket_id', ticketIds)
    .eq('sender_role', senderRole)
    .order('created_at', { ascending: false })
    .limit(Math.min(500, ticketIds.length * 3))

  for (const m of msgs ?? []) {
    if (!m.ticket_id || latest.has(m.ticket_id)) continue
    latest.set(m.ticket_id, new Date(m.created_at).getTime())
  }
  return latest
}

function isUnread(readAt: string | null | undefined, lastMsgAt: number | undefined, neverReadCounts: boolean) {
  if (!readAt) return neverReadCounts
  if (lastMsgAt == null) return false
  return lastMsgAt > new Date(readAt).getTime()
}

/** Tickets où le coach a un message admin plus récent que sa dernière lecture (ou jamais lu). */
export async function countCoachUnreadSav(supabase: Untyped, coachId: string): Promise<number> {
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, coach_last_read_at, status')
    .eq('coach_id', coachId)
    .neq('status', 'resolu')
    .limit(100)

  if (!tickets?.length) return 0

  const latestAdmin = await latestMessageAtByTicket(
    supabase,
    tickets.map((t: TicketRead) => t.id),
    'admin',
  )

  let unread = 0
  for (const t of tickets as TicketRead[]) {
    if (isUnread(t.coach_last_read_at, latestAdmin.get(t.id), false)) unread += 1
  }
  return unread
}

export async function countAdminUnreadSav(supabase: Untyped): Promise<number> {
  const ids = await listAdminUnreadTicketIds(supabase)
  return ids.size
}

/** IDs tickets à badge « non lu » côté admin (inbox). */
export async function listAdminUnreadTicketIds(supabase: Untyped): Promise<Set<string>> {
  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, admin_last_read_at, status')
    .in('status', ['nouveau', 'en_cours'])
    .limit(100)

  const unread = new Set<string>()
  if (!tickets?.length) return unread

  const rows = tickets as TicketRead[]
  const needCheck: TicketRead[] = []
  for (const t of rows) {
    if (!t.admin_last_read_at) unread.add(t.id)
    else needCheck.push(t)
  }

  if (!needCheck.length) return unread

  const latestCoach = await latestMessageAtByTicket(
    supabase,
    needCheck.map((t) => t.id),
    'coach',
  )

  for (const t of needCheck) {
    if (isUnread(t.admin_last_read_at, latestCoach.get(t.id), false)) unread.add(t.id)
  }
  return unread
}
