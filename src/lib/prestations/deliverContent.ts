import { ensureClientInLinkedGroup, pushNutritionToClients } from '../coach/linkedGroups'
import { assignProgramTemplateToClient } from '../programs/createClientProgramInstance'
import {
  resolveDriveIds,
  resolveNutritionIds,
  resolveProgramIds,
} from './contentLinks'

type SupabaseLike = {
  from: (table: string) => any
}

export type DeliverPrestationContentResult = {
  fitnessPlanCreated: boolean
  nutritionPlanCreated: boolean
  driveShared: boolean
}

/**
 * Au Payé / Accorder : pousse le contenu lié à la presta.
 * Achat ≠ démarrage — plans créés en `waiting`.
 * Idempotent : ne re-crée pas si un plan waiting|started|paused existe déjà
 * pour le même template, ni un partage Drive déjà présent.
 */
export async function deliverPrestationContentOnPaid(
  supabase: SupabaseLike,
  opts: {
    coachId: string
    clientId: string
    prestationId: string
  }
): Promise<DeliverPrestationContentResult> {
  const result: DeliverPrestationContentResult = {
    fitnessPlanCreated: false,
    nutritionPlanCreated: false,
    driveShared: false,
  }

  const { data: presta } = await supabase
    .from('prestations')
    .select(
      'id, program_template_id, nutrition_template_id, drive_folder_id, program_template_ids, nutrition_template_ids, drive_folder_ids, modules',
    )
    .eq('id', opts.prestationId)
    .eq('coach_id', opts.coachId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta) return result

  const programIds = resolveProgramIds(presta)
  for (const programId of programIds) {
    const assigned = await assignProgramTemplateToClient(supabase as never, {
      coachId: opts.coachId,
      clientId: opts.clientId,
      templateId: programId,
    })
    if (assigned.ok) result.fitnessPlanCreated = true
  }

  const nutritionIds = resolveNutritionIds(presta)
  for (const planId of nutritionIds) {
    const { pushed } = await pushNutritionToClients(supabase, {
      coachId: opts.coachId,
      clientIds: [opts.clientId],
      nutritionPlanId: planId,
    })
    if (pushed > 0) result.nutritionPlanCreated = true
  }

  const driveIds = resolveDriveIds(presta)
  for (const folderId of driveIds) {
    const { data: folder } = await supabase
      .from('drive_folders')
      .select('id')
      .eq('id', folderId)
      .eq('coach_id', opts.coachId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!folder) continue

    const { error } = await supabase.from('drive_shares').insert({
      coach_id: opts.coachId,
      folder_id: folder.id,
      client_id: opts.clientId,
    })
    if (!error || /duplicate|unique/i.test(error.message)) {
      result.driveShared = true
    }
  }

  try {
    await ensureClientInLinkedGroup(supabase, {
      coachId: opts.coachId,
      clientId: opts.clientId,
      prestationId: opts.prestationId,
    })
  } catch {
    /* non-bloquant */
  }

  return result
}
