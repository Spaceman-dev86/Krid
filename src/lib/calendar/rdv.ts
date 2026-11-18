import { chatDb, ensureDmThreadId, sendChatMessage } from '../chat/chat'
import { zonedWallTimeToUtc } from '../dates/zonedTime'

export type RdvStatus = 'requested' | 'pending' | 'accepted' | 'refused' | 'cancelled'
export type RdvModality = 'physique' | 'visio'

export type CalendarEventRow = {
  id: string
  coach_id: string
  client_id: string
  title: string
  starts_at: string | null
  ends_at: string | null
  modality: RdvModality | null
  location: string | null
  status: RdvStatus
  notes: string | null
  client_message: string | null
  created_by: 'coach' | 'client'
  responded_at: string | null
  created_at: string
  group_id?: string | null
  batch_id?: string | null
}

/** Créneau terminé (fin passée, ou début passé si pas de fin). */
export function isRdvPast(ev: Pick<CalendarEventRow, 'starts_at' | 'ends_at'>, now = Date.now()): boolean {
  const endMs = ev.ends_at ? new Date(ev.ends_at).getTime() : NaN
  if (!Number.isNaN(endMs)) return endMs < now
  if (!ev.starts_at) return false
  const startMs = new Date(ev.starts_at).getTime()
  return !Number.isNaN(startMs) && startMs < now
}

/** Demandes client encore actionnables (requested + créneau non passé). */
export function isActionableRequest(
  ev: Pick<CalendarEventRow, 'status' | 'starts_at' | 'ends_at'>,
  now = Date.now(),
): boolean {
  return ev.status === 'requested' && !isRdvPast(ev, now)
}

/** KPI Accueil « Planning du jour » : pas de refus ni annulés. */
export function isHomeKpiRdv(ev: Pick<CalendarEventRow, 'status'>): boolean {
  return ev.status === 'accepted' || ev.status === 'pending' || ev.status === 'requested'
}

/** Chevauchement actif (hors cancelled / refused / passés) pour le coach. */
export function findCoachConflicts(
  events: CalendarEventRow[],
  startsAtIso: string,
  endsAtIso: string,
  excludeEventId?: string | null,
): CalendarEventRow[] {
  const start = new Date(startsAtIso).getTime()
  const end = new Date(endsAtIso).getTime()
  const now = Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return []
  return events.filter((ev) => {
    if (excludeEventId && ev.id === excludeEventId) return false
    if (!ev.starts_at || !ev.ends_at) return false
    if (ev.status === 'cancelled' || ev.status === 'refused') return false
    if (isRdvPast(ev, now)) return false
    const a = new Date(ev.starts_at).getTime()
    const b = new Date(ev.ends_at).getTime()
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    return a < end && b > start
  })
}

export const RDV_STATUS_LABELS: Record<RdvStatus, string> = {
  requested: 'En attente coach',
  pending: 'En attente client',
  accepted: 'Confirmé',
  refused: 'Refusé',
  cancelled: 'Annulé',
}

export const RDV_MODALITY_LABELS: Record<RdvModality, string> = {
  physique: 'Physique',
  visio: 'Visio',
}

