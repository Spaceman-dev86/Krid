import { chatDb, ensureDmThreadId, sendChatMessage } from '../chat/chat'

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
  const local = new Date(y, mo - 1, day, hh, mm, 0, 0)
  if (Number.isNaN(local.getTime())) return null
  // Guard against JS date overflow (e.g. 2026-02-31)
  if (
    local.getFullYear() !== y ||
    local.getMonth() !== mo - 1 ||
    local.getDate() !== day
  ) {
    return null
  }
  return local.toISOString()
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

export async function listCoachEvents(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('calendar_events')
    .select(
      'id, coach_id, client_id, title, starts_at, ends_at, modality, location, status, notes, client_message, created_by, responded_at, created_at'
    )
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
