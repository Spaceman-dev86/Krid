'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'
import { slugUnitKey } from '@/src/lib/tags/slugUnitKey'

export type TagsTab = 'sports' | 'types' | 'units'

function tabFrom(formData: FormData): TagsTab {
  const t = String(formData.get('tab') ?? '').trim()
  if (t === 'types' || t === 'units') return t
  return 'sports'
}

function dest(tab: TagsTab, qs?: string) {
  return `/exercises/tags?tab=${tab}${qs ? `&${qs}` : ''}`
}

function revalidateTags() {
  revalidatePath('/exercises/tags')
  revalidatePath('/exercises')
  revalidatePath('/exercises/blocks')
}

function uniqueMsg(err: string) {
  return /unique|duplicate/i.test(err) ? 'Ce libellé existe déjà.' : err
}

export async function createCoachSportAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const label = String(formData.get('label') ?? '').trim()
  if (!label) redirect(dest('sports', 'error=' + encodeURIComponent('Nom requis')))
  const { error } = await supabase.from('sports' as never).insert({
    coach_id: userId,
    label,
  } as never)
  if (error) redirect(dest('sports', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('sports', 'saved=1'))
}

export async function renameCoachSportAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) redirect(dest('sports', 'error=' + encodeURIComponent('Nom requis')))
  const { error } = await supabase
    .from('sports' as never)
    .update({ label, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)
  if (error) redirect(dest('sports', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('sports', 'saved=1'))
}

export async function archiveCoachSportAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(dest('sports'))

  const [{ count: exoCount }, { count: blockCount }] = await Promise.all([
    supabase
      .from('exercise_library')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', userId)
      .eq('sport_id', id)
      .is('deleted_at', null),
    supabase
      .from('block_library' as never)
      .select('id', { count: 'exact', head: true })
      .eq('coach_id' as never, userId as never)
      .eq('sport_id' as never, id as never)
      .is('deleted_at' as never, null),
  ])
  const usage = (exoCount ?? 0) + (blockCount ?? 0)
  if (usage > 0) {
    redirect(
      dest(
        'sports',
        'error=' +
          encodeURIComponent(
            `Impossible d’archiver : encore utilisé sur ${usage} fiche(s). Réassigne d’abord.`,
          ),
      ),
    )
  }

  const { error } = await supabase
    .from('sports' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
  if (error) redirect(dest('sports', 'error=' + encodeURIComponent(error.message)))
  revalidateTags()
  redirect(dest('sports', 'deleted=1'))
}

export async function createCoachTypeAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const label = String(formData.get('label') ?? '').trim()
  if (!label) redirect(dest('types', 'error=' + encodeURIComponent('Nom requis')))
  const { error } = await supabase.from('exercise_types' as never).insert({
    coach_id: userId,
    label,
  } as never)
  if (error) redirect(dest('types', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('types', 'saved=1'))
}

export async function renameCoachTypeAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  if (!id || !label) redirect(dest('types', 'error=' + encodeURIComponent('Nom requis')))
  const { error } = await supabase
    .from('exercise_types' as never)
    .update({ label, updated_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)
  if (error) redirect(dest('types', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('types', 'saved=1'))
}

export async function archiveCoachTypeAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(dest('types'))

  const { count } = await supabase
    .from('exercise_library')
    .select('id', { count: 'exact', head: true })
    .eq('coach_id', userId)
    .eq('exercise_type_id', id)
    .is('deleted_at', null)
  if ((count ?? 0) > 0) {
    redirect(
      dest(
        'types',
        'error=' +
          encodeURIComponent(
            `Impossible d’archiver : encore utilisé sur ${count} exercice(s). Réassigne d’abord.`,
          ),
      ),
    )
  }

  const { error } = await supabase
    .from('exercise_types' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
  if (error) redirect(dest('types', 'error=' + encodeURIComponent(error.message)))
  revalidateTags()
  redirect(dest('types', 'deleted=1'))
}

export async function createCoachUnitAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const label = String(formData.get('label') ?? '').trim()
  const short_label = String(formData.get('short_label') ?? '').trim().slice(0, 12) || null
  const valueMode = String(formData.get('value_mode') ?? 'number').trim()
  const mode =
    valueMode === 'time' || valueMode === 'text' || valueMode === 'list' ? valueMode : 'number'
  const dimension = mode === 'time' ? 'time' : mode === 'text' || mode === 'list' ? 'other' : 'count'
  const listRaw = String(formData.get('list_options') ?? '')
  const list_options =
    mode === 'list'
      ? [
          ...new Set(
            listRaw
              .split(/[\n,;]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ].slice(0, 50)
      : null

  if (!label) redirect(dest('units', 'error=' + encodeURIComponent('Nom requis')))
  if (mode === 'list' && (!list_options || list_options.length < 2)) {
    redirect(dest('units', 'error=' + encodeURIComponent('Une liste nécessite au moins 2 options')))
  }

  const key = slugUnitKey(label)
  const { error } = await supabase.from('units' as never).insert({
    coach_id: userId,
    key,
    label,
    short_label: short_label || label.split(/\s+/)[0]?.slice(0, 12) || label.slice(0, 12),
    dimension,
    value_mode: mode,
    list_options,
  } as never)
  if (error) redirect(dest('units', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('units', 'saved=1'))
}

export async function updateCoachUnitAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  const label = String(formData.get('label') ?? '').trim()
  const short_label = String(formData.get('short_label') ?? '').trim().slice(0, 12) || null
  const valueMode = String(formData.get('value_mode') ?? 'number').trim()
  const mode =
    valueMode === 'time' || valueMode === 'text' || valueMode === 'list' ? valueMode : 'number'
  const dimension = mode === 'time' ? 'time' : mode === 'text' || mode === 'list' ? 'other' : 'count'
  const listRaw = String(formData.get('list_options') ?? '')
  const list_options =
    mode === 'list'
      ? [
          ...new Set(
            listRaw
              .split(/[\n,;]+/)
              .map((x) => x.trim())
              .filter(Boolean),
          ),
        ].slice(0, 50)
      : null

  if (!id || !label) redirect(dest('units', 'error=' + encodeURIComponent('Nom requis')))
  if (mode === 'list' && (!list_options || list_options.length < 2)) {
    redirect(dest('units', 'error=' + encodeURIComponent('Une liste nécessite au moins 2 options')))
  }

  const { error } = await supabase
    .from('units' as never)
    .update({
      label,
      short_label: short_label || label.split(/\s+/)[0]?.slice(0, 12) || label.slice(0, 12),
      dimension,
      value_mode: mode,
      list_options,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)
  if (error) redirect(dest('units', 'error=' + encodeURIComponent(uniqueMsg(error.message))))
  revalidateTags()
  redirect(dest('units', 'saved=1'))
}

export async function archiveCoachUnitAction(formData: FormData) {
  const { supabase, userId } = await requireCoachAppUser()
  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(dest('units'))

  const { count: blockCount } = await supabase
    .from('block_library' as never)
    .select('id', { count: 'exact', head: true })
    .eq('coach_id' as never, userId as never)
    .eq('expected_result_unit_id' as never, id as never)
    .is('deleted_at' as never, null)

  const { data: coachBlocks } = await supabase
    .from('block_library' as never)
    .select('id')
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)
  const blockIds = ((coachBlocks ?? []) as { id: string }[]).map((b) => b.id)

  let rxUsage = 0
  if (blockIds.length) {
    const { data: slots } = await supabase
      .from('block_library_exercises' as never)
      .select('prescriptions')
      .in('block_id' as never, blockIds as never)
    for (const slot of (slots ?? []) as { prescriptions?: { unit_id?: string }[] | null }[]) {
      const rx = Array.isArray(slot.prescriptions) ? slot.prescriptions : []
      if (rx.some((p) => p.unit_id === id)) rxUsage += 1
    }
  }

  const usage = (blockCount ?? 0) + rxUsage
  if (usage > 0) {
    redirect(
      dest(
        'units',
        'error=' +
          encodeURIComponent(
            `Impossible d’archiver : encore utilisée sur ${usage} bloc(s) / Rx. Réassigne d’abord.`,
          ),
      ),
    )
  }

  const { error } = await supabase
    .from('units' as never)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
  if (error) redirect(dest('units', 'error=' + encodeURIComponent(error.message)))
  revalidateTags()
  redirect(dest('units', 'deleted=1'))
}
