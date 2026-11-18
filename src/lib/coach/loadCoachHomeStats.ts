import type { SupabaseClient } from '@supabase/supabase-js'

import { isHomeKpiRdv, listCoachEvents, rdvDateIso } from '@/src/lib/calendar/rdv'
import { clientDisplayName } from '@/src/lib/chat/chat'
import { toIsoDate } from '@/src/lib/client-portal/weekCalendar'
import { isSchemaCacheError } from '@/src/lib/supabase/errors'

export type DashboardRdvItem = {
  id: string
  title: string
  startsAt: string
  timeLabel: string
  clientLabel: string
}

export type DashboardPrestaSlice = {
  id: string
  name: string
  count: number
}

export type DashboardWeekDay = {
  iso: string
  label: string
  count: number
}

export type CoachHomeStats = {
  sessionsYesterday: number
  clientsActive: number
  clientsNewMonth: number
  leadsMonth: number
  rdvTodayCount: number
  rdvToday: DashboardRdvItem[]
  bilansUnread: number
  programsEncours: number
  programsPaused: number
  prestaSlices: DashboardPrestaSlice[]
  weekActivity: DashboardWeekDay[]
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function dayLabelFr(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'narrow' })
}

function timeLabelFr(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function finishedDayIso(row: { finished_at: string | null; actual_date: string | null }) {
  if (row.finished_at) {
    const d = new Date(row.finished_at)
    if (!Number.isNaN(d.getTime())) return toIsoDate(d)
  }
  if (row.actual_date && /^\d{4}-\d{2}-\d{2}/.test(row.actual_date)) {
    return row.actual_date.slice(0, 10)
  }
  return null
}

/** Agrégats Accueil coach — counts/sums, pas de hubs complets. */
export async function loadCoachHomeStats(
  supabase: SupabaseClient,
  coachId: string,
): Promise<CoachHomeStats> {
  const now = new Date()
  const todayStart = startOfLocalDay(now)
  const yesterdayStart = addDays(todayStart, -1)
  const weekStart = addDays(todayStart, -6)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayIso = toIsoDate(todayStart)
  const yesterdayIso = toIsoDate(yesterdayStart)
  const weekStartIso = toIsoDate(weekStart)
  const monthStartIso = monthStart.toISOString()

  const emptyWeek = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i)
    return { iso: toIsoDate(d), label: dayLabelFr(d), count: 0 }
  })

  const [
    clientsRes,
    grantsRes,
    runsRes,
    leadsRes,
    bilansRes,
    plansWaiting,
    plansStarted,
    plansPaused,
    events,
    prestationsRes,
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, status, created_at, first_name, last_name, email')
      .eq('coach_id', coachId)
      .is('deleted_at', null),
    supabase
      .from('client_grants')
      .select('client_id, prestation_id')
      .eq('coach_id', coachId)
      .eq('status', 'active'),
    supabase
      .from('session_runs')
      .select('id, finished_at, actual_date')
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .not('finished_at', 'is', null)
      .in('style', ['fait', 'fait_edite', 'libre'])
      .gte('finished_at', weekStart.toISOString()),
    supabase
      .from('coach_tracked_leads')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .gte('created_at', monthStartIso),
    supabase
      .from('bilan_instances')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'submitted')
      .is('coach_read_at', null),
    supabase
      .from('client_fitness_plans')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'waiting'),
    supabase
      .from('client_fitness_plans')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'started'),
    supabase
      .from('client_fitness_plans')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', coachId)
      .eq('status', 'paused'),
    listCoachEvents(supabase, coachId).catch(() => []),
    supabase
      .from('prestations')
      .select('id, name')
      .eq('coach_id', coachId)
      .is('deleted_at', null),
  ])

  // Schema cache / table introuvable côté PostgREST → stats vides, pas d’erreur UI
  if (clientsRes.error && !isSchemaCacheError(clientsRes.error.message) && process.env.NODE_ENV !== 'production') {
    console.warn('[loadCoachHomeStats] clients', clientsRes.error.message)
  }
  const clients = clientsRes.error ? [] : (clientsRes.data ?? [])
  const grantRows = grantsRes.error ? [] : (grantsRes.data ?? [])
  const grantClientIds = new Set(grantRows.map((g) => g.client_id))
  const statusActiveIds = new Set(
    clients.filter((c) => c.status === 'active' || c.status === 'invited').map((c) => c.id),
  )
  const clientsActive =
    grantClientIds.size > 0 ? grantClientIds.size : statusActiveIds.size

  const clientsNewMonth = clients.filter((c) => Boolean(c.created_at && c.created_at >= monthStartIso))
    .length

  const weekCounts = new Map<string, number>()
  for (const day of emptyWeek) weekCounts.set(day.iso, 0)

  let sessionsYesterday = 0
  for (const run of runsRes.data ?? []) {
    const day = finishedDayIso(run)
    if (!day) continue
    if (day >= weekStartIso && day <= todayIso) {
      weekCounts.set(day, (weekCounts.get(day) ?? 0) + 1)
    }
    if (day === yesterdayIso) sessionsYesterday += 1
  }

  const weekActivity = emptyWeek.map((d) => ({
    ...d,
    count: weekCounts.get(d.iso) ?? 0,
  }))

  const prestaName = new Map((prestationsRes.data ?? []).map((p) => [p.id, p.name]))
  const prestaCounts = new Map<string, number>()
  for (const g of grantRows) {
    if (!g.prestation_id) continue
    prestaCounts.set(g.prestation_id, (prestaCounts.get(g.prestation_id) ?? 0) + 1)
  }
  const sorted = [...prestaCounts.entries()].sort((a, b) => b[1] - a[1])
  const TOP = 5
  const top = sorted.slice(0, TOP)
  const rest = sorted.slice(TOP)
  const prestaSlices: DashboardPrestaSlice[] = top.map(([id, count]) => ({
    id,
    name: prestaName.get(id) ?? 'Prestation',
    count,
  }))
  const otherCount = rest.reduce((s, [, n]) => s + n, 0)
  if (otherCount > 0) {
    prestaSlices.push({ id: '__other__', name: 'Autres', count: otherCount })
  }

  const clientById = new Map(
    clients.map((c) => [
      c.id,
      clientDisplayName({
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
      }),
    ]),
  )

  const todayEvents = (events ?? [])
    .filter((e) => isHomeKpiRdv(e) && rdvDateIso(e.starts_at) === todayIso)
    .sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : 0
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : 0
      return ta - tb
    })

  const rdvToday: DashboardRdvItem[] = todayEvents.slice(0, 3).map((e) => ({
    id: e.id,
    title: e.title || 'RDV',
    startsAt: e.starts_at ?? '',
    timeLabel: e.starts_at ? timeLabelFr(e.starts_at) : '—',
    clientLabel: clientById.get(e.client_id) ?? 'Client',
  }))

  return {
    sessionsYesterday,
    clientsActive,
    clientsNewMonth,
    leadsMonth: leadsRes.count ?? 0,
    rdvTodayCount: todayEvents.length,
    rdvToday,
    bilansUnread: bilansRes.count ?? 0,
    programsEncours: (plansWaiting.count ?? 0) + (plansStarted.count ?? 0),
    programsPaused: plansPaused.count ?? 0,
    prestaSlices,
    weekActivity,
  }
}
