/**
 * Groupes liés à une presta (type=linked) — sync roster depuis grants actifs.
 * Groupes libres (manual) : pas de sync.
 */

// Client supabase volontairement large : appelle aussi bien le client SSR typé que le service role.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/** Ajoute le client au groupe lié Soft s’il existe (sauf exclusion sticky). */
export async function ensureClientInLinkedGroup(
  supabase: Db,
  opts: { coachId: string; clientId: string; prestationId: string }
) {
  const { data: group } = await supabase
    .from('client_groups')
    .select('id')
    .eq('coach_id', opts.coachId)
    .eq('type', 'linked')
    .eq('prestation_id', opts.prestationId)
    .maybeSingle()

  if (!group?.id) return

  const { data: excluded } = await supabase
    .from('client_group_exclusions')
    .select('client_id')
    .eq('group_id', group.id)
    .eq('client_id', opts.clientId)
    .maybeSingle()

  if (excluded) {
    // Repay / nouveau grant actif → clear exclusion puis add
    await supabase
      .from('client_group_exclusions')
      .delete()
      .eq('group_id', group.id)
      .eq('client_id', opts.clientId)
  }

  const { error } = await supabase.from('client_group_members').insert({
    group_id: group.id,
    client_id: opts.clientId,
  })
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw error
  }

  // Contenus déjà envoyés depuis le groupe → aussi pour ce nouveau membre
  try {
    await pushGroupCatalogToClient(supabase, {
      coachId: opts.coachId,
      groupId: group.id,
      clientId: opts.clientId,
    })
  } catch {
    /* non-bloquant */
  }
}

/** Backfill tous les grants actifs de la presta dans le groupe lié. */
export async function backfillLinkedGroupMembers(
  supabase: Db,
  opts: { coachId: string; groupId: string; prestationId: string }
) {
  const { data: grants } = await supabase
    .from('client_grants')
    .select('client_id')
    .eq('coach_id', opts.coachId)
    .eq('prestation_id', opts.prestationId)
    .eq('status', 'active')

  const clientIds = [...new Set((grants ?? []).map((g: { client_id: string }) => g.client_id).filter(Boolean))]
  if (!clientIds.length) return { added: 0 }

  const { data: exclusions } = await supabase
    .from('client_group_exclusions')
    .select('client_id')
    .eq('group_id', opts.groupId)

  const blocked = new Set((exclusions ?? []).map((e: { client_id: string }) => e.client_id))
  const toAdd = clientIds.filter((id) => !blocked.has(id))

  let added = 0
  for (const clientId of toAdd) {
    const { error } = await supabase.from('client_group_members').insert({
      group_id: opts.groupId,
      client_id: clientId,
    })
    const ok = !error || /duplicate|unique/i.test(error.message)
    if (ok) {
      added += 1
      if (!error) {
        try {
          await pushGroupCatalogToClient(supabase, {
            coachId: opts.coachId,
            groupId: opts.groupId,
            clientId: String(clientId),
          })
        } catch {
          /* non-bloquant */
        }
      }
    }
  }
  return { added }
}

/**
 * Coach retire un membre d’un groupe lié :
 * delete member + exclusion sticky (revient au repay).
 */
export async function excludeClientFromLinkedGroup(
  supabase: Db,
  opts: { groupId: string; clientId: string }
) {
  await supabase
    .from('client_group_members')
    .delete()
    .eq('group_id', opts.groupId)
    .eq('client_id', opts.clientId)

  await supabase.from('client_group_exclusions').upsert({
    group_id: opts.groupId,
    client_id: opts.clientId,
  })
}

/** Client a-t-il un grant actif sur la presta du groupe lié ? */
export async function clientHasActiveGrantForGroup(
  supabase: Db,
  opts: { coachId: string; clientId: string; prestationId: string }
): Promise<boolean> {
  const { data } = await supabase
    .from('client_grants')
    .select('id')
    .eq('coach_id', opts.coachId)
    .eq('client_id', opts.clientId)
    .eq('prestation_id', opts.prestationId)
    .eq('status', 'active')
    .maybeSingle()
  return Boolean(data?.id)
}

/**
 * Audience envoi groupe : manual = tous les membres ;
 * linked = grants actifs seulement (alumni exclus par défaut).
 */
