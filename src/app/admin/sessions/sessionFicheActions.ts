'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import {
  DEFAULT_SESSION_REST_SECONDS,
  normalizeSessionCompositionSlots,
  restPrescriptionsPayload,
  restSecondsFromPrescriptions,
  sessionHasContentItem,
  type SessionPrescription,
} from '../../../lib/sessions/constants'
import { createClient } from '../../../lib/supabase/server'

type SaveIntent = 'publish' | 'draft' | 'keep'

type SessionSlotInput = {
  kind: 'block' | 'exercise' | 'rest'
  blockId?: string
  exerciseId?: string
  restSeconds?: number
  prescriptions: SessionPrescription[]
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase }
}

function revalidateSessions(id?: string) {
  revalidatePath('/admin/programs')
  revalidatePath('/admin/catalog')
  revalidatePath('/admin/sessions/new')
  if (id) revalidatePath(`/admin/sessions/${id}/edit`)
}

/** Publie les blocs brouillon liés (règle : pas de draft dans une séance publiée). */
async function publishLinkedDraftBlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  blockIds: string[],
): Promise<string | null> {
  const unique = [...new Set(blockIds.filter(Boolean))]
  if (!unique.length) return null

  const { data, error } = await supabase
    .from('block_library' as never)
    .select('id, name, status, sport_id, expected_result_unit_id, deleted_at')
    .in('id' as never, unique as never)
    .is('coach_id' as never, null)
  if (error) return error.message

  const rows = (data ?? []) as {
    id: string
    name: string
    status: string
    sport_id: string | null
    expected_result_unit_id: string | null
    deleted_at: string | null
  }[]

  const draftIds: string[] = []
  for (const id of unique) {
    const row = rows.find((r) => r.id === id)
    if (!row || row.deleted_at) return `Bloc introuvable (${id.slice(0, 8)}…)`
    if (row.status === 'published') continue
    if (!row.sport_id || !row.expected_result_unit_id) {
      return `Impossible de publier la séance : le bloc « ${row.name} » doit avoir sport + résultat attendu (et ≥1 exo).`
    }
    const { count, error: cErr } = await supabase
      .from('block_library_exercises' as never)
      .select('block_id', { count: 'exact', head: true })
      .eq('block_id' as never, id as never)
    if (cErr) return cErr.message
    if (!count) {
      return `Impossible de publier la séance : le bloc « ${row.name} » doit contenir ≥1 exercice.`
    }
    draftIds.push(id)
  }

  if (!draftIds.length) return null

  const { error: updErr } = await supabase
    .from('block_library' as never)
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    } as never)
    .in('id' as never, draftIds as never)
    .is('coach_id' as never, null)
  if (updErr) return updErr.message

  revalidatePath('/admin/exercises')
  for (const id of draftIds) revalidatePath(`/admin/blocks/${id}/edit`)
  return null
}

function parseSlots(formData: FormData): SessionSlotInput[] {
  const kinds = formData.getAll('item_kind').map((v) => String(v ?? '').trim())
  const blockIds = formData.getAll('item_block_id').map((v) => String(v ?? '').trim())
  const exerciseIds = formData.getAll('item_exercise_id').map((v) => String(v ?? '').trim())
  const rawRx = formData.getAll('item_prescriptions').map((v) => String(v ?? '').trim())
  const len = Math.max(kinds.length, blockIds.length, exerciseIds.length)
  const out: SessionSlotInput[] = []
  for (let i = 0; i < len; i++) {
    const kindRaw = kinds[i]
    const kind =
      kindRaw === 'block' || kindRaw === 'exercise' || kindRaw === 'rest' ? kindRaw : null
    if (!kind) continue
    let prescriptions: SessionPrescription[] = []
    let parsedRaw: unknown = []
    try {
      parsedRaw = JSON.parse(rawRx[i] || '[]')
      if (Array.isArray(parsedRaw)) {
        prescriptions = (parsedRaw as SessionPrescription[]).filter((p) => p && p.unit_id)
      }
    } catch {
      prescriptions = []
      parsedRaw = []
    }
    if (kind === 'block') {
      const blockId = blockIds[i]
      if (!blockId) continue
      out.push({ kind, blockId, prescriptions: [] })
    } else if (kind === 'rest') {
      out.push({
        kind: 'rest',
        restSeconds: restSecondsFromPrescriptions(parsedRaw),
        prescriptions: [],
      })
    } else {
      const exerciseId = exerciseIds[i]
      if (!exerciseId) continue
      out.push({ kind, exerciseId, prescriptions })
    }
  }
  return out
}

function readSessionFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    notes: String(formData.get('notes') ?? '').trim(),
    allowDuplicate: formData.get('allow_duplicate') === 'on',
    objectiveRessenti: formData.get('objective_ressenti') === 'on',
    objectiveNote: formData.get('objective_note') === 'on',
    objectiveDifficulty: formData.get('objective_difficulty') === 'on',
    slots: parseSlots(formData),
    hiddenTypeIds: formData.getAll('hidden_type_ids').map((v) => String(v ?? '').trim()).filter(Boolean),
    hiddenSportIds: formData.getAll('hidden_sport_ids').map((v) => String(v ?? '').trim()).filter(Boolean),
  }
}

async function assertSlotTargets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slots: SessionSlotInput[],
  opts: { allowDraftBlocks: boolean; allowSoftDeletedBlocks?: boolean },
) {
  const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!).filter(Boolean)
  const exerciseIds = slots.filter((s) => s.kind === 'exercise').map((s) => s.exerciseId!).filter(Boolean)

  if (blockIds.length) {
    const { data, error } = await supabase
      .from('block_library' as never)
      .select('id, status, deleted_at')
      .in('id' as never, blockIds as never)
    if (error) return error.message
    const rows = (data ?? []) as { id: string; status?: string | null; deleted_at?: string | null }[]
    const ok = new Set(
      rows
        .filter((r) => {
          if (r.deleted_at) return Boolean(opts.allowSoftDeletedBlocks)
          if (opts.allowDraftBlocks) return true
          return !r.status || r.status === 'published'
        })
        .map((r) => r.id),
    )
    if (blockIds.some((id) => !ok.has(id))) {
      return opts.allowDraftBlocks
        ? 'Bloc introuvable'
        : 'Seuls les blocs publiés peuvent être ajoutés depuis le picker'
    }
  }

  if (exerciseIds.length) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id, status, deleted_at')
      .in('id', exerciseIds)
    if (error) return error.message
    const rows = (data ?? []) as { id: string; status?: string | null; deleted_at?: string | null }[]
    const ok = new Set(
      rows
        .filter((r) => !r.deleted_at && (!r.status || r.status === 'published'))
        .map((r) => r.id),
    )
    if (exerciseIds.some((id) => !ok.has(id))) {
      return 'Chaque exercice doit être publié (non corbeille)'
    }
  }

  return null
}

async function syncSessionItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  slots: SessionSlotInput[],
) {
  const db = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
  const { error: delErr } = await db.from('session_library_items').delete().eq('session_id', sessionId)
  if (delErr) return delErr.message
  if (!slots.length) return null
  const rows = slots.map((s, position) => ({
    session_id: sessionId,
    position,
    item_kind: s.kind,
    block_id: s.kind === 'block' ? s.blockId : null,
    exercise_id: s.kind === 'exercise' ? s.exerciseId : null,
    prescriptions:
      s.kind === 'exercise'
        ? s.prescriptions
        : s.kind === 'rest'
          ? restPrescriptionsPayload(s.restSeconds ?? DEFAULT_SESSION_REST_SECONDS)
          : [],
  }))
  const { error: insErr } = await db.from('session_library_items').insert(rows)
  return insErr?.message ?? null
}

