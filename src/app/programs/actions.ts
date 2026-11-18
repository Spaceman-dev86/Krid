'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { durationLabelFromWeekCount } from '@/src/lib/formatProgramDuration'
import { assignProgramTemplateToClient } from '@/src/lib/programs/createClientProgramInstance'
import {
  countTemplateChildren,
  duplicateCoachProgram,
  duplicateTemplateInHub,
  loadProgramForDuplicate,
} from '@/src/lib/programs/duplicateCoachProgram'
import {
  whyCannotArchiveTemplate,
  whyCannotMoveTemplateToDraft,
} from '@/src/lib/programs/templateHubGuards'
import { resolveProgramIds, singularFromIds } from '@/src/lib/prestations/contentLinks'
import { safeInternalPath, withQueryParams } from '@/src/lib/navigation/safeReturnTo'
import { createClient } from '@/src/lib/supabase/server'

async function requireCoachUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp((profile as { role?: string | null } | null)?.role)) redirect('/login')
  return { supabase, userId: user.id }
}

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

const LEVELS = new Set(['débutant', 'intermédiaire', 'avancé'])

function normalizeLevel(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (v === 'debutant') return 'débutant'
  if (v === 'confirme' || v === 'confirmé') return 'avancé'
  if (LEVELS.has(v)) return v
  return null
}

function parseWeekCount(raw: string): number | null {
  const n = Number.parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > 52) return null
  return n
}

/** Création coach : semaines vides (day-board), pas de séances préremplies. */
export async function createCoachProgramAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp((profile as { role?: string | null } | null)?.role)) redirect('/login')

  const returnTo = '/programs/brouillon'
  const title = String(formData.get('title') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const goal = String(formData.get('goal') ?? '').trim()
  const level = normalizeLevel(String(formData.get('level') ?? ''))
  const weekCount = parseWeekCount(String(formData.get('duration_weeks') ?? ''))
  const isCalendar = String(formData.get('is_calendar') ?? '1') === '1'

  if (!title) {
    redirect(`${returnTo}?create=1&error=${encodeURIComponent('Nom requis')}`)
  }
  if (!level) {
    redirect(`${returnTo}?create=1&error=${encodeURIComponent('Niveau requis')}`)
  }
  if (!weekCount) {
    redirect(`${returnTo}?create=1&error=${encodeURIComponent('Durée : 1 à 52 semaines')}`)
  }

  const { data: program, error } = await supabase
    .from('programs')
    .insert({
      coach_id: user.id,
      title,
      description: description || null,
      goal: goal || null,
      level,
      duration: durationLabelFromWeekCount(weekCount),
      is_calendar: isCalendar,
      is_template: false,
      is_published: false,
      is_trainly_catalog: false,
      status: 'draft',
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !program?.id) {
    redirect(
      `${returnTo}?create=1&error=${encodeURIComponent(error?.message ?? 'Création impossible')}`,
    )
  }

  const programId = program.id as string

  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    program_id: programId,
    week_order: i,
    title: `Semaine ${i + 1}`,
  }))

  const { error: weeksError } = await supabase.from('program_weeks').insert(weeks as never)
  if (weeksError) {
    redirect(
      `${returnTo}?create=1&error=${encodeURIComponent(weeksError.message ?? 'Semaines impossibles')}`,
    )
  }

  revalidatePath('/programs')
  revalidatePath('/programs/brouillon')
  revalidatePath(`/programs/${programId}`)
  redirect(`/programs/${programId}`)
}

/** @deprecated alias — préférer createCoachProgramAction */
export async function createProgramAction(formData: FormData) {
  return createCoachProgramAction(formData)
}

