'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { safeReturnTo } from '@/src/lib/navigation/safeReturnTo'
import {
  DEFAULT_SESSION_REST_SECONDS,
  normalizeSessionCompositionSlots,
  restPrescriptionsPayload,
  restSecondsFromPrescriptions,
  sessionHasContentItem,
  type SessionPrescription,
} from '@/src/lib/sessions/constants'
import { createClient } from '@/src/lib/supabase/server'

type SaveIntent = 'publish' | 'draft' | 'keep'

type SessionSlotInput = {
  kind: 'block' | 'exercise' | 'rest'
  blockId?: string
  exerciseId?: string
  restSeconds?: number
  prescriptions: SessionPrescription[]
}

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, userId: user.id }
}

function revalidateSessions(id?: string) {
  revalidatePath('/programs/sessions')
  revalidatePath('/programs/sessions/mine')
  revalidatePath('/programs/sessions/brouillon')
  revalidatePath('/programs/sessions/catalogue')
  revalidatePath('/programs/sessions/new')
  if (id) {
    revalidatePath(`/programs/sessions/mine/${id}`)
    revalidatePath(`/programs/sessions/brouillon/${id}`)
  }
}

function parseSlots(formData: FormData): SessionSlotInput[] {
  const rawJson = String(formData.get('slots_json') ?? '').trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown
      if (Array.isArray(parsed)) {
        const out: SessionSlotInput[] = []
        for (const s of parsed as {
          kind?: string
          blockId?: string
          exerciseId?: string
          restSeconds?: number
          prescriptions?: SessionPrescription[]
        }[]) {
          if (s.kind === 'block' && s.blockId) {
            out.push({ kind: 'block', blockId: s.blockId, prescriptions: [] })
          } else if (s.kind === 'exercise' && s.exerciseId) {
            out.push({
              kind: 'exercise',
              exerciseId: s.exerciseId,
              prescriptions: (s.prescriptions ?? []).filter((p) => p && p.unit_id),
            })
          } else if (s.kind === 'rest') {
            out.push({
              kind: 'rest',
              restSeconds: s.restSeconds ?? DEFAULT_SESSION_REST_SECONDS,
              prescriptions: [],
            })
          }
        }
        return out
      }
    } catch {
      /* fallback item_* */
    }
  }

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
  coachId: string,
  slots: SessionSlotInput[],
  opts: { allowDraftBlocks: boolean },
) {
  const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!).filter(Boolean)
  const exerciseIds = slots.filter((s) => s.kind === 'exercise').map((s) => s.exerciseId!).filter(Boolean)

  if (blockIds.length) {
    const { data, error } = await supabase
      .from('block_library' as never)
      .select('id, status, deleted_at, coach_id')
      .in('id' as never, blockIds as never)
    if (error) return error.message
    const rows = (data ?? []) as {
      id: string
      status?: string | null
      deleted_at?: string | null
      coach_id?: string | null
    }[]
    const ok = new Set(
      rows
        .filter((r) => {
          if (r.deleted_at) return false
          const owned = r.coach_id === coachId || r.coach_id == null
          if (!owned) return false
          if (opts.allowDraftBlocks && r.coach_id === coachId) return true
          return !r.status || r.status === 'published'
        })
        .map((r) => r.id),
    )
    if (blockIds.some((id) => !ok.has(id))) {
      return opts.allowDraftBlocks
        ? 'Bloc introuvable ou hors périmètre'
        : 'Seuls les blocs publiés (Krid + Ma biblio) peuvent être ajoutés'
    }
  }

  if (exerciseIds.length) {
    const { data, error } = await supabase
      .from('exercise_library')
      .select('id, status, deleted_at, coach_id')
      .in('id', exerciseIds)
    if (error) return error.message
    const rows = (data ?? []) as {
      id: string
      status?: string | null
      deleted_at?: string | null
      coach_id?: string | null
    }[]
    const ok = new Set(
      rows
        .filter(
          (r) =>
            !r.deleted_at &&
            (!r.status || r.status === 'published') &&
            (r.coach_id === coachId || r.coach_id == null),
        )
        .map((r) => r.id),
    )
    if (exerciseIds.some((id) => !ok.has(id))) {
      return 'Chaque exercice doit être publié (Krid ou Ma biblio)'
    }
  }

  return null
}

/**
 * Legacy : promote uniquement les modèles hub encore draft (`hub_visible=true`).
 * Les usages éphémères (`hub_visible=false`) ne sont jamais poussés en Ma biblio.
 * Depuis l’éditeur séance on ne crée plus de brouillon hub — filet pour anciennes données.
 */