async function syncHidden(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  typeIds: string[],
  sportIds: string[],
) {
  const db = supabase as unknown as {
    from: (t: string) => {
      delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> }
      insert: (rows: unknown) => Promise<{ error: { message: string } | null }>
    }
  }
  {
    const { error } = await db.from('session_library_hidden_types').delete().eq('session_id', sessionId)
    if (error) return error.message
    const unique = [...new Set(typeIds)]
    if (unique.length) {
      const { error: ins } = await db.from('session_library_hidden_types').insert(
        unique.map((exercise_type_id) => ({ session_id: sessionId, exercise_type_id })),
      )
      if (ins) return ins.message
    }
  }
  {
    const { error } = await db.from('session_library_hidden_sports').delete().eq('session_id', sessionId)
    if (error) return error.message
    const unique = [...new Set(sportIds)]
    if (unique.length) {
      const { error: ins } = await db.from('session_library_hidden_sports').insert(
        unique.map((sport_id) => ({ session_id: sessionId, sport_id })),
      )
      if (ins) return ins.message
    }
  }
  return null
}

export async function createTrainlySessionPublishedAction(formData: FormData) {
  return createTrainlySessionCore('publish', formData)
}

export async function createTrainlySessionDraftAction(formData: FormData) {
  return createTrainlySessionCore('draft', formData)
}

async function createTrainlySessionCore(intent: SaveIntent, formData: FormData) {
  const { supabase } = await requireAdmin()
  const f = readSessionFields(formData)
  const base = '/admin/sessions/new'
  if (!f.name) redirect(`${base}?error=${encodeURIComponent('Nom requis')}`)
  if (intent === 'publish' && !sessionHasContentItem(f.slots)) {
    redirect(`${base}?error=${encodeURIComponent('Au moins 1 bloc ou exercice requis pour publier')}`)
  }

  const slots = normalizeSessionCompositionSlots(f.slots)

  const targetErr = await assertSlotTargets(supabase, slots, {
    allowDraftBlocks: true,
    allowSoftDeletedBlocks: true,
  })
  if (targetErr) redirect(`${base}?error=${encodeURIComponent(targetErr)}`)

  if (intent === 'publish') {
    const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!)
    const pubErr = await publishLinkedDraftBlocks(supabase, blockIds)
    if (pubErr) redirect(`${base}?error=${encodeURIComponent(pubErr)}`)
  }

  const status = intent === 'publish' ? 'published' : 'draft'
  const { data: created, error } = await supabase
    .from('session_library' as never)
    .insert({
      coach_id: null,
      name: f.name,
      notes: f.notes || null,
      objective_ressenti: f.objectiveRessenti,
      objective_note: f.objectiveNote,
      objective_difficulty: f.objectiveDifficulty,
      status,
      allow_duplicate: f.allowDuplicate,
      allow_download: false,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(`${base}?error=${encodeURIComponent(error?.message ?? 'Création impossible')}`)
  }

  const id = (created as { id: string }).id
  const syncErr = await syncSessionItems(supabase, id, slots)
  if (syncErr) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(syncErr)}`)
  const hideErr = await syncHidden(supabase, id, f.hiddenTypeIds, f.hiddenSportIds)
  if (hideErr) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(hideErr)}`)

  revalidateSessions(id)
  redirect(
    intent === 'publish'
      ? `/admin/programs?kind=sessions&view=published&ok=published`
      : `/admin/programs?kind=sessions&view=draft&ok=draft`,
  )
}

export async function updateTrainlySessionAction(formData: FormData) {
  return saveTrainlySession('keep', formData)
}

export async function publishTrainlySessionAction(formData: FormData) {
  return saveTrainlySession('publish', formData)
}

export async function saveDraftTrainlySessionAction(formData: FormData) {
  return saveTrainlySession('draft', formData)
}