/** Brouillon → Templates (is_template + published). */
export async function publishCoachProgramAsTemplateAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp((profile as { role?: string | null } | null)?.role)) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/programs/brouillon')

  const { data: existing } = await supabase
    .from('programs')
    .select('id,is_template,is_trainly_catalog,is_client_instance')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  const row = existing as {
    id: string
    is_template: boolean | null
    is_trainly_catalog: boolean | null
    is_client_instance?: boolean | null
  } | null
  if (!row || row.is_trainly_catalog) {
    redirect('/programs/brouillon?error=' + encodeURIComponent('Programme introuvable'))
  }
  if (row.is_client_instance) {
    redirect(
      `/programs/${id}?error=` +
        encodeURIComponent('Copie client — pas un template hub'),
    )
  }

  // programs.status ∈ draft|running|done|archived — pas « published » (→ is_published / is_template).
  const { error } = await supabase
    .from('programs')
    .update({
      is_template: true,
      is_published: true,
      status: 'draft',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    redirect('/programs/brouillon?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/programs/brouillon')
  revalidatePath('/programs/templates')
  revalidatePath(`/programs/${id}`)
  redirect('/programs/templates')
}

export async function softDeleteProgramAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const user = { id: userId }

  const id = clean(formData.get('id'))
  const from = clean(formData.get('from')) ?? 'brouillon'
  const dest = from === 'templates' ? '/programs/templates' : '/programs/brouillon'
  if (!id) redirect(dest)

  if (from === 'templates') {
    const blocked = await whyCannotArchiveTemplate(supabase, id, user.id)
    if (blocked) {
      redirect(`${dest}?error=` + encodeURIComponent(blocked))
    }
  }

  const { error } = await supabase
    .from('programs')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect(`${dest}?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/programs')
  revalidatePath('/programs/brouillon')
  revalidatePath('/programs/templates')
  redirect(dest)
}

export async function assignProgramToClientAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()

  const clientId = clean(formData.get('client_id'))
  const programId = clean(formData.get('program_id'))
  const returnTo = safeInternalPath(formData.get('return_to'), `/clients/${clientId ?? ''}`)

  if (!clientId || !programId) redirect(returnTo)

  const assigned = await assignProgramTemplateToClient(supabase, {
    coachId: userId,
    clientId,
    templateId: programId,
  })
  if (!assigned.ok) {
    redirect(withQueryParams(returnTo, { error: assigned.error }))
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath(`/clients/${clientId}/program`)
  revalidatePath('/programs')
  revalidatePath('/programs/encours')
  revalidatePath('/programs/templates')
  const dest = returnTo.startsWith('/clients/') ? returnTo : '/programs/encours'
  redirect(withQueryParams(dest, { assigned: '1' }))
}

/** Envoyer à 1..N clients (photocopie chacun) — popup Templates. */
export async function assignProgramToClientsAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const programId = clean(formData.get('program_id'))
  const returnTo = safeInternalPath(formData.get('return_to'), '/programs/encours')
  const clientIds = [
    ...new Set(
      formData
        .getAll('client_ids')
        .map((v) => clean(v))
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  if (!programId || !clientIds.length) {
    redirect(
      `${returnTo}?error=` + encodeURIComponent('Choisis au moins un client'),
    )
  }

  const { data: owned } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .in('id', clientIds)
  const allowed = new Set((owned ?? []).map((c) => c.id as string))
  const ids = clientIds.filter((id) => allowed.has(id))
  if (!ids.length) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Clients introuvables'))
  }

  const kids = await countTemplateChildren(supabase, programId, userId)
  if (kids > 0) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Envoie une version personnalisée (enfant), pas le modèle parent'),
    )
  }

  const { pushProgramToClients } = await import('@/src/lib/coach/linkedGroups')
  let pushed = 0
  try {
    const result = await pushProgramToClients(supabase, {
      coachId: userId,
      clientIds: ids,
      programId,
      mode: 'add',
    })
    pushed = result.pushed
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Envoi impossible'
    redirect(`${returnTo}?error=` + encodeURIComponent(msg))
  }

  if (pushed === 0) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Aucun envoi — déjà actifs ou programme non envoyable'),
    )
  }

  revalidatePath('/programs/encours')
  revalidatePath('/programs/templates')
  redirect('/programs/encours')
}

/** Envoyer à tous les membres d’un groupe (photocopie chacun). */
export async function assignProgramToGroupAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const programId = clean(formData.get('program_id'))
  const groupId = clean(formData.get('group_id'))
  const returnTo = safeInternalPath(formData.get('return_to'), '/programs/encours')
  if (!programId || !groupId) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Groupe requis'))
  }

  const kids = await countTemplateChildren(supabase, programId, userId)
  if (kids > 0) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Envoie une version personnalisée (enfant), pas le modèle parent'),
    )
  }

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, type, prestation_id')
    .eq('id', groupId)
    .eq('coach_id', userId)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Groupe introuvable'))
  }

  let clientIds: string[] = []
  if (group.type === 'linked' && group.prestation_id) {
    const { data: grants } = await supabase
      .from('client_grants')
      .select('client_id')
      .eq('coach_id', userId)
      .eq('prestation_id', group.prestation_id)
      .eq('status', 'active')
    clientIds = [
      ...new Set(
        (grants ?? []).map((g) => g.client_id as string).filter(Boolean),
      ),
    ]
  } else {
    const { data: members } = await supabase
      .from('client_group_members')
      .select('client_id')
      .eq('group_id', groupId)
    clientIds = (members ?? []).map((m) => m.client_id as string).filter(Boolean)
  }

  if (!clientIds.length) {
    redirect(`${returnTo}?error=` + encodeURIComponent('Groupe sans membres'))
  }

  const {
    pushProgramToActiveGrants,
    pushProgramToClients,
  } = await import('@/src/lib/coach/linkedGroups')

  let pushed = 0
  try {
    if (group.type === 'linked' && group.prestation_id) {
      const result = await pushProgramToActiveGrants(supabase, {
        coachId: userId,
        prestationId: group.prestation_id,
        programId,
        mode: 'add',
      })
      pushed = result.pushed
    } else {
      const result = await pushProgramToClients(supabase, {
        coachId: userId,
        clientIds,
        programId,
        mode: 'add',
      })
      pushed = result.pushed
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Envoi impossible'
    redirect(`${returnTo}?error=` + encodeURIComponent(msg))
  }

  if (pushed === 0) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Aucun envoi — déjà actifs ou programme non envoyable'),
    )
  }

  // Même write path que fiche groupe → nouveaux membres reçoivent le programme.
  const now = new Date().toISOString()
  const { data: existingPush } = await supabase
    .from('client_group_pushed_content')
    .select('id')
    .eq('group_id', groupId)
    .eq('kind', 'fitness')
    .eq('content_id', programId)
    .maybeSingle()
  if (existingPush?.id) {
    await supabase
      .from('client_group_pushed_content')
      .update({ last_pushed_at: now, last_pushed_count: pushed })
      .eq('id', existingPush.id)
  } else {
    await supabase.from('client_group_pushed_content').insert({
      group_id: groupId,
      kind: 'fitness',
      content_id: programId,
      last_pushed_at: now,
      last_pushed_count: pushed,
    })
  }

  revalidatePath('/programs/encours')
  revalidatePath('/programs/templates')
  revalidatePath(`/clients/groupes/${groupId}`)
  revalidatePath(`/clients/groupes/${groupId}/prestation`)
  redirect('/programs/encours')
}

/** Catalogue Krid → copie brouillon coach. */
export async function forkKridProgramToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const id = clean(formData.get('id'))
  if (!id) redirect('/programs/catalogue')

  const source = await loadProgramForDuplicate(supabase, id)
  if (
    !source ||
    source.is_trainly_catalog !== true ||
    source.catalog_status !== 'published'
  ) {
    redirect('/programs/catalogue?error=' + encodeURIComponent('Programme introuvable'))
  }
  if (source.allow_duplicate === false) {
    redirect('/programs/catalogue?error=' + encodeURIComponent('Ce programme n’est pas duplicable'))
  }

  const copied = await duplicateCoachProgram(supabase, {
    source,
    coachId: userId,
    asTemplate: false,
    title: source.title,
    sourceKind: 'krid',
  })
  if (!copied.ok) {
    redirect('/programs/catalogue?error=' + encodeURIComponent(copied.error))
  }

  revalidatePath('/programs/brouillon')
  revalidatePath('/programs/catalogue')
  redirect('/programs/brouillon')
}

/**
 * Templates : Dupliquer (reste sur /programs/templates).
 * Feuille → parent + 2 enfants · Enfant → frère (mêmes données) · 2 niveaux max.
 */
export async function duplicateCoachProgramToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const id = clean(formData.get('id'))
  if (!id) redirect('/programs/templates')

  const source = await loadProgramForDuplicate(supabase, id)
  if (!source || source.coach_id !== userId || source.is_trainly_catalog) {
    redirect('/programs/templates?error=' + encodeURIComponent('Programme introuvable'))
  }

  const result = await duplicateTemplateInHub(supabase, {
    source,
    coachId: userId,
  })
  if (!result.ok) {
    redirect('/programs/templates?error=' + encodeURIComponent(result.error))
  }

  revalidatePath('/programs/templates')
  revalidatePath(`/programs/${id}`)
  revalidatePath(`/programs/${result.parentId}`)
  // Hub : feedback = PendingFormButton (« Copie… ») · pas de pill vert.
  redirect('/programs/templates')
}

/** Templates → Brouillon (move, pas une copie). */
export async function moveCoachProgramToDraftAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const id = clean(formData.get('id'))
  const fromBuilder = clean(formData.get('from_builder')) === '1'
  const errBase = fromBuilder ? `/programs/${id}` : '/programs/templates'
  if (!id) redirect('/programs/templates')

  const { data: moveRow } = await supabase
    .from('programs')
    .select('is_client_instance')
    .eq('id', id)
    .eq('coach_id', userId)
    .maybeSingle()
  if ((moveRow as { is_client_instance?: boolean | null } | null)?.is_client_instance) {
    redirect(
      `${errBase}?error=` + encodeURIComponent('Copie client — pas un brouillon hub'),
    )
  }

  const blocked = await whyCannotMoveTemplateToDraft(supabase, id, userId)
  if (blocked) {
    redirect(`${errBase}?error=` + encodeURIComponent(blocked))
  }

  const { error } = await supabase
    .from('programs')
    .update({
      is_template: false,
      is_published: false,
      // Détache d’un parent éventuel (enfant → brouillon).
      parent_program_id: null,
      // status reste dans draft|running|done|archived
      status: 'draft',
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`${errBase}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/programs/brouillon')
  revalidatePath('/programs/templates')
  revalidatePath(`/programs/${id}`)
  redirect(fromBuilder ? `/programs/${id}` : '/programs/brouillon')
}

/** Lier un template programme à une presta (ajoute dans program_template_ids). */
export async function linkProgramTemplateToPrestationAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const programId = clean(formData.get('program_id'))
  const prestationId = clean(formData.get('prestation_id'))
  const returnTo = safeInternalPath(formData.get('return_to'), '/programs/templates')

  if (!programId || !prestationId) redirect(`${returnTo}?error=params`)

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('coach_id', userId)
    .eq('is_template', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (!program) redirect(`${returnTo}?error=` + encodeURIComponent('Programme introuvable'))

  const kids = await countTemplateChildren(supabase, programId, userId)
  if (kids > 0) {
    redirect(
      `${returnTo}?error=` +
        encodeURIComponent('Lie une version personnalisée (enfant), pas le modèle parent'),
    )
  }

  const { data: presta } = await supabase
    .from('prestations')
    .select('id, program_template_id, program_template_ids')
    .eq('id', prestationId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta) redirect(`${returnTo}?error=` + encodeURIComponent('Presta introuvable'))

  const current = resolveProgramIds(
    presta as { program_template_id?: string | null; program_template_ids?: unknown },
  )
  if (!current.includes(programId)) current.push(programId)

  const { error } = await supabase
    .from('prestations')
    .update({
      program_template_ids: current,
      program_template_id: singularFromIds(current),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', prestationId)
    .eq('coach_id', userId)

  if (error) redirect(`${returnTo}?error=` + encodeURIComponent(error.message))

  // Même livraison qu’au Payé : les acheteurs déjà actifs reçoivent le programme.
  const { pushProgramToActiveGrants } = await import('@/src/lib/coach/linkedGroups')
  await pushProgramToActiveGrants(supabase, {
    coachId: userId,
    prestationId,
    programId,
    mode: 'add',
  })

  revalidatePath('/programs/templates')
  revalidatePath('/programs/encours')
  revalidatePath(`/profile/prestations/${prestationId}`)
  redirect(returnTo)
}

/** En cours : archiver un plan client. */
export async function archiveClientFitnessPlanAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const planId = clean(formData.get('plan_id'))
  if (!planId) redirect('/programs/encours')

  const { error } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: new Date().toISOString() } as never)
    .eq('id', planId)
    .eq('coach_id', userId)

  if (error) redirect('/programs/encours?error=' + encodeURIComponent(error.message))

  revalidatePath('/programs/encours')
  redirect('/programs/encours')
}