export async function resolveGroupAudienceClientIds(
  supabase: Db,
  opts: { coachId: string; groupIds: string[]; includeAlumni?: boolean }
): Promise<{ clientIds: string[]; clientToGroup: Map<string, string> }> {
  const clientToGroup = new Map<string, string>()
  if (!opts.groupIds.length) return { clientIds: [], clientToGroup }

  const { data: groups } = await supabase
    .from('client_groups')
    .select('id, type, prestation_id')
    .eq('coach_id', opts.coachId)
    .in('id', opts.groupIds)
    .in('type', ['manual', 'linked'])

  type GroupMeta = { id: string; type: string; prestation_id: string | null }
  const groupMeta = new Map<string, GroupMeta>(
    ((groups ?? []) as GroupMeta[]).map((g) => [g.id, g]),
  )
  const validIds = [...groupMeta.keys()]
  if (!validIds.length) return { clientIds: [], clientToGroup }

  const { data: members } = await supabase
    .from('client_group_members')
    .select('client_id, group_id')
    .in('group_id', validIds)

  const byGroup = new Map<string, string[]>()
  for (const m of (members ?? []) as { client_id: string; group_id: string }[]) {
    const list = byGroup.get(m.group_id) ?? []
    list.push(m.client_id)
    byGroup.set(m.group_id, list)
  }

  const includeAlumni = Boolean(opts.includeAlumni)
  const out = new Set<string>()

  for (const groupId of validIds) {
    const meta = groupMeta.get(groupId)!
    let ids = byGroup.get(groupId) ?? []
    if (meta.type === 'linked' && meta.prestation_id && !includeAlumni) {
      const { data: grants } = await supabase
        .from('client_grants')
        .select('client_id')
        .eq('coach_id', opts.coachId)
        .eq('prestation_id', meta.prestation_id)
        .eq('status', 'active')
        .in('client_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
      const actifs = new Set((grants ?? []).map((g: { client_id: string }) => g.client_id))
      ids = ids.filter((id) => actifs.has(id))
    }
    for (const clientId of ids) {
      out.add(clientId)
      if (!clientToGroup.has(clientId)) clientToGroup.set(clientId, groupId)
    }
  }

  return { clientIds: [...out], clientToGroup }
}

/**
 * Fin de grant → alumni : reste dans le groupe lié (chat),
 * perd kit Drive presta + plans issus de la presta.
 * Le Drive collectif groupe est coupé via RLS (actifs only).
 */
export async function applyAlumniOnGrantEnd(
  supabase: Db,
  opts: { coachId: string; clientId: string; prestationId: string }
) {
  const { data: presta } = await supabase
    .from('prestations')
    .select(
      'id, program_template_id, program_template_ids, nutrition_template_id, nutrition_template_ids, drive_folder_id, drive_folder_ids',
    )
    .eq('id', opts.prestationId)
    .eq('coach_id', opts.coachId)
    .maybeSingle()

  if (!presta) return

  const { resolveProgramIds, resolveNutritionIds, resolveDriveIds } = await import(
    '../prestations/contentLinks'
  )

  const driveIds = resolveDriveIds(presta)
  if (driveIds.length) {
    await supabase
      .from('drive_shares')
      .delete()
      .eq('coach_id', opts.coachId)
      .eq('client_id', opts.clientId)
      .in('folder_id', driveIds)
  }

  const now = new Date().toISOString()
  const { endActivePlansForTemplate } = await import(
    '../programs/createClientProgramInstance'
  )

  for (const templateId of resolveProgramIds(presta)) {
    await endActivePlansForTemplate(supabase, {
      coachId: opts.coachId,
      clientId: opts.clientId,
      templateId,
    })
  }

  for (const nutritionId of resolveNutritionIds(presta)) {
    await supabase
      .from('client_nutrition_plans')
      .update({ status: 'done', updated_at: now })
      .eq('coach_id', opts.coachId)
      .eq('client_id', opts.clientId)
      .eq('source_plan_id', nutritionId)
      .in('status', ['waiting', 'started', 'paused'])
  }
}

/**
 * Push un programme vers une liste de clients.
 * mode add = crée si absent · replace = termine l’existant puis recrée.
 * Chaque client reçoit une photocopie (instance) éditable.
 */
export async function pushProgramToClients(
  supabase: Db,
  opts: {
    coachId: string
    clientIds: string[]
    programId: string
    mode?: 'add' | 'replace'
  }
): Promise<{ pushed: number }> {
  const { assignProgramTemplateToClient } = await import('../programs/createClientProgramInstance')

  const clientIds = [...new Set(opts.clientIds.filter(Boolean))]
  if (!clientIds.length) return { pushed: 0 }

  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('id', opts.programId)
    .eq('coach_id', opts.coachId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!program) return { pushed: 0 }

  let pushed = 0
  for (const clientId of clientIds) {
    const result = await assignProgramTemplateToClient(supabase as never, {
      coachId: opts.coachId,
      clientId,
      templateId: program.id,
      mode: opts.mode ?? 'add',
    })
    if (result.ok) pushed += 1
  }

  return { pushed }
}

/** Push un plan nutrition vers une liste de clients (add = si absent). */
export async function pushNutritionToClients(
  supabase: Db,
  opts: {
    coachId: string
    clientIds: string[]
    nutritionPlanId: string
  }
): Promise<{ pushed: number }> {
  const clientIds = [...new Set(opts.clientIds.filter(Boolean))]
  if (!clientIds.length) return { pushed: 0 }

  const { data: plan } = await supabase
    .from('nutrition_plans')
    .select('id, title, structure')
    .eq('id', opts.nutritionPlanId)
    .eq('coach_id', opts.coachId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!plan) return { pushed: 0 }

  const { parseStructure } = await import('../nutrition/plans')
  const snapshot = parseStructure(plan.structure)

  let pushed = 0
  for (const clientId of clientIds) {
    const { data: existing } = await supabase
      .from('client_nutrition_plans')
      .select('id')
      .eq('coach_id', opts.coachId)
      .eq('client_id', clientId)
      .eq('source_plan_id', plan.id)
      .in('status', ['waiting', 'started', 'paused'])
      .limit(1)
      .maybeSingle()
    if (existing) continue

    const { error } = await supabase.from('client_nutrition_plans').insert({
      client_id: clientId,
      coach_id: opts.coachId,
      source_plan_id: plan.id,
      title: plan.title,
      status: 'waiting',
      snapshot,
    })
    if (!error) pushed += 1
  }

  return { pushed }
}

/** Push vers les grants actifs d’une presta. */
export async function pushProgramToActiveGrants(
  supabase: Db,
  opts: {
    coachId: string
    prestationId: string
    programId: string
    mode?: 'add' | 'replace'
  }
): Promise<{ pushed: number }> {
  const { data: grants } = await supabase
    .from('client_grants')
    .select('client_id')
    .eq('coach_id', opts.coachId)
    .eq('prestation_id', opts.prestationId)
    .eq('status', 'active')

  const clientIds = [
    ...new Set(
      ((grants ?? []) as { client_id: string }[])
        .map((g) => g.client_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  return pushProgramToClients(supabase, {
    coachId: opts.coachId,
    clientIds,
    programId: opts.programId,
    mode: opts.mode,
  })
}

/** Termine les plans fitness actifs issus d’un programme (audience groupe). */
export async function endProgramForClients(
  supabase: Db,
  opts: { coachId: string; clientIds: string[]; programId: string }
): Promise<{ ended: number }> {
  const clientIds = [...new Set(opts.clientIds.filter(Boolean))]
  if (!clientIds.length) return { ended: 0 }
  const now = new Date().toISOString()
  const { data: byTemplate } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now })
    .eq('coach_id', opts.coachId)
    .eq('template_program_id', opts.programId)
    .in('client_id', clientIds)
    .in('status', ['waiting', 'started', 'paused'])
    .select('id')
  const { data: legacy } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'done', updated_at: now })
    .eq('coach_id', opts.coachId)
    .eq('source_program_id', opts.programId)
    .in('client_id', clientIds)
    .in('status', ['waiting', 'started', 'paused'])
    .select('id')
  const ids = new Set([
    ...((byTemplate ?? []) as { id: string }[]).map((r) => r.id),
    ...((legacy ?? []) as { id: string }[]).map((r) => r.id),
  ])
  return { ended: ids.size }
}

