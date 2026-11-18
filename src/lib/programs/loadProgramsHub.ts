import type { SupabaseClient } from '@supabase/supabase-js'

export type ProgramsHubEncoursClient = {
  planId: string
  clientId: string
  label: string
  status: string
  start: string
  end: string
  progress: number
}

export type ProgramsHubEncoursRow = {
  /** Clé = source_program_id (1 ligne = 1 programme). */
  id: string
  programId: string
  title: string
  /** Clients au statut started. */
  startedCount: number
  /** Moyenne des progress % clients. */
  avgProgress: number
  clientCount: number
  /** 1ʳᵉ affectation client / mise en ligne du plan. */
  onlineAt: string
  /** Sous-lignes = clients (dépliable). */
  clients: ProgramsHubEncoursClient[]
}

export type ProgramsHubTemplateChild = {
  id: string
  title: string
  durationLabel: string
  level: string
  sessions: number
  prestas: number
  clients: number
  /** false si enfants (n/a) / presta / envoi actif. */
  canMoveToDraft: boolean
}

export type ProgramsHubTemplateRow = {
  id: string
  title: string
  durationLabel: string
  level: string
  sessions: number
  prestas: number
  clients: number
  /** Enfants (famille). Si non vide = parent modèle ; feuille = []. */
  children: ProgramsHubTemplateChild[]
  /** false si enfants / presta / envoi actif. */
  canMoveToDraft: boolean
}

export type ProgramsHubSimpleRow = {
  id: string
  title: string
  duration: string
  level: string
  sessions: number
  /** Brouillon : Perso | Krid (fork catalogue). */
  origin?: 'own' | 'krid'
}

export type ProgramsHubSendOption = {
  id: string
  label: string
}

function displayName(c: {
  first_name: string | null
  last_name: string | null
  email: string
}) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function addWeeksLabel(startIso: string | null, duration: string | null) {
  if (!startIso || !duration) return '—'
  const m = duration.match(/(\d+)\s*sem/i)
  if (!m) return '—'
  const weeks = Number(m[1])
  if (!Number.isFinite(weeks) || weeks <= 0) return '—'
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return '—'
  d.setDate(d.getDate() + weeks * 7)
  return formatDate(d.toISOString())
}

async function loadSessionCountsByProgram(
  supabase: SupabaseClient,
  programIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!programIds.length) return out
  const { data: weeks, error } = await supabase
    .from('program_weeks')
    .select('program_id, sessions(id)')
    .in('program_id', programIds)
  if (error) throw new Error(error.message)
  for (const w of weeks ?? []) {
    const pid = w.program_id as string
    const n = Array.isArray(w.sessions) ? w.sessions.length : 0
    out.set(pid, (out.get(pid) ?? 0) + n)
  }
  return out
}

type ProgramEmbed = {
  title: string | null
  duration: string | null
} | null

type ClientEmbed = {
  first_name: string | null
  last_name: string | null
  email: string
} | null

/** Séances terminées (plan) comptent ; libre DIY non. */
const DONE_STYLES = new Set(['fait', 'fait_edite'])

function progressPct(done: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((done / total) * 100))
}