/** Fiche client / plan : pause · reprendre · terminer un plan fitness. */
export async function setClientFitnessPlanStatusAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const planId = clean(formData.get('plan_id'))
  const intent = clean(formData.get('intent'))
  const returnTo = safeInternalPath(formData.get('return_to'), '/programs/encours')
  if (!planId || !intent) redirect(returnTo)

  const { data: plan } = await supabase
    .from('client_fitness_plans')
    .select('id, status, start_date, client_id')
    .eq('id', planId)
    .eq('coach_id', userId)
    .maybeSingle()
  if (!plan) redirect(withQueryParams(returnTo, { error: 'Plan introuvable' }))

  let next: string | null = null
  if (intent === 'pause' && (plan.status === 'started' || plan.status === 'waiting')) next = 'paused'
  if (intent === 'resume' && plan.status === 'paused') next = plan.start_date ? 'started' : 'waiting'
  if (intent === 'done' && plan.status !== 'done') next = 'done'
  if (!next) redirect(withQueryParams(returnTo, { error: 'Action impossible sur ce plan' }))

  const { error } = await supabase
    .from('client_fitness_plans')
    .update({ status: next, updated_at: new Date().toISOString() } as never)
    .eq('id', planId)
    .eq('coach_id', userId)
  if (error) redirect(withQueryParams(returnTo, { error: error.message }))

  revalidatePath('/programs/encours')
  revalidatePath(`/programs/plans/${planId}`)
  revalidatePath(`/clients/${plan.client_id}/program`)
  redirect(returnTo)
}

/** En cours : archiver tous les plans actifs d’un template (instances + legacy). */
export async function archiveProgramEncoursPlansAction(formData: FormData) {
  const { supabase, userId } = await requireCoachUser()
  const programId = clean(formData.get('program_id'))
  if (!programId) redirect('/programs/encours')

  const now = new Date().toISOString()
  // Prefer `done` — check SQL historique = waiting|started|paused|done (pas archived).
  const { error: e1 } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now } as never)
    .eq('coach_id', userId)
    .eq('template_program_id', programId)
    .in('status', ['waiting', 'started', 'paused'])

  const { error: e2 } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now } as never)
    .eq('coach_id', userId)
    .eq('source_program_id', programId)
    .in('status', ['waiting', 'started', 'paused'])

  const archiveError = e1 ?? e2
  if (archiveError) {
    revalidatePath('/programs/encours')
    redirect('/programs/encours?error=' + encodeURIComponent(archiveError.message))
  }

  revalidatePath('/programs/encours')
  redirect('/programs/encours')
}
