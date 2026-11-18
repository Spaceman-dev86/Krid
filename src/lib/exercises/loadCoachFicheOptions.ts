import type { SupabaseClient } from '@supabase/supabase-js'

import { seedCoachTags } from '@/src/lib/tags/seedCoachTags'

export type FicheTypeOption = { id: string; label: string }
export type FicheSportOption = { id: string; label: string }
export type FicheCandidate = {
  id: string
  name: string
  exercise_type_id: string | null
  sport_id: string | null
}

/** Types / sports du coach (copies seedées) + candidats ponts = Krid publié + Ma biblio. */
export async function loadCoachFicheOptions(supabase: SupabaseClient, coachId: string) {
  await seedCoachTags(supabase, coachId)

  const [{ data: typesRaw }, { data: sportsRaw }, { data: kridRaw }, { data: mineRaw }] =
    await Promise.all([
      supabase
        .from('exercise_types' as never)
        .select('id, label')
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('sports' as never)
        .select('id, label')
        .eq('coach_id' as never, coachId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('exercise_library')
        .select('id, name, exercise_type_id, sport_id')
        .is('coach_id', null)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('name', { ascending: true })
        .limit(500),
      supabase
        .from('exercise_library')
        .select('id, name, exercise_type_id, sport_id')
        .eq('coach_id', coachId)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('name', { ascending: true })
        .limit(500),
    ])

  const types = (typesRaw ?? []) as FicheTypeOption[]
  const sports = (sportsRaw ?? []) as FicheSportOption[]
  const byId = new Map<string, FicheCandidate>()
  for (const row of [...((kridRaw ?? []) as FicheCandidate[]), ...((mineRaw ?? []) as FicheCandidate[])]) {
    byId.set(row.id, row)
  }
  const candidates = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return { types, sports, candidates }
}
