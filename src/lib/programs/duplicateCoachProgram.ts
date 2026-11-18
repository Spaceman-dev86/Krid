import { duplicateProgramWeekContents } from '@/src/lib/programs/duplicateProgramWeekContents'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type SourceProgramRow = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  image_url: string | null
  is_calendar: boolean | null
  allow_duplicate: boolean | null
  is_trainly_catalog: boolean | null
  catalog_status: string | null
  coach_id: string | null
  deleted_at: string | null
  parent_program_id?: string | null
}

/** Nb d’enfants template non archivés (1 niveau). */
export async function countTemplateChildren(
  supabase: AdminSupabase,
  parentId: string,
  coachId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('programs')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', coachId)
    .eq('parent_program_id', parentId)
    .eq('is_template', true)
    .is('deleted_at', null)
  if (error) return 0
  return count ?? 0
}

async function insertProgramRow(
  supabase: AdminSupabase,
  baseInsert: Record<string, unknown>,
  parentProgramId?: string | null,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  let created: { id: string } | null = null
  let error: { message: string } | null = null

  {
    const res = await supabase
      .from('programs')
      .insert(baseInsert as never)
      .select('id')
      .maybeSingle()
    error = res.error
    created = res.data as { id: string } | null
    if (
      error &&
      /source_kind|parent_program_id|is_client_instance|template_program_id/i.test(
        error.message,
      )
    ) {
      const slim = { ...baseInsert }
      delete slim.source_kind
      delete slim.parent_program_id
      delete slim.is_client_instance
      delete slim.template_program_id
      const retry = await supabase
        .from('programs')
        .insert(slim as never)
        .select('id')
        .maybeSingle()
      error = retry.error
      created = retry.data as { id: string } | null
      if (!error && created && parentProgramId) {
        await supabase
          .from('programs')
          .update({ parent_program_id: parentProgramId } as never)
          .eq('id', created.id)
      }
    }
  }

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Création impossible' }
  }
  return { ok: true, id: (created as { id: string }).id }
}

/**
 * Deep-copy programme → nouveau programme coach (semaines + séances + composition).
 * Photocopie : le source n’est jamais modifié (sauf promote feuille → famille).
 */
