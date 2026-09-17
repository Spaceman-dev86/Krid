'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import { durationLabelFromWeekCount } from '@/src/lib/formatProgramDuration'
import { createClient } from '@/src/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) redirect('/home')
  return { supabase, userId: user.id }
}

async function assertTrainlyProgram(
  supabase: Awaited<ReturnType<typeof createClient>>,
  programId: string,
) {
  const { data } = await supabase
    .from('programs')
    .select('id')
    .eq('id', programId)
    .eq('is_trainly_catalog', true)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

function builderPath(programId: string, weekId?: string | null, ok?: string, error?: string) {
  const q = new URLSearchParams()
  if (weekId) q.set('week', weekId)
  if (ok) q.set('ok', ok)
  if (error) q.set('error', error)
  const qs = q.toString()
  return `/admin/programs/${programId}${qs ? `?${qs}` : ''}`
}

export async function renameTrainlyProgramWeekAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  if (!programId || !weekId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { error } = await supabase
    .from('program_weeks')
    .update({ title: title || null } as never)
    .eq('id', weekId)
    .eq('program_id', programId)

  if (error) {
    redirect(builderPath(programId, weekId, undefined, error.message))
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, weekId, 'week_renamed'))
}

export async function duplicateTrainlyProgramWeekAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { data: source } = await supabase
    .from('program_weeks')
    .select('id,title,week_order,notes')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!source) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  const src = source as { id: string; title: string | null; week_order: number; notes: string | null }

  const { data: after } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', src.week_order)
    .order('week_order', { ascending: false })

  for (const row of (after ?? []) as { id: string; week_order: number }[]) {
    await supabase
      .from('program_weeks')
      .update({ week_order: row.week_order + 1 } as never)
      .eq('id', row.id)
  }

  const baseTitle = src.title?.trim() || `Semaine ${src.week_order + 1}`
  const { data: created, error } = await supabase
    .from('program_weeks')
    .insert({
      program_id: programId,
      week_order: src.week_order + 1,
      title: `${baseTitle} (copie)`,
      notes: src.notes,
    } as never)
    .select('id')
    .maybeSingle()

  if (error || !created) {
    redirect(builderPath(programId, weekId, undefined, error?.message ?? 'Duplication impossible'))
  }

  const newId = (created as { id: string }).id
  const { count } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(count ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, newId, 'week_duplicated'))
}

export async function deleteTrainlyProgramWeekAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const weekId = String(formData.get('week_id') ?? '').trim()
  if (!programId || !weekId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')

  const { count } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  if ((count ?? 0) <= 1) {
    redirect(builderPath(programId, weekId, undefined, 'Au moins 1 semaine requise'))
  }

  const { data: victim } = await supabase
    .from('program_weeks')
    .select('week_order')
    .eq('id', weekId)
    .eq('program_id', programId)
    .maybeSingle()

  if (!victim) redirect(builderPath(programId, null, undefined, 'Semaine introuvable'))

  const order = (victim as { week_order: number }).week_order
  const { error } = await supabase.from('program_weeks').delete().eq('id', weekId).eq('program_id', programId)
  if (error) {
    redirect(builderPath(programId, weekId, undefined, error.message))
  }

  const { data: rest } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .gt('week_order', order)
    .order('week_order', { ascending: true })

  for (const row of (rest ?? []) as { id: string; week_order: number }[]) {
    await supabase
      .from('program_weeks')
      .update({ week_order: row.week_order - 1 } as never)
      .eq('id', row.id)
  }

  const { data: fallback } = await supabase
    .from('program_weeks')
    .select('id')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { count: left } = await supabase
    .from('program_weeks')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(left ?? 0),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, (fallback as { id?: string } | null)?.id ?? null, 'week_deleted'))
}

/** Aligne le nombre de semaines sur la durée (ajoute en fin / retire depuis la fin). */
export async function syncTrainlyProgramWeekCountAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const programId = String(formData.get('program_id') ?? '').trim()
  const stayWeekId = String(formData.get('week_id') ?? '').trim() || null
  const target = Number.parseInt(String(formData.get('week_count') ?? ''), 10)
  if (!programId) redirect('/admin/programs')
  if (!(await assertTrainlyProgram(supabase, programId))) redirect('/admin/programs')
  if (!Number.isFinite(target) || target < 1 || target > 52) {
    redirect(builderPath(programId, stayWeekId, undefined, 'Durée : 1 à 52 semaines'))
  }

  const { data: weeksRaw } = await supabase
    .from('program_weeks')
    .select('id,week_order')
    .eq('program_id', programId)
    .order('week_order', { ascending: true })

  const weeks = (weeksRaw ?? []) as { id: string; week_order: number }[]
  const current = weeks.length

  if (target > current) {
    const toAdd = Array.from({ length: target - current }, (_, i) => ({
      program_id: programId,
      week_order: current + i,
      title: `Semaine ${current + i + 1}`,
    }))
    const { error } = await supabase.from('program_weeks').insert(toAdd as never)
    if (error) {
      redirect(builderPath(programId, null, undefined, error.message))
    }
  } else if (target < current) {
    const toRemove = weeks.slice(target)
    for (const w of toRemove) {
      const { error } = await supabase.from('program_weeks').delete().eq('id', w.id)
      if (error) {
        redirect(builderPath(programId, null, undefined, error.message))
      }
    }
  }

  await supabase
    .from('programs')
    .update({
      duration: durationLabelFromWeekCount(target),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', programId)

  let nextWeekId: string | null = null
  if (stayWeekId) {
    const { data: still } = await supabase
      .from('program_weeks')
      .select('id')
      .eq('id', stayWeekId)
      .eq('program_id', programId)
      .maybeSingle()
    nextWeekId = (still as { id?: string } | null)?.id ?? null
  }
  if (!nextWeekId) {
    const { data: first } = await supabase
      .from('program_weeks')
      .select('id')
      .eq('program_id', programId)
      .order('week_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    nextWeekId = (first as { id?: string } | null)?.id ?? null
  }

  revalidatePath(`/admin/programs/${programId}`)
  redirect(builderPath(programId, nextWeekId, 'weeks_synced'))
}
