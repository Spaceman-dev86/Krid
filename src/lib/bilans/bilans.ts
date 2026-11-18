import { chatDb } from '../chat/chat'

export type BilanMeasurementField = { id: string; label: string; unit: string }
export type BilanQuestionField = { id: string; label: string; type: 'text' | 'textarea' }

export type BilanSchema = {
  photos: boolean
  measurements: BilanMeasurementField[]
  questions: BilanQuestionField[]
}

export type BilanPayload = {
  measurements?: Record<string, string>
  questions?: Record<string, string>
  photos?: { path: string; label?: string }[]
}

export type BilanTemplateRow = {
  id: string
  coach_id: string
  title: string
  instructions: string | null
  schema: BilanSchema
  status: 'draft' | 'ready'
  created_at: string
  deleted_at: string | null
}

export type BilanInstanceRow = {
  id: string
  coach_id: string
  client_id: string
  template_id: string | null
  title: string
  schema_snapshot: BilanSchema
  payload: BilanPayload
  status: 'waiting' | 'in_progress' | 'submitted' | 'no_response'
  appears_at: string
  due_at: string
  submitted_at: string | null
  client_opened_at: string | null
  coach_read_at: string | null
  created_at: string
  /** UUID partagé par un même envoi (surtout groupe). */
  batch_id?: string | null
  /** Groupe d’origine si expansion depuis un groupe. */
  source_group_id?: string | null
}

const INSTANCE_SELECT_BASE =
  'id, coach_id, client_id, template_id, title, schema_snapshot, payload, status, appears_at, due_at, submitted_at, client_opened_at, coach_read_at, created_at'

const INSTANCE_SELECT_WITH_BATCH = `${INSTANCE_SELECT_BASE}, batch_id, source_group_id`

export const PRESET_MEASUREMENTS: BilanMeasurementField[] = [
  { id: 'weight_kg', label: 'Poids', unit: 'kg' },
  { id: 'height_cm', label: 'Taille', unit: 'cm' },
  { id: 'waist_cm', label: 'Tour de taille', unit: 'cm' },
  { id: 'hips_cm', label: 'Tour de hanches', unit: 'cm' },
  { id: 'arms_cm', label: 'Tour de bras', unit: 'cm' },
  { id: 'thighs_cm', label: 'Tour de cuisse', unit: 'cm' },
  { id: 'body_fat', label: '% masse grasse', unit: '%' },
]

export function emptySchema(): BilanSchema {
  return { photos: false, measurements: [], questions: [] }
}

export function parseSchema(raw: unknown): BilanSchema {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<BilanSchema>
  return {
    photos: Boolean(s.photos),
    measurements: Array.isArray(s.measurements) ? s.measurements : [],
    questions: Array.isArray(s.questions) ? s.questions : [],
  }
}

export function parsePayload(raw: unknown): BilanPayload {
  const p = (raw && typeof raw === 'object' ? raw : {}) as BilanPayload
  return {
    measurements: p.measurements && typeof p.measurements === 'object' ? p.measurements : {},
    questions: p.questions && typeof p.questions === 'object' ? p.questions : {},
    photos: Array.isArray(p.photos) ? p.photos : [],
  }
}

export function effectiveStatus(
  status: BilanInstanceRow['status'],
  dueAt: string
): BilanInstanceRow['status'] {
  if (status === 'submitted' || status === 'no_response') return status
  if (new Date(dueAt).getTime() < Date.now()) return 'no_response'
  return status
}

export function statusLabel(status: BilanInstanceRow['status']): string {
  switch (status) {
    case 'waiting':
      return 'En attente'
    case 'in_progress':
      return 'En cours'
    case 'submitted':
      return 'Rempli'
    case 'no_response':
      return 'Sans réponse'
    default:
      return status
  }
}

export function isClientEditable(status: BilanInstanceRow['status'], dueAt: string): boolean {
  const s = effectiveStatus(status, dueAt)
  return s === 'waiting' || s === 'in_progress'
}

export async function listTemplates(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('bilan_templates')
    .select('id, coach_id, title, instructions, schema, status, created_at, deleted_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as BilanTemplateRow[]).map((t) => ({
    ...t,
    schema: parseSchema(t.schema),
  }))
}

export async function getTemplate(supabase: unknown, id: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('bilan_templates')
    .select('id, coach_id, title, instructions, schema, status, created_at, deleted_at')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { ...(data as BilanTemplateRow), schema: parseSchema(data.schema) }
}

