'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

export async function createProgramAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = clean(formData.get('title'))
  if (!title) redirect('/programs/new?error=title')

  const asTemplate = formData.get('is_template') === 'on'

  const { data: program, error } = await supabase
    .from('programs')
    .insert({
      coach_id: user.id,
      title,
      description: clean(formData.get('description')),
      goal: clean(formData.get('goal')),
      level: clean(formData.get('level')),
      duration: clean(formData.get('duration')),
      is_template: asTemplate,
      is_published: false,
      is_trainly_catalog: false,
      status: 'draft',
    })
    .select('id')
    .maybeSingle()

  if (error || !program?.id) {
    redirect(`/programs/new?error=${encodeURIComponent(error?.message ?? 'insert_failed')}`)
  }

  const programId = program.id

  const weeks = Array.from({ length: 4 }).map((_, i) => ({
    program_id: programId,
    week_order: i,
    title: `Semaine ${i + 1}`,
  }))

  const { data: insertedWeeks, error: weeksError } = await supabase
    .from('program_weeks')
    .insert(weeks)
    .select('id, week_order')

  if (weeksError || !insertedWeeks?.length) {
    redirect(`/programs/${programId}?error=${encodeURIComponent(weeksError?.message ?? 'weeks')}`)
  }

  const sessions = insertedWeeks.flatMap((w) =>
    Array.from({ length: 4 }).map((_, i) => ({
      week_id: w.id,
      session_order: i,
      title: `Séance ${i + 1}`,
    }))
  )

  const { error: sessionsError } = await supabase.from('sessions').insert(sessions)
  if (sessionsError) {
    redirect(`/programs/${programId}?error=${encodeURIComponent(sessionsError.message)}`)
  }

  revalidatePath('/programs')
  redirect(`/programs/${programId}`)
}

export async function softDeleteProgramAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = clean(formData.get('id'))
  if (!id) redirect('/programs')

  const { error } = await supabase
    .from('programs')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) redirect(`/programs?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/programs')
  redirect('/programs?deleted=1')
}

export async function assignProgramToClientAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const clientId = clean(formData.get('client_id'))
  const programId = clean(formData.get('program_id'))
  const returnTo = clean(formData.get('return_to')) ?? `/clients/${clientId}`

  if (!clientId || !programId) redirect(returnTo)

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${returnTo}?error=client`)

  const { data: program } = await supabase
    .from('programs')
    .select('id, title, is_calendar, start_date')
    .eq('id', programId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!program) redirect(`${returnTo}?error=program`)

  const { error } = await supabase.from('client_fitness_plans').insert({
    client_id: clientId,
    coach_id: user.id,
    source_program_id: programId,
    status: 'waiting',
    is_calendar: program.is_calendar ?? false,
    start_date: program.start_date ?? null,
  })

  if (error) {
    redirect(`${returnTo}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/programs')
  redirect(`${returnTo}?assigned=1`)
}
