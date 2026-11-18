import { redirect } from 'next/navigation'

import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { CoachCalendarShell } from '../../components/coach/calendar/CoachCalendarShell'
import type { ClientOpt, CoachCalEvent, GroupOpt } from '../../components/coach/calendar/calendarUi'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { listCoachEvents, type CalendarEventRow } from '../../lib/calendar/rdv'
import { clientDisplayName } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        rdv?: string
        created?: string
        accepted?: string
        refused?: string
        queue?: string
      }>
    | {
        error?: string
        rdv?: string
        created?: string
        accepted?: string
        refused?: string
        queue?: string
      }
}

export default async function CoachCalendarPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let events: CalendarEventRow[] = []
  let loadError: string | null = null
  try {
    events = await listCoachEvents(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur chargement'
  }

  // Marquer les notifs refus comme lues à l’arrivée calendrier
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'rdv_refused')
    .is('read_at', null)

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })
    .limit(200)

  const names = new Map<string, string>()
  const clientOpts: ClientOpt[] = []
  for (const c of clients ?? []) {
    const label = clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    })
    names.set(c.id, label)
    clientOpts.push({ id: c.id, label })
  }

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, name, client_group_members(client_id)')
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .order('name', { ascending: true })
    .limit(100)

  const groupOpts: GroupOpt[] = (groups ?? []).map((g) => {
    const members = Array.isArray(g.client_group_members)
      ? g.client_group_members
      : g.client_group_members
        ? [g.client_group_members]
        : []
    return {
      id: g.id,
      label: g.name || 'Groupe',
      memberIds: members.map((m: { client_id: string }) => m.client_id).filter(Boolean),
    }
  })

  const groupNames = new Map(groupOpts.map((g) => [g.id, g.label]))
  const withNames: CoachCalEvent[] = events.map((ev) => ({
    ...ev,
    clientName: names.get(ev.client_id) ?? 'Client',
    groupName: ev.group_id ? groupNames.get(ev.group_id) : undefined,
  }))

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name')
    .eq('coach_id', user.id)
    .order('name', { ascending: true })
    .limit(100)

  const prestaOpts = (prestations ?? []).map((p) => ({
    id: p.id,
    label: p.name || 'Prestation',
  }))

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Calendrier"
      savUnread={shell.savUnread} chatUnread={shell.chatUnread}
      notifUnread={shell.notifUnread}
      notifHref={shell.notifHref}
      notifUnread={shell.notifUnread}
    >
      <CoachCalendarShell
        events={withNames}
        clients={clientOpts}
        groups={groupOpts}
        prestations={prestaOpts}
        nameMap={names}
        openQueueOnMount={q.queue === '1'}
        flash={{
          error: q.error,
          rdvCreated: Boolean(q.rdv) || Boolean(q.created),
          accepted: Boolean(q.accepted),
          refused: Boolean(q.refused),
          loadError,
        }}
      />
    </CoachAppShell>
  )
}