async function saveTrainlySession(intent: SaveIntent, formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/admin/programs?kind=sessions')

  const f = readSessionFields(formData)
  const base = `/admin/sessions/${id}/edit`
  const effective: SaveIntent =
    intent === 'keep'
      ? formData.get('current_status') === 'published'
        ? 'publish'
        : 'draft'
      : intent

  if (!f.name) redirect(`${base}?error=${encodeURIComponent('Nom requis')}`)
  const slots = normalizeSessionCompositionSlots(f.slots)
  if (effective === 'publish' && !sessionHasContentItem(slots)) {
    redirect(`${base}?error=${encodeURIComponent('Au moins 1 bloc ou exercice requis pour publier')}`)
  }

  const targetErr = await assertSlotTargets(supabase, slots, {
    allowDraftBlocks: true,
    allowSoftDeletedBlocks: true,
  })
  if (targetErr) redirect(`${base}?error=${encodeURIComponent(targetErr)}`)

  const status =
    intent === 'publish' ? 'published' : intent === 'draft' ? 'draft' : effective === 'publish' ? 'published' : 'draft'

  if (status === 'published') {
    const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!)
    const pubErr = await publishLinkedDraftBlocks(supabase, blockIds)
    if (pubErr) redirect(`${base}?error=${encodeURIComponent(pubErr)}`)
  }

  const { error } = await supabase
    .from('session_library' as never)
    .update({
      name: f.name,
      notes: f.notes || null,
      objective_ressenti: f.objectiveRessenti,
      objective_note: f.objectiveNote,
      objective_difficulty: f.objectiveDifficulty,
      status,
      allow_duplicate: f.allowDuplicate,
      allow_download: false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) redirect(`${base}?error=${encodeURIComponent(error.message)}`)

  const syncErr = await syncSessionItems(supabase, id, slots)
  if (syncErr) redirect(`${base}?error=${encodeURIComponent(syncErr)}`)
  const hideErr = await syncHidden(supabase, id, f.hiddenTypeIds, f.hiddenSportIds)
  if (hideErr) redirect(`${base}?error=${encodeURIComponent(hideErr)}`)

  revalidateSessions(id)
  redirect(
    intent === 'publish'
      ? `/admin/programs?kind=sessions&view=published&ok=published`
      : intent === 'draft'
        ? `/admin/programs?kind=sessions&view=draft&ok=draft`
        : `${base}?ok=saved`,
  )
}

export async function deleteTrainlySessionAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const returnTo =
    String(formData.get('return_to') ?? '').trim() || '/admin/programs?kind=sessions'
  if (!id) redirect('/admin/programs?kind=sessions')

  const { error } = await supabase
    .from('session_library' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) redirect(`/admin/sessions/${id}/edit?error=${encodeURIComponent(error.message)}`)

  revalidateSessions(id)
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=deleted`)
}

export async function setSessionCatalogStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || '/admin/programs?kind=sessions'
  if (!id || (status !== 'draft' && status !== 'published')) redirect(returnTo)

  if (status === 'published') {
    const { data: items } = await supabase
      .from('session_library_items' as never)
      .select('item_kind, block_id, exercise_id')
      .eq('session_id' as never, id as never)
    const list = (items ?? []) as {
      item_kind?: string
      block_id?: string | null
      exercise_id?: string | null
    }[]
    if (!list.some((r) => r.item_kind === 'block' || r.item_kind === 'exercise')) {
      redirect(
        `${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(
          'Publication : ≥1 bloc ou exercice requis',
        )}`,
      )
    }
    const blockIds = list
      .filter((r) => r.item_kind === 'block' && r.block_id)
      .map((r) => r.block_id as string)
    const pubErr = await publishLinkedDraftBlocks(supabase, blockIds)
    if (pubErr) {
      redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(pubErr)}`)
    }
  }

  const { error } = await supabase
    .from('session_library' as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (error) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=${encodeURIComponent(error.message)}`)
  }

  revalidateSessions(id)
  redirect(
    `${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=${status === 'published' ? 'published' : 'draft'}`,
  )
}