/** Termine les plans nutrition actifs issus d’un plan catalogue. */
export async function endNutritionForClients(
  supabase: Db,
  opts: { coachId: string; clientIds: string[]; nutritionPlanId: string }
): Promise<{ ended: number }> {
  const clientIds = [...new Set(opts.clientIds.filter(Boolean))]
  if (!clientIds.length) return { ended: 0 }
  const now = new Date().toISOString()
  const { data } = await supabase
    .from('client_nutrition_plans')
    .update({ status: 'done', updated_at: now })
    .eq('coach_id', opts.coachId)
    .eq('source_plan_id', opts.nutritionPlanId)
    .in('client_id', clientIds)
    .in('status', ['waiting', 'started', 'paused'])
    .select('id')
  return { ended: (data ?? []).length }
}

/**
 * Applique le catalogue « contenus envoyés » du groupe à un client
 * (nouveaux membres / sync linked).
 */
export async function pushGroupCatalogToClient(
  supabase: Db,
  opts: { coachId: string; groupId: string; clientId: string }
): Promise<void> {
  const { data: rows } = await supabase
    .from('client_group_pushed_content')
    .select('kind, content_id')
    .eq('group_id', opts.groupId)

  for (const row of rows ?? []) {
    if (row.kind === 'nutrition') {
      await pushNutritionToClients(supabase, {
        coachId: opts.coachId,
        clientIds: [opts.clientId],
        nutritionPlanId: row.content_id,
      })
    } else {
      await pushProgramToClients(supabase, {
        coachId: opts.coachId,
        clientIds: [opts.clientId],
        programId: row.content_id,
        mode: 'add',
      })
    }
  }
}