async function publishLinkedCoachDraftBlocks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  blockIds: string[],
): Promise<string | null> {
  const unique = [...new Set(blockIds.filter(Boolean))]
  if (!unique.length) return null

  const { data, error } = await supabase
    .from('block_library' as never)
    .select('id, name, status, sport_id, expected_result_unit_id, deleted_at, coach_id, hub_visible')
    .in('id' as never, unique as never)
  if (error) return error.message

  const rows = (data ?? []) as {
    id: string
    name: string
    status: string
    sport_id: string | null
    expected_result_unit_id: string | null
    deleted_at: string | null
    coach_id: string | null
    hub_visible?: boolean | null
  }[]

  const draftHubIds: string[] = []
  for (const id of unique) {
    const row = rows.find((r) => r.id === id)
    if (!row || row.deleted_at) return `Bloc introuvable (${id.slice(0, 8)}…)`
    if (row.status === 'published') continue
    // Éphémère ou hors hub : ne pas promouvoir (et ne devrait plus être créable draft depuis séance).
    if (row.hub_visible === false) {
      return `Le bloc « ${row.name} » n’est pas publié. Retire-le ou recrée-le (Ajouter / → Ma biblio).`
    }
    if (row.coach_id !== coachId) {
      return `Impossible de publier : le bloc « ${row.name} » n’est pas le tien`
    }
    if (!row.sport_id || !row.expected_result_unit_id) {
      return `Impossible de publier la séance : le bloc « ${row.name} » doit avoir sport + résultat attendu (≥1 exo).`
    }
    const { count, error: cErr } = await supabase
      .from('block_library_exercises' as never)
      .select('block_id', { count: 'exact', head: true })
      .eq('block_id' as never, id as never)
    if (cErr) return cErr.message
    if (!count) {
      return `Impossible de publier la séance : le bloc « ${row.name} » doit contenir ≥1 exercice.`
    }
    draftHubIds.push(id)
  }

  if (!draftHubIds.length) return null

  const { error: updErr } = await supabase
    .from('block_library' as never)
    .update({
      status: 'published',
      updated_at: new Date().toISOString(),
    } as never)
    .in('id' as never, draftHubIds as never)
    .eq('coach_id' as never, coachId as never)
    .eq('hub_visible' as never, true as never)
  if (updErr) return updErr.message

  revalidatePath('/exercises/blocks')
  revalidatePath('/exercises/blocks/mine')
  revalidatePath('/exercises/blocks/brouillon')
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

export async function createCoachSessionPublishedAction(formData: FormData) {
  return createCoachSessionCore('publish', formData)
}

export async function createCoachSessionDraftAction(formData: FormData) {
  return createCoachSessionCore('draft', formData)
}

async function createCoachSessionCore(intent: SaveIntent, formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const f = readSessionFields(formData)
  const base = '/programs/sessions/new'
  if (!f.name) redirect(`${base}?error=${encodeURIComponent('Nom requis')}`)
  if (intent === 'publish' && !sessionHasContentItem(f.slots)) {
    redirect(`${base}?error=${encodeURIComponent('Au moins 1 bloc ou exercice requis pour publier')}`)
  }

  const slots = normalizeSessionCompositionSlots(f.slots)
  const targetErr = await assertSlotTargets(supabase, userId, slots, {
    allowDraftBlocks: true,
  })
  if (targetErr) redirect(`${base}?error=${encodeURIComponent(targetErr)}`)

  if (intent === 'publish') {
    const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!)
    const pubErr = await publishLinkedCoachDraftBlocks(supabase, userId, blockIds)
    if (pubErr) redirect(`${base}?error=${encodeURIComponent(pubErr)}`)
  }

  const status = intent === 'publish' ? 'published' : 'draft'
  const { data: created, error } = await supabase
    .from('session_library' as never)
    .insert({
      coach_id: userId,
      name: f.name,
      notes: f.notes || null,
      objective_ressenti: f.objectiveRessenti,
      objective_note: f.objectiveNote,
      objective_difficulty: f.objectiveDifficulty,
      status,
      allow_duplicate: f.allowDuplicate,
      allow_download: false,
      source_kind: 'own',
      source_session_id: null,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(`${base}?error=${encodeURIComponent(error?.message ?? 'Création impossible')}`)
  }

  const id = (created as { id: string }).id
  const syncErr = await syncSessionItems(supabase, id, slots)
  if (syncErr) redirect(`/programs/sessions/brouillon/${id}?error=${encodeURIComponent(syncErr)}`)
  const hideErr = await syncHidden(supabase, id, f.hiddenTypeIds, f.hiddenSportIds)
  if (hideErr) redirect(`/programs/sessions/brouillon/${id}?error=${encodeURIComponent(hideErr)}`)

  revalidateSessions(id)
  // Publier / brouillon = navigation = feedback ; pas de pill « Enregistré ».
  redirect(intent === 'publish' ? '/programs/sessions/mine' : '/programs/sessions/brouillon')
}

export async function updateCoachSessionAction(formData: FormData) {
  return saveCoachSession('keep', formData)
}

export async function publishCoachSessionAction(formData: FormData) {
  return saveCoachSession('publish', formData)
}

export async function saveDraftCoachSessionAction(formData: FormData) {
  return saveCoachSession('draft', formData)
}

async function saveCoachSession(intent: SaveIntent, formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/programs/sessions/mine')

  const f = readSessionFields(formData)
  const currentStatus = String(formData.get('current_status') ?? '').trim()
  const editBase =
    currentStatus === 'published'
      ? `/programs/sessions/mine/${id}`
      : `/programs/sessions/brouillon/${id}`

  const effective: SaveIntent =
    intent === 'keep' ? (currentStatus === 'published' ? 'publish' : 'draft') : intent

  if (!f.name) redirect(`${editBase}?error=${encodeURIComponent('Nom requis')}`)
  const slots = normalizeSessionCompositionSlots(f.slots)
  if (effective === 'publish' && !sessionHasContentItem(slots)) {
    redirect(`${editBase}?error=${encodeURIComponent('Au moins 1 bloc ou exercice requis pour publier')}`)
  }

  const targetErr = await assertSlotTargets(supabase, userId, slots, { allowDraftBlocks: true })
  if (targetErr) redirect(`${editBase}?error=${encodeURIComponent(targetErr)}`)

  const status =
    intent === 'publish'
      ? 'published'
      : intent === 'draft'
        ? 'draft'
        : effective === 'publish'
          ? 'published'
          : 'draft'

  if (status === 'published') {
    const blockIds = slots.filter((s) => s.kind === 'block').map((s) => s.blockId!)
    const pubErr = await publishLinkedCoachDraftBlocks(supabase, userId, blockIds)
    if (pubErr) redirect(`${editBase}?error=${encodeURIComponent(pubErr)}`)
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
    .eq('coach_id' as never, userId as never)

  if (error) redirect(`${editBase}?error=${encodeURIComponent(error.message)}`)

  const syncErr = await syncSessionItems(supabase, id, slots)
  if (syncErr) redirect(`${editBase}?error=${encodeURIComponent(syncErr)}`)
  const hideErr = await syncHidden(supabase, id, f.hiddenTypeIds, f.hiddenSportIds)
  if (hideErr) redirect(`${editBase}?error=${encodeURIComponent(hideErr)}`)

  revalidateSessions(id)

  // returnTo : parent (builder) seulement — jamais la fiche elle-même.
  const returnToRaw = safeReturnTo(String(formData.get('returnTo') ?? '').trim(), '')
  const returnTo =
    returnToRaw === editBase || returnToRaw.startsWith(`${editBase}?`) ? '' : returnToRaw

  // Publier / Garder brouillon / Enregistrer : redirect silencieux (pas de ?saved= — voir skill coach-ux-feedback).
  if (intent === 'publish') {
    if (returnTo) redirect(returnTo)
    redirect('/programs/sessions/mine')
  }
  if (intent === 'draft') {
    if (returnTo) redirect(returnTo)
    redirect('/programs/sessions/brouillon')
  }
  if (returnTo) redirect(returnTo)
  if (status === 'published') {
    redirect(`/programs/sessions/mine/${id}`)
  }
  redirect(`/programs/sessions/brouillon/${id}`)
}

/** Liste brouillon → Publier (sans form fiche). */
export async function publishCoachSessionFromListAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/programs/sessions/brouillon')

  const { data: items } = await supabase
    .from('session_library_items' as never)
    .select('item_kind, block_id')
    .eq('session_id' as never, id as never)
  const list = (items ?? []) as { item_kind?: string; block_id?: string | null }[]
  if (!list.some((r) => r.item_kind === 'block' || r.item_kind === 'exercise')) {
    redirect(
      `/programs/sessions/brouillon/${id}?error=` +
        encodeURIComponent('Ajoute au moins 1 bloc ou exercice avant de publier'),
    )
  }
  const blockIds = list
    .filter((r) => r.item_kind === 'block' && r.block_id)
    .map((r) => r.block_id as string)
  const pubErr = await publishLinkedCoachDraftBlocks(supabase, userId, blockIds)
  if (pubErr) {
    redirect(`/programs/sessions/brouillon/${id}?error=` + encodeURIComponent(pubErr))
  }

  const { error } = await supabase
    .from('session_library' as never)
    .update({ status: 'published', updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (error) redirect('/programs/sessions/brouillon?error=' + encodeURIComponent(error.message))
  revalidateSessions(id)
  redirect('/programs/sessions/mine')
}

export async function moveCoachSessionToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/programs/sessions/mine')

  const { error } = await supabase
    .from('session_library' as never)
    .update({ status: 'draft', updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (error) redirect('/programs/sessions/mine?error=' + encodeURIComponent(error.message))
  revalidateSessions(id)
  redirect(`/programs/sessions/brouillon/${id}`)
}

export async function softDeleteCoachSessionAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') ?? '').trim()
  const from = String(formData.get('from') ?? '').trim() || 'mine'
  if (!id) redirect('/programs/sessions/mine')

  const { error } = await supabase
    .from('session_library' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)

  if (error) {
    const dest = from === 'brouillon' ? '/programs/sessions/brouillon' : '/programs/sessions/mine'
    redirect(`${dest}?error=` + encodeURIComponent(error.message))
  }
  revalidateSessions()
  const dest = from === 'brouillon' ? '/programs/sessions/brouillon' : '/programs/sessions/mine'
  redirect(dest)
}

export async function forkKridSessionToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect('/programs/sessions/catalogue')

  const { data: src, error: srcErr } = await supabase
    .from('session_library' as never)
    .select(
      'id, name, notes, objective_ressenti, objective_note, objective_difficulty, allow_duplicate, status',
    )
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)
    .eq('status' as never, 'published')
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (srcErr || !src) {
    redirect(
      '/programs/sessions/catalogue?error=' +
        encodeURIComponent(srcErr?.message ?? 'Séance Krid introuvable'),
    )
  }

  const s = src as {
    id: string
    name: string
    notes: string | null
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
    allow_duplicate: boolean
  }

  const [{ data: items }, { data: hideTypes }, { data: hideSports }] = await Promise.all([
    supabase
      .from('session_library_items' as never)
      .select('position, item_kind, block_id, exercise_id, prescriptions')
      .eq('session_id' as never, id as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('session_library_hidden_types' as never)
      .select('exercise_type_id')
      .eq('session_id' as never, id as never),
    supabase
      .from('session_library_hidden_sports' as never)
      .select('sport_id')
      .eq('session_id' as never, id as never),
  ])

  const { data: created, error } = await supabase
    .from('session_library' as never)
    .insert({
      coach_id: userId,
      name: s.name,
      notes: s.notes,
      objective_ressenti: s.objective_ressenti,
      objective_note: s.objective_note,
      objective_difficulty: s.objective_difficulty,
      status: 'draft',
      allow_duplicate: s.allow_duplicate,
      allow_download: false,
      source_kind: 'krid',
      source_session_id: s.id,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(
      '/programs/sessions/catalogue?error=' +
        encodeURIComponent(error?.message ?? 'Fork impossible'),
    )
  }

  const newId = (created as { id: string }).id

  const itemRows = (
    (items ?? []) as {
      position: number
      item_kind: string
      block_id: string | null
      exercise_id: string | null
      prescriptions: unknown
    }[]
  ).map((it) => ({
    session_id: newId,
    position: it.position,
    item_kind: it.item_kind,
    block_id: it.block_id,
    exercise_id: it.exercise_id,
    prescriptions: it.prescriptions ?? [],
  }))
  if (itemRows.length) {
    const { error: insErr } = await supabase.from('session_library_items' as never).insert(itemRows as never)
    if (insErr) {
      redirect(`/programs/sessions/brouillon/${newId}?error=` + encodeURIComponent(insErr.message))
    }
  }

  const typeIds = ((hideTypes ?? []) as { exercise_type_id: string }[]).map((r) => r.exercise_type_id)
  const sportIds = ((hideSports ?? []) as { sport_id: string }[]).map((r) => r.sport_id)
  const hideErr = await syncHidden(supabase, newId, typeIds, sportIds)
  if (hideErr) {
    redirect(`/programs/sessions/brouillon/${newId}?error=` + encodeURIComponent(hideErr))
  }

  revalidateSessions(newId)
  redirect(`/programs/sessions/brouillon/${newId}`)
}