/** Plans actifs groupés par programme — sous-lignes = clients (1 plan / client). */
export async function loadProgramsEncours(
  supabase: SupabaseClient,
  coachId: string,
): Promise<ProgramsHubEncoursRow[]> {
  // FK explicite : source_program_id (instance) — template_program_id crée une 2ᵉ relation.
  let encoursQ = await supabase
    .from('client_fitness_plans')
    .select(
      'id, status, start_date, created_at, source_program_id, template_program_id, client_id, programs!client_fitness_plans_source_program_id_fkey(title, duration), clients(first_name, last_name, email)',
    )
    .eq('coach_id', coachId)
    .in('status', ['waiting', 'started', 'paused'])
    .not('source_program_id', 'is', null)
    .order('created_at', { ascending: false })

  if (
    encoursQ.error &&
    /template_program_id|more than one relationship|Could not embed/i.test(
      encoursQ.error.message,
    )
  ) {
    encoursQ = (await supabase
      .from('client_fitness_plans')
      .select(
        'id, status, start_date, created_at, source_program_id, client_id, programs!client_fitness_plans_source_program_id_fkey(title, duration), clients(first_name, last_name, email)',
      )
      .eq('coach_id', coachId)
      .in('status', ['waiting', 'started', 'paused'])
      .not('source_program_id', 'is', null)
      .order('created_at', { ascending: false })) as typeof encoursQ
  }

  if (encoursQ.error) throw new Error(encoursQ.error.message)

  const planRows = encoursQ.data ?? []
  const planIds = planRows.map((r) => r.id as string)
  const programIds = [
    ...new Set(
      planRows
        .map((r) => r.source_program_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  const sessionTotalByProgram = await loadSessionCountsByProgram(supabase, programIds)

  /** Séances plan faites par plan_id (source_session_id uniques, hors libre). */
  const doneByPlan = new Map<string, Set<string>>()
  if (planIds.length) {
    const { data: runs, error: rErr } = await supabase
      .from('session_runs')
      .select('plan_id, source_session_id, style, source')
      .eq('coach_id', coachId)
      .in('plan_id', planIds)
      .not('source_session_id', 'is', null)
    if (rErr) throw new Error(rErr.message)
    for (const run of runs ?? []) {
      const planId = run.plan_id as string | null
      const sid = run.source_session_id as string | null
      const style = String(run.style ?? '')
      const source = String(run.source ?? 'plan')
      if (!planId || !sid) continue
      if (source === 'libre') continue
      if (!DONE_STYLES.has(style)) continue
      let set = doneByPlan.get(planId)
      if (!set) {
        set = new Set()
        doneByPlan.set(planId, set)
      }
      set.add(sid)
    }
  }

  type Acc = {
    programId: string
    title: string
    duration: string | null
    clients: ProgramsHubEncoursClient[]
    /** created_at des plans = 1ʳᵉ affectation. */
    assignedIsos: string[]
  }

  const byProgram = new Map<string, Acc>()

  for (const row of planRows) {
    const instanceId = row.source_program_id as string | null
    if (!instanceId) continue
    const templateId =
      ((row as { template_program_id?: string | null }).template_program_id as
        | string
        | null) || instanceId
    // Groupe hub = template ; progress = instance (séances de la copie client).
    const programId = templateId

    const program = row.programs as unknown as ProgramEmbed
    const client = row.clients as unknown as ClientEmbed
    const assignedIso = row.created_at as string
    const startIso = (row.start_date ?? row.created_at) as string
    const label = client ? displayName(client) : 'Client'
    const total = sessionTotalByProgram.get(instanceId) ?? 0
    const done = doneByPlan.get(row.id as string)?.size ?? 0

    let acc = byProgram.get(programId)
    if (!acc) {
      acc = {
        programId,
        title: program?.title?.trim() || 'Programme',
        duration: program?.duration ?? null,
        clients: [],
        assignedIsos: [],
      }
      byProgram.set(programId, acc)
    }

    if (!acc.clients.some((c) => c.planId === row.id)) {
      acc.clients.push({
        planId: row.id,
        clientId: row.client_id,
        label,
        status: row.status,
        start: formatDate(startIso),
        end: addWeeksLabel(startIso, program?.duration ?? acc.duration),
        progress: progressPct(done, total),
      })
    }
    if (assignedIso) acc.assignedIsos.push(assignedIso)
  }

  // Titres groupe = template hub (pas le titre instance « · Client »).
  const groupIds = [...byProgram.keys()]
  if (groupIds.length) {
    const { data: titles } = await supabase
      .from('programs')
      .select('id, title, duration')
      .in('id', groupIds)
    for (const t of titles ?? []) {
      const acc = byProgram.get(t.id as string)
      if (!acc) continue
      acc.title = (t.title as string | null)?.trim() || acc.title
      if (t.duration) acc.duration = t.duration as string
    }
  }

  return Array.from(byProgram.values()).map((acc) => {
    const earliestAssigned = [...acc.assignedIsos].sort()[0] ?? null
    const startedCount = acc.clients.filter((c) => c.status === 'started').length
    const avgProgress =
      acc.clients.length > 0
        ? Math.round(
            acc.clients.reduce((sum, c) => sum + c.progress, 0) / acc.clients.length,
          )
        : 0
    return {
      id: acc.programId,
      programId: acc.programId,
      title: acc.title,
      startedCount,
      avgProgress,
      clientCount: acc.clients.length,
      onlineAt: formatDate(earliestAssigned),
      clients: acc.clients,
    }
  })
}

/** Templates coach (Ma biblio programmes) + parent/enfant + compteurs. */
export async function loadProgramsTemplates(
  supabase: SupabaseClient,
  coachId: string,
): Promise<ProgramsHubTemplateRow[]> {
  let programsQ = await supabase
    .from('programs')
    .select('id, title, level, duration, updated_at, parent_program_id')
    .eq('coach_id', coachId)
    .eq('is_trainly_catalog', false)
    .eq('is_template', true)
    .eq('is_client_instance', false)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (
    programsQ.error &&
    /parent_program_id|is_client_instance/i.test(programsQ.error.message)
  ) {
    programsQ = await supabase
      .from('programs')
      .select('id, title, level, duration, updated_at, parent_program_id')
      .eq('coach_id', coachId)
      .eq('is_trainly_catalog', false)
      .eq('is_template', true)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
    if (programsQ.error && /parent_program_id/i.test(programsQ.error.message)) {
      programsQ = (await supabase
        .from('programs')
        .select('id, title, level, duration, updated_at')
        .eq('coach_id', coachId)
        .eq('is_trainly_catalog', false)
        .eq('is_template', true)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })) as typeof programsQ
    }
  }

  const [{ data: plans, error: plErr }, { data: prestas, error: prErr }] = await Promise.all([
    supabase
      .from('client_fitness_plans')
      .select('source_program_id, template_program_id, status')
      .eq('coach_id', coachId)
      .not('source_program_id', 'is', null),
    supabase
      .from('prestations')
      .select('program_template_id, program_template_ids')
      .eq('coach_id', coachId)
      .is('deleted_at', null),
  ])

  if (programsQ.error) throw new Error(programsQ.error.message)
  if (plErr) throw new Error(plErr.message)
  if (prErr) throw new Error(prErr.message)

  // Compteurs « Clients » = plans actifs seulement (aligné En cours).
  const clientCounts = new Map<string, number>()
  const activePlanIds = new Set<string>()
  for (const p of plans ?? []) {
    const st = String(p.status ?? '')
    if (st !== 'waiting' && st !== 'started' && st !== 'paused') continue
    const templateId =
      ((p as { template_program_id?: string | null }).template_program_id as
        | string
        | null) || (p.source_program_id as string | null)
    if (!templateId) continue
    clientCounts.set(templateId, (clientCounts.get(templateId) ?? 0) + 1)
    activePlanIds.add(templateId)
  }

  const prestaCounts = new Map<string, number>()
  for (const pr of prestas ?? []) {
    const ids = new Set<string>()
    if (pr.program_template_id) ids.add(pr.program_template_id)
    for (const id of pr.program_template_ids ?? []) {
      if (id) ids.add(id)
    }
    for (const id of ids) {
      prestaCounts.set(id, (prestaCounts.get(id) ?? 0) + 1)
    }
  }

  type Prog = {
    id: string
    title: string | null
    level: string | null
    duration: string | null
    updated_at: string | null
    parent_program_id?: string | null
  }
  const programs = (programsQ.data ?? []) as Prog[]
  const ids = programs.map((p) => p.id)
  const sessionCounts = await loadSessionCountsByProgram(supabase, ids)

  const byId = new Map(programs.map((p) => [p.id, p]))
  const childrenByParent = new Map<string, Prog[]>()
  for (const p of programs) {
    const parentId = p.parent_program_id?.trim() || null
    if (!parentId || !byId.has(parentId) || parentId === p.id) continue
    const list = childrenByParent.get(parentId) ?? []
    list.push(p)
    childrenByParent.set(parentId, list)
  }

  const roots = programs.filter((p) => {
    const parentId = p.parent_program_id?.trim() || null
    return !parentId || !byId.has(parentId) || parentId === p.id
  })

  function canMove(id: string, hasChildren: boolean) {
    if (hasChildren) return false
    if ((prestaCounts.get(id) ?? 0) > 0) return false
    if (activePlanIds.has(id)) return false
    return true
  }

  return roots.map((p) => {
    const kids = (childrenByParent.get(p.id) ?? []).map((c) => ({
      id: c.id,
      title: c.title?.trim() || 'Sans titre',
      durationLabel: c.duration?.trim() || '—',
      level: c.level?.trim() || '—',
      sessions: sessionCounts.get(c.id) ?? 0,
      prestas: prestaCounts.get(c.id) ?? 0,
      clients: clientCounts.get(c.id) ?? 0,
      canMoveToDraft: canMove(c.id, false),
    }))
    const hasKids = kids.length > 0
    const kidsClients = kids.reduce((sum, c) => sum + c.clients, 0)
    const kidsPrestas = kids.reduce((sum, c) => sum + c.prestas, 0)
    return {
      id: p.id,
      title: p.title?.trim() || 'Sans titre',
      durationLabel: p.duration?.trim() || '—',
      level: p.level?.trim() || '—',
      sessions: sessionCounts.get(p.id) ?? 0,
      // Feuille → directs · Parent → somme des enfants.
      prestas: hasKids ? kidsPrestas : (prestaCounts.get(p.id) ?? 0),
      clients: hasKids ? kidsClients : (clientCounts.get(p.id) ?? 0),
      children: kids,
      canMoveToDraft: canMove(p.id, hasKids),
    }
  })
}

/** Catalogue Krid publié (forkable). */
export async function loadProgramsCatalogue(
  supabase: SupabaseClient,
): Promise<ProgramsHubSimpleRow[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, title, level, duration')
    .eq('is_trainly_catalog', true)
    .eq('catalog_status', 'published')
    .is('deleted_at', null)
    .order('title', { ascending: true })

  if (error) throw new Error(error.message)

  const ids = (data ?? []).map((p) => p.id as string)
  const sessionCounts = await loadSessionCountsByProgram(supabase, ids)

  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title?.trim() || 'Sans titre',
    duration: p.duration?.trim() || '—',
    level: p.level?.trim() || '—',
    sessions: sessionCounts.get(p.id) ?? 0,
  }))
}

