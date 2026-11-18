import {
  countTemplateChildren,
  duplicateCoachProgram,
  loadProgramForDuplicate,
} from '@/src/lib/programs/duplicateCoachProgram'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

export type ClientProgramInstanceResult =
  | {
      ok: true
      instanceId: string
      templateId: string
      is_calendar: boolean
      start_date: string | null
    }
  | { ok: false; error: string }

/**
 * Photocopie d’un template (feuille/enfant) → instance client hors hubs.
 * source_program_id du plan = instance ; template_program_id = template hub.
 */
export async function createClientProgramInstance(
  supabase: AdminSupabase,
  opts: {
    templateId: string
    coachId: string
    /** Suffixe titre optionnel (ex. prénom client). */
    titleSuffix?: string | null
  },
): Promise<ClientProgramInstanceResult> {
  const source = await loadProgramForDuplicate(supabase, opts.templateId)
  if (!source || source.coach_id !== opts.coachId || source.is_trainly_catalog) {
    return { ok: false, error: 'Programme introuvable' }
  }

  const kids = await countTemplateChildren(supabase, source.id, opts.coachId)
  if (kids > 0) {
    return {
      ok: false,
      error: 'Envoie une version personnalisée (enfant), pas le modèle parent',
    }
  }

  const base = source.title?.trim() || 'Programme'
  const suffix = opts.titleSuffix?.trim()
  const title = suffix ? `${base} · ${suffix}`.slice(0, 180) : base

  const copied = await duplicateCoachProgram(supabase, {
    source,
    coachId: opts.coachId,
    asTemplate: false,
    title,
    sourceKind: 'own',
    isClientInstance: true,
    templateProgramId: source.id,
  })

  if (!copied.ok) return copied

  // start_date / is_calendar depuis le template (colonnes hors loadProgramForDuplicate).
  const { data: meta } = await supabase
    .from('programs')
    .select('is_calendar, start_date')
    .eq('id', source.id)
    .maybeSingle()

  return {
    ok: true,
    instanceId: copied.id,
    templateId: source.id,
    is_calendar: Boolean((meta as { is_calendar?: boolean | null } | null)?.is_calendar),
    start_date:
      ((meta as { start_date?: string | null } | null)?.start_date as string | null) ?? null,
  }
}

export type AssignProgramToClientResult =
  | { ok: true; planId: string; instanceId: string }
  | { ok: false; code: 'exists' | 'error'; error: string }

/**
 * Chemin d’écriture unique « template → plan client » (fiche, groupe, presta).
 * add = refuse si un plan actif existe · replace = termine l’existant puis recrée.
 * Échec après copie → instance archivée (pas d’orphelin).
 */
export async function assignProgramTemplateToClient(
  supabase: AdminSupabase,
  opts: {
    coachId: string
    clientId: string
    templateId: string
    mode?: 'add' | 'replace'
  },
): Promise<AssignProgramToClientResult> {
  if (opts.mode === 'replace') {
    await endActivePlansForTemplate(supabase, opts)
  } else {
    const existing = await findActivePlanForTemplate(supabase, opts)
    if (existing) {
      return { ok: false, code: 'exists', error: 'Ce client a déjà ce programme en cours' }
    }
  }

  const { data: client } = await supabase
    .from('clients')
    .select('first_name, last_name, email')
    .eq('id', opts.clientId)
    .eq('coach_id', opts.coachId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client) return { ok: false, code: 'error', error: 'Client introuvable' }

  const label =
    [client.first_name, client.last_name].filter(Boolean).join(' ').trim() ||
    client.email ||
    null

  const instance = await createClientProgramInstance(supabase, {
    templateId: opts.templateId,
    coachId: opts.coachId,
    titleSuffix: label,
  })
  if (!instance.ok) return { ok: false, code: 'error', error: instance.error }

  const { data: plan, error } = await supabase
    .from('client_fitness_plans')
    .insert({
      client_id: opts.clientId,
      coach_id: opts.coachId,
      source_program_id: instance.instanceId,
      template_program_id: instance.templateId,
      status: 'waiting',
      is_calendar: instance.is_calendar,
      start_date: instance.start_date,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !plan) {
    const now = new Date().toISOString()
    await supabase
      .from('programs')
      .update({ deleted_at: now, updated_at: now } as never)
      .eq('id', instance.instanceId)
    return { ok: false, code: 'error', error: error?.message ?? 'Plan impossible' }
  }

  return { ok: true, planId: (plan as { id: string }).id, instanceId: instance.instanceId }
}

/** Plan actif déjà lié à ce template (instance ou legacy live). */
export async function findActivePlanForTemplate(
  supabase: AdminSupabase,
  opts: { coachId: string; clientId: string; templateId: string },
): Promise<{ id: string } | null> {
  const { data: byTemplate } = await supabase
    .from('client_fitness_plans')
    .select('id')
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('template_program_id', opts.templateId)
    .in('status', ['waiting', 'started', 'paused'])
    .limit(1)
    .maybeSingle()

  if (byTemplate) return byTemplate as { id: string }

  const { data: legacy } = await supabase
    .from('client_fitness_plans')
    .select('id')
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('source_program_id', opts.templateId)
    .in('status', ['waiting', 'started', 'paused'])
    .limit(1)
    .maybeSingle()

  return (legacy as { id: string } | null) ?? null
}

/** Termine les plans actifs rattachés à un template (instances + legacy). */
export async function endActivePlansForTemplate(
  supabase: AdminSupabase,
  opts: { coachId: string; clientId: string; templateId: string },
): Promise<void> {
  const now = new Date().toISOString()
  await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now } as never)
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('template_program_id', opts.templateId)
    .in('status', ['waiting', 'started', 'paused'])

  await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now } as never)
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('source_program_id', opts.templateId)
    .in('status', ['waiting', 'started', 'paused'])
}