export async function duplicateCoachProgram(
  supabase: AdminSupabase,
  opts: {
    source: SourceProgramRow
    coachId: string
    /** Brouillon (false) ou template (true). */
    asTemplate: boolean
    title?: string | null
    /** Provenance hub · own = perso · krid = fork catalogue. */
    sourceKind?: 'own' | 'krid'
    /** Template enfant : id du parent (1 niveau max). */
    parentProgramId?: string | null
    /** false = coquille méta seule (parent modèle). Défaut true. */
    copyContents?: boolean
    /** Instance client hors hubs (envoi). */
    isClientInstance?: boolean
    /** Provenance template hub pour une instance. */
    templateProgramId?: string | null
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title =
    (opts.title?.trim() || opts.source.title?.trim() || 'Programme').slice(0, 180)

  const baseInsert: Record<string, unknown> = {
    coach_id: opts.coachId,
    title,
    description: opts.source.description,
    goal: opts.source.goal,
    level: opts.source.level,
    duration: opts.source.duration,
    image_url: opts.source.image_url,
    is_calendar: Boolean(opts.source.is_calendar),
    is_template: opts.asTemplate,
    is_published: opts.asTemplate,
    is_trainly_catalog: false,
    // Constraint programs_status_check : draft | running | done | archived
    status: 'draft',
    catalog_status: 'draft',
    allow_duplicate: true,
    allow_download: false,
    source_kind: opts.sourceKind ?? 'own',
  }
  if (opts.parentProgramId) {
    baseInsert.parent_program_id = opts.parentProgramId
  }
  if (opts.isClientInstance) {
    baseInsert.is_client_instance = true
    baseInsert.is_template = false
    baseInsert.is_published = false
  }
  if (opts.templateProgramId) {
    baseInsert.template_program_id = opts.templateProgramId
  }

  // Filet : si colonnes instance absentes, patch après insert.
  const needsInstancePatch = Boolean(opts.isClientInstance || opts.templateProgramId)

  const inserted = await insertProgramRow(supabase, baseInsert, opts.parentProgramId)
  if (!inserted.ok) return inserted

  if (needsInstancePatch) {
    const patch: Record<string, unknown> = {}
    if (opts.isClientInstance) {
      patch.is_client_instance = true
      patch.is_template = false
      patch.is_published = false
    }
    if (opts.templateProgramId) patch.template_program_id = opts.templateProgramId
    if (Object.keys(patch).length) {
      await supabase.from('programs').update(patch as never).eq('id', inserted.id)
    }
  }

  if (opts.copyContents === false) {
    return inserted
  }

  const newProgramId = inserted.id

  // Copie non transactionnelle : un échec en cours archive la copie partielle.
  const fail = async (error: string): Promise<{ ok: false; error: string }> => {
    const now = new Date().toISOString()
    await supabase
      .from('programs')
      .update({ deleted_at: now, updated_at: now } as never)
      .eq('id', newProgramId)
    return { ok: false, error }
  }

  const { data: weeksRaw, error: weeksErr } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', opts.source.id)
    .order('week_order', { ascending: true })

  if (weeksErr) {
    return fail(weeksErr.message)
  }

  const weeks = (weeksRaw ?? []) as {
    id: string
    title: string | null
    week_order: number
  }[]

  for (const w of weeks) {
    const { data: newWeek, error: wInsErr } = await supabase
      .from('program_weeks')
      .insert({
        program_id: newProgramId,
        week_order: w.week_order,
        title: w.title,
      } as never)
      .select('id')
      .maybeSingle()

    if (wInsErr || !newWeek) {
      return fail(wInsErr?.message ?? 'Semaine impossible')
    }

    const copied = await duplicateProgramWeekContents(
      supabase,
      w.id,
      (newWeek as { id: string }).id,
    )
    if (!copied.ok) {
      return fail(copied.error)
    }
  }

  return { ok: true, id: newProgramId }
}

/**
 * Hub Templates — Dupliquer (2 niveaux max) :
 * - Feuille → parent modèle (contenu) + base + 1ʳᵉ copie.
 * - Parent (déjà une famille) → nouvel enfant = copie du modèle parent.
 * - Enfant → frère = copie de cet enfant.
 */
export async function duplicateTemplateInHub(
  supabase: AdminSupabase,
  opts: { source: SourceProgramRow; coachId: string },
): Promise<{ ok: true; parentId: string } | { ok: false; error: string }> {
  const source = opts.source
  const existingParent = source.parent_program_id?.trim() || null

  // Enfant → frère (mêmes données que cet enfant).
  if (existingParent) {
    const base = source.title?.trim() || 'Programme'
    const copied = await duplicateCoachProgram(supabase, {
      source,
      coachId: opts.coachId,
      asTemplate: true,
      title: `${base} (copie)`,
      sourceKind: 'own',
      parentProgramId: existingParent,
    })
    if (!copied.ok) return copied
    return { ok: true, parentId: existingParent }
  }

  const childCount = await countTemplateChildren(supabase, source.id, opts.coachId)

  // Parent déjà en famille → nouvel enfant depuis le modèle.
  if (childCount > 0) {
    const base = source.title?.trim() || 'Programme'
    const copied = await duplicateCoachProgram(supabase, {
      source,
      coachId: opts.coachId,
      asTemplate: true,
      title: `${base} (copie)`,
      sourceKind: 'own',
      parentProgramId: source.id,
    })
    if (!copied.ok) return copied
    return { ok: true, parentId: source.id }
  }

  // Feuille → famille : parent (modèle avec contenu) + base + copie.
  const baseTitle = source.title?.trim() || 'Programme'
  const parent = await duplicateCoachProgram(supabase, {
    source,
    coachId: opts.coachId,
    asTemplate: true,
    title: baseTitle,
    sourceKind: 'own',
    copyContents: true,
  })
  if (!parent.ok) return parent

  const { error: reparentErr } = await supabase
    .from('programs')
    .update({
      parent_program_id: parent.id,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', source.id)
    .eq('coach_id', opts.coachId)

  if (reparentErr) {
    return { ok: false, error: reparentErr.message }
  }

  const copy = await duplicateCoachProgram(supabase, {
    source,
    coachId: opts.coachId,
    asTemplate: true,
    title: `${baseTitle} (copie)`,
    sourceKind: 'own',
    parentProgramId: parent.id,
  })
  if (!copy.ok) return copy

  return { ok: true, parentId: parent.id }
}

export async function loadProgramForDuplicate(
  supabase: AdminSupabase,
  programId: string,
): Promise<SourceProgramRow | null> {
  let res = await supabase
    .from('programs')
    .select(
      'id,title,description,goal,level,duration,image_url,is_calendar,allow_duplicate,is_trainly_catalog,catalog_status,coach_id,deleted_at,parent_program_id',
    )
    .eq('id', programId)
    .maybeSingle()

  if (res.error && /parent_program_id/i.test(res.error.message)) {
    res = await supabase
      .from('programs')
      .select(
        'id,title,description,goal,level,duration,image_url,is_calendar,allow_duplicate,is_trainly_catalog,catalog_status,coach_id,deleted_at',
      )
      .eq('id', programId)
      .maybeSingle()
  }

  const row = res.data as SourceProgramRow | null
  if (!row || row.deleted_at) return null
  return row
}