/** Brouillons coach = programmes non-template. */
export async function loadProgramsBrouillons(
  supabase: SupabaseClient,
  coachId: string,
): Promise<ProgramsHubSimpleRow[]> {
  let q = await supabase
    .from('programs')
    .select('id, title, level, duration, updated_at, source_kind')
    .eq('coach_id', coachId)
    .eq('is_trainly_catalog', false)
    .eq('is_template', false)
    .eq('is_client_instance', false)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  // Colonnes optionnelles absentes.
  if (q.error && /source_kind|is_client_instance/i.test(q.error.message)) {
    q = (await supabase
      .from('programs')
      .select('id, title, level, duration, updated_at')
      .eq('coach_id', coachId)
      .eq('is_trainly_catalog', false)
      .eq('is_template', false)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })) as typeof q
  }

  if (q.error) throw new Error(q.error.message)

  const data = q.data ?? []
  const ids = data.map((p) => p.id as string)
  const sessionCounts = await loadSessionCountsByProgram(supabase, ids)

  return data.map((p) => {
    const kind = (p as { source_kind?: string | null }).source_kind
    return {
      id: p.id,
      title: p.title?.trim() || 'Sans titre',
      duration: p.duration?.trim() || '—',
      level: p.level?.trim() || '—',
      sessions: sessionCounts.get(p.id) ?? 0,
      origin: kind === 'krid' ? 'krid' : 'own',
    }
  })
}

