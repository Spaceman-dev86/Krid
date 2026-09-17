import { parseStructure } from '../nutrition/plans'

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
    .select('id, program_template_id, nutrition_template_id, drive_folder_id, modules')
    .eq('id', opts.prestationId)
    .eq('coach_id', opts.coachId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!presta) return result

  if (presta.program_template_id) {
    const { data: existing } = await supabase
      .from('client_fitness_plans')
      .select('id')
      .eq('client_id', opts.clientId)
      .eq('coach_id', opts.coachId)
      .eq('source_program_id', presta.program_template_id)
      .in('status', ['waiting', 'started', 'paused'])
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const { data: program } = await supabase
        .from('programs')
        .select('id, is_calendar, start_date')
        .eq('id', presta.program_template_id)
        .eq('coach_id', opts.coachId)
        .is('deleted_at', null)
        .maybeSingle()

      if (program) {
        const { error } = await supabase.from('client_fitness_plans').insert({
          client_id: opts.clientId,
          coach_id: opts.coachId,
          source_program_id: program.id,
          status: 'waiting',
          is_calendar: program.is_calendar ?? false,
          start_date: program.start_date ?? null,
        })
        if (!error) result.fitnessPlanCreated = true
      }
    }
  }

  if (presta.nutrition_template_id) {
    const { data: existing } = await supabase
      .from('client_nutrition_plans')
      .select('id')
      .eq('client_id', opts.clientId)
      .eq('coach_id', opts.coachId)
      .eq('source_plan_id', presta.nutrition_template_id)
      .in('status', ['waiting', 'started', 'paused'])
      .limit(1)
      .maybeSingle()

    if (!existing) {
      const { data: plan } = await supabase
        .from('nutrition_plans')
        .select('id, title, structure')
        .eq('id', presta.nutrition_template_id)
        .eq('coach_id', opts.coachId)
        .is('deleted_at', null)
        .maybeSingle()

      if (plan) {
        const { error } = await supabase.from('client_nutrition_plans').insert({
          client_id: opts.clientId,
          coach_id: opts.coachId,
          source_plan_id: plan.id,
          title: plan.title,
          status: 'waiting',
          snapshot: parseStructure(plan.structure),
        })
        if (!error) result.nutritionPlanCreated = true
      }
    }
  }

  if (presta.drive_folder_id) {
    const { data: folder } = await supabase
      .from('drive_folders')
      .select('id')
      .eq('id', presta.drive_folder_id)
      .eq('coach_id', opts.coachId)
      .is('deleted_at', null)
      .maybeSingle()

    if (folder) {
      const { error } = await supabase.from('drive_shares').insert({
        coach_id: opts.coachId,
        folder_id: folder.id,
        client_id: opts.clientId,
      })
      if (!error || /duplicate|unique/i.test(error.message)) {
        result.driveShared = true
      }
    }
  }

  return result
}