/** Parse date YYYY-MM-DD + time HH:MM as local wall-clock → ISO. */
export function parseLocalDateTime(date: string, time: string): string | null {
  const d = date.trim()
  const t = time.trim() || '09:00'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  if (!/^\d{2}:\d{2}$/.test(t)) return null
  const [y, mo, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  if (!y || !mo || !day || Number.isNaN(hh) || Number.isNaN(mm)) return null
  return zonedWallTimeToUtc(y, mo, day, hh, mm)?.toISOString() ?? null
}

export function durationMinutes(startsAt: string | null, endsAt: string | null): number | null {
  if (!startsAt || !endsAt) return null
  const a = new Date(startsAt).getTime()
  const b = new Date(endsAt).getTime()
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null
  return Math.round((b - a) / 60000)
}

export function formatRdvWhen(startsAt: string | null | undefined): string {
  if (!startsAt) return 'Créneau à définir'
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return 'Créneau à définir'
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Heure locale HH:MM pour pastilles calendrier. */
export function formatRdvTime(startsAt: string | null | undefined): string {
  if (!startsAt) return '—'
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Texte prêt à coller dans le composer chat (relance RDV). */
export function rdvReminderDraft(
  title: string,
  startsAt: string | null | undefined,
  calendrierUrl?: string | null,
): string {
  const when = formatRdvWhen(startsAt)
  const lines = [
    `Rappel RDV « ${title} » · ${when}`,
    'Peux-tu confirmer ou refuser ce créneau ?',
  ]
  if (calendrierUrl) lines.push(`→ ${calendrierUrl}`)
  return lines.join('\n')
}

/** Lien portail client vers l’écran Accepter / Refuser. */
export function clientCalendrierPath(slug: string): string {
  return `/c/${slug}/calendrier`
}

export function formatRdvDuration(mins: number | null | undefined): string {
  if (mins == null || mins <= 0) return ''
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m}` : `${h} h`
}

/** Local YYYY-MM-DD from timestamptz (prefers explicit offset-aware local day). */
export function rdvDateIso(startsAt: string | null | undefined): string | null {
  if (!startsAt) return null
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) {
    // Fallback: raw prefix if already date-like
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(startsAt)
    return m ? m[1] : null
  }
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

const EVENT_SELECT_BASE =
  'id, coach_id, client_id, title, starts_at, ends_at, modality, location, status, notes, client_message, created_by, responded_at, created_at'
const EVENT_SELECT_GROUP = `${EVENT_SELECT_BASE}, group_id, batch_id`

export async function listCoachEvents(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const withGroup = await db
    .from('calendar_events')
    .select(EVENT_SELECT_GROUP)
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (!withGroup.error) return (withGroup.data ?? []) as CalendarEventRow[]

  const { data, error } = await db
    .from('calendar_events')
    .select(EVENT_SELECT_BASE)
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CalendarEventRow[]
}

export async function listClientEvents(supabase: unknown, clientId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('calendar_events')
    .select(
      'id, coach_id, client_id, title, starts_at, ends_at, modality, location, status, notes, client_message, created_by, responded_at, created_at'
    )
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('starts_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as CalendarEventRow[]
}

/** Chat 1:1 + tag prise_de_rdv (best-effort). */
export async function notifyCoachRdvRequest(
  supabase: unknown,
  clientId: string,
  clientUserId: string,
  summary: string
) {
  try {
    const threadId = await ensureDmThreadId(supabase, clientId)
    const body = `📅 Demande de RDV\n${summary.trim() || 'Le client propose un rendez-vous.'}`
    await sendChatMessage(supabase, threadId, clientUserId, body, 'prise_de_rdv')
    return threadId
  } catch {
    return null
  }
}

/** Coach propose un RDV → trace visible dans le fil (best-effort). */
export async function notifyCoachProposedRdv(
  supabase: unknown,
  opts: {
    coachUserId: string
    clientIds: string[]
    title: string
    startsAt: string
    modality?: string | null
    location?: string | null
    /** Si proposé depuis un fil groupe, poster aussi / à la place sur ce thread. */
    preferThreadId?: string | null
  }
): Promise<void> {
  const when = formatRdvWhen(opts.startsAt)
  const modalityLabel =
    opts.modality === 'visio' ? 'Visio' : opts.modality === 'physique' ? 'Présentiel' : null
  const lines = [`📅 RDV proposé : ${opts.title}`, when]
  if (modalityLabel) lines.push(modalityLabel)
  if (opts.location?.trim()) lines.push(opts.location.trim())
  const body = lines.join('\n')

  try {
    if (opts.preferThreadId) {
      await sendChatMessage(supabase, opts.preferThreadId, opts.coachUserId, body, 'prise_de_rdv')
      return
    }
    for (const clientId of opts.clientIds) {
      try {
        const threadId = await ensureDmThreadId(supabase, clientId)
        await sendChatMessage(supabase, threadId, opts.coachUserId, body, 'prise_de_rdv')
      } catch {
        // best-effort per client
      }
    }
  } catch {
    // ignore
  }
}