/** Options popup Envoyer (client multi · groupe · presta). */
export async function loadProgramsSendOptions(
  supabase: SupabaseClient,
  coachId: string,
): Promise<{
  clients: ProgramsHubSendOption[]
  groups: ProgramsHubSendOption[]
  prestas: ProgramsHubSendOption[]
}> {
  const [
    { data: clients, error: cErr },
    { data: groups, error: gErr },
    { data: prestas, error: pErr },
  ] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, last_name, email, status')
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('first_name', { ascending: true }),
    supabase
      .from('client_groups')
      .select('id, name, type')
      .eq('coach_id', coachId)
      .in('type', ['manual', 'linked'])
      .order('name', { ascending: true }),
    supabase
      .from('prestations')
      .select('id, name')
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  if (cErr) throw new Error(cErr.message)
  if (gErr) throw new Error(gErr.message)
  if (pErr) throw new Error(pErr.message)

  return {
    clients: (clients ?? []).map((c) => ({
      id: c.id,
      label: displayName(c),
    })),
    groups: (groups ?? []).map((g) => ({
      id: g.id,
      label:
        (g.name?.trim() || 'Groupe') +
        (g.type === 'linked' ? ' · lié presta' : ''),
    })),
    prestas: (prestas ?? []).map((p) => ({
      id: p.id,
      label: p.name?.trim() || 'Presta',
    })),
  }
}