async function selectInstances(
  supabase: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: (q: any) => PromiseLike<{ data: unknown; error: { message: string } | null }>
) {
  const db = chatDb(supabase)
  const withBatch = await apply(db.from('bilan_instances').select(INSTANCE_SELECT_WITH_BATCH))
  if (!withBatch.error) {
    return ((withBatch.data ?? []) as BilanInstanceRow[]).map(normalizeInstance)
  }
  if (!/batch_id|source_group/i.test(withBatch.error.message)) {
    throw new Error(withBatch.error.message)
  }
  const fallback = await apply(db.from('bilan_instances').select(INSTANCE_SELECT_BASE))
  if (fallback.error) throw new Error(fallback.error.message)
  return ((fallback.data ?? []) as BilanInstanceRow[]).map(normalizeInstance)
}

export async function listInstancesForCoach(supabase: unknown, coachId: string) {
  return selectInstances(supabase, (q) =>
    q.eq('coach_id', coachId).order('created_at', { ascending: false })
  )
}

/** Instances d’un client (vue coach — pas de filtre appears_at). */
export async function listInstancesForCoachClient(
  supabase: unknown,
  coachId: string,
  clientId: string,
) {
  return selectInstances(supabase, (q) =>
    q
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false }),
  )
}

/** Instances issues d’un envoi groupe (source_group_id). */
export async function listInstancesForCoachGroup(
  supabase: unknown,
  coachId: string,
  groupId: string,
) {
  return selectInstances(supabase, (q) =>
    q
      .eq('coach_id', coachId)
      .eq('source_group_id', groupId)
      .order('created_at', { ascending: false }),
  )
}

export async function listInstancesForClient(supabase: unknown, clientId: string) {
  return selectInstances(supabase, (q) =>
    q
      .eq('client_id', clientId)
      .lte('appears_at', new Date().toISOString())
      .order('appears_at', { ascending: false })
  )
}

export async function listInstancesForBatch(supabase: unknown, coachId: string, batchId: string) {
  return selectInstances(supabase, (q) =>
    q.eq('coach_id', coachId).eq('batch_id', batchId).order('created_at', { ascending: false })
  )
}

export async function getInstance(supabase: unknown, id: string) {
  const db = chatDb(supabase)
  let { data, error } = await db
    .from('bilan_instances')
    .select(INSTANCE_SELECT_WITH_BATCH)
    .eq('id', id)
    .maybeSingle()
  if (error && /batch_id|source_group/i.test(error.message)) {
    ;({ data, error } = await db
      .from('bilan_instances')
      .select(INSTANCE_SELECT_BASE)
      .eq('id', id)
      .maybeSingle())
  }
  if (error) throw new Error(error.message)
  if (!data) return null
  return normalizeInstance(data as BilanInstanceRow)
}

/** Bilans du même client, plus récents d’abord (nav détail). */
export async function listSiblingInstancesForClient(
  supabase: unknown,
  coachId: string,
  clientId: string
) {
  return selectInstances(supabase, (q) =>
    q
      .eq('coach_id', coachId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
  )
}

function normalizeInstance(row: BilanInstanceRow): BilanInstanceRow {
  return {
    ...row,
    schema_snapshot: parseSchema(row.schema_snapshot),
    payload: parsePayload(row.payload),
    status: effectiveStatus(row.status, row.due_at),
    batch_id: row.batch_id ?? null,
    source_group_id: row.source_group_id ?? null,
  }
}

/** Remplace previousInstanceForClient — voisins prev/next dans la timeline client. */
export function siblingNav(
  siblings: BilanInstanceRow[],
  currentId: string
): { prevId: string | null; nextId: string | null } {
  const idx = siblings.findIndex((s) => s.id === currentId)
  if (idx < 0) return { prevId: null, nextId: null }
  // liste triée created_at desc → next = plus ancien (idx+1), prev = plus récent (idx-1)
  return {
    prevId: idx > 0 ? siblings[idx - 1].id : null,
    nextId: idx < siblings.length - 1 ? siblings[idx + 1].id : null,
  }
}

export async function countUnopenedForClient(supabase: unknown, clientId: string) {
  const rows = await listInstancesForClient(supabase, clientId)
  return rows.filter((r) => !r.client_opened_at && isClientEditable(r.status, r.due_at)).length
}

export async function previousInstanceForClient(
  supabase: unknown,
  clientId: string,
  beforeCreatedAt: string,
  excludeId: string
) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('bilan_instances')
    .select('id')
    .eq('client_id', clientId)
    .neq('id', excludeId)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.id as string | undefined) ?? null
}
