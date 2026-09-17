import type { SupabaseClient } from '@supabase/supabase-js'

type Untyped = SupabaseClient<any>

async function ticketHasAdminUnread(
  supabase: Untyped,
  ticket: { id: string; admin_last_read_at: string | null },
): Promise<boolean> {
  const { data: lastCoach } = await supabase
    .from('support_messages')
    .select('created_at')
    .eq('ticket_id', ticket.id)
    .eq('sender_role', 'coach')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ticket.admin_last_read_at) return true
  const readAt = new Date(ticket.admin_last_read_at).getTime()
  if (lastCoach?.created_at && new Date(lastCoach.created_at).getTime() > readAt) return true
  return false
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

  let unread = 0
  for (const t of tickets) {
    const { data: lastAdmin } = await supabase
      .from('support_messages')
      .select('created_at')
      .eq('ticket_id', t.id)
      .eq('sender_role', 'admin')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastAdmin?.created_at) continue
    const readAt = t.coach_last_read_at ? new Date(t.coach_last_read_at).getTime() : 0
    if (new Date(lastAdmin.created_at).getTime() > readAt) unread += 1
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

  for (const t of tickets) {
    if (await ticketHasAdminUnread(supabase, t)) unread.add(t.id)
  }
  return unread
}
