import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../../lib/supabase/server'
import ScrollToHash from '../../../../components/ScrollToHash'
import ProgramStructureClient from '../../../../components/ProgramStructureClient'
import EditableProgramTitleClient from '../../../../components/EditableProgramTitleClient'
import SaveAllExercisesClient from '../../../../components/SaveAllExercisesClient'
import SubmitButtonWithProgressClient from '../../../../components/SubmitButtonWithProgressClient'
import { IconBack, IconDuplicate } from '../../../../components/ui/icons'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    openWeek?: string
    openSession?: string
    replaceExercise?: string
  }>
}

function normalizeFilter(value: string | undefined) {
  const v = (value ?? '').trim()
  return v.length > 0 ? v : null
}

export default async function ProgramDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { openWeek, openSession, replaceExercise } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const isAdmin = profile?.role === 'admin'
  const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
  const backHref = isAdmin ? '/admin' : '/dashboard'

  const { data: program, error } = await supabase
    .from('programs')
    .select(
      'id,coach_id,title,description,goal,level,duration,image_url,is_published,created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !program) {
    redirect(basePath)
  }

  const readOnly = !isAdmin && program.is_published

  const showForkButton = !isAdmin && readOnly

  const structureClient = supabase

  type RpcClient = {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }

  async function forkProgram() {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    const actionBasePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const { data: sourceProgram } = await supabase
      .from('programs')
      .select('id,coach_id,title,description,goal,level,duration,image_url,is_published')
      .eq('id', id)
      .maybeSingle()

    type SourceProgramRow = {
      id: string
      coach_id: string
      title: string
      description: string | null
      goal: string | null
      level: string | null
      duration: string | null
      image_url: string | null
      is_published: boolean
    }

    const typedSourceProgram = sourceProgram as unknown as SourceProgramRow | null

    if (!typedSourceProgram) {
      redirect(actionBasePath)
    }

    if (!typedSourceProgram.is_published && !isAdmin && typedSourceProgram.coach_id !== user.id) {
      redirect(actionBasePath)
    }

    if (isAdmin) {
      redirect(`${actionBasePath}/${id}`)
    }

    const { data: insertedProgram, error: insertProgramError } = await supabase
      .from('programs')
      .insert({
        coach_id: user.id,
        title: `${typedSourceProgram.title} (copie)`,
        description: typedSourceProgram.description,
        goal: typedSourceProgram.goal,
        level: typedSourceProgram.level,
        duration: typedSourceProgram.duration,
        image_url: typedSourceProgram.image_url,
        is_published: false,
      })
      .select('id')
      .maybeSingle()

    if (insertProgramError || !insertedProgram?.id) {
      const msg = insertProgramError?.message ?? 'insert_program_failed'
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newProgramId = insertedProgram.id as unknown as string

    const { data: sourceWeeks, error: sourceWeeksError } = await supabase
      .from('program_weeks')
      .select('id,title,week_order')
      .eq('program_id', typedSourceProgram.id)
      .order('week_order', { ascending: true })

    if (sourceWeeksError) {
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(sourceWeeksError.message)}`)
    }

    type SourceWeekRow = { id: string; title: string; week_order: number }
    const typedSourceWeeks = (sourceWeeks ?? []) as unknown as SourceWeekRow[]

    const { data: insertedWeeks, error: weeksInsertError } = await supabase
      .from('program_weeks')
      .insert(
        typedSourceWeeks.map((w) => ({
          program_id: newProgramId,
          title: w.title,
          week_order: w.week_order,
        }))
      )
      .select('id,week_order')

    if (weeksInsertError || !insertedWeeks || insertedWeeks.length !== typedSourceWeeks.length) {
      const msg = weeksInsertError?.message ?? 'insert_weeks_failed'
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const insertedWeeksTyped = insertedWeeks as unknown as { id: string; week_order: number }[]

    const weekIdMap = new Map<string, string>()
    const newWeekIdByOrder = new Map<number, string>()
    for (const w of insertedWeeksTyped) newWeekIdByOrder.set(w.week_order, w.id)
    for (const w of typedSourceWeeks) {
      const newId = newWeekIdByOrder.get(w.week_order)
      if (newId) weekIdMap.set(w.id, newId)
    }

    const sourceWeekIds = typedSourceWeeks.map((w) => w.id)
    const { data: sourceSessions, error: sourceSessionsError } = sourceWeekIds.length
      ? await supabase
          .from('sessions')
          .select('id,week_id,title,description,session_order')
          .in('week_id', sourceWeekIds)
          .order('session_order', { ascending: true })
      : { data: [], error: null }

    if (sourceSessionsError) {
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(sourceSessionsError.message)}`)
    }

    type SourceSessionRow = {
      id: string
      week_id: string
      title: string
      description: string | null
      session_order: number
    }
    const typedSourceSessions = (sourceSessions ?? []) as unknown as SourceSessionRow[]

    const sessionsToInsert = typedSourceSessions
      .map((s) => {
        const newWeekId = weekIdMap.get(s.week_id)
        if (!newWeekId) return null
        return {
          week_id: newWeekId,
          title: s.title,
          description: s.description,
          session_order: s.session_order,
        }
      })
      .filter((v): v is { week_id: string; title: string; description: string | null; session_order: number } => !!v)

    const { data: insertedSessions, error: sessionsInsertError } = sessionsToInsert.length
      ? await supabase.from('sessions').insert(sessionsToInsert).select('id,week_id,session_order')
      : { data: [] as { id: string; week_id: string; session_order: number }[] | null, error: null }

    if (sessionsInsertError || !insertedSessions || insertedSessions.length !== sessionsToInsert.length) {
      const msg = sessionsInsertError?.message ?? 'insert_sessions_failed'
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const insertedSessionsTyped = insertedSessions as unknown as { id: string; week_id: string; session_order: number }[]

    const sessionIdMap = new Map<string, string>()
    const newSessionIdByWeekAndOrder = new Map<string, Map<number, string>>()
    for (const s of insertedSessionsTyped) {
      const m = newSessionIdByWeekAndOrder.get(s.week_id) ?? new Map<number, string>()
      m.set(s.session_order, s.id)
      newSessionIdByWeekAndOrder.set(s.week_id, m)
    }
    for (const s of typedSourceSessions) {
      const newWeekId = weekIdMap.get(s.week_id)
      if (!newWeekId) continue
      const newId = newSessionIdByWeekAndOrder.get(newWeekId)?.get(s.session_order)
      if (newId) sessionIdMap.set(s.id, newId)
    }

    const sourceSessionIds = typedSourceSessions.map((s) => s.id)
    const { data: sourceExercises, error: sourceExercisesError } = sourceSessionIds.length
      ? await supabase
          .from('program_exercises')
          .select(
            'session_id,name,description,sets,reps,rest_time,tempo,load,video_url,notes,exercise_order,exercise_id'
          )
          .in('session_id', sourceSessionIds)
          .order('exercise_order', { ascending: true })
      : { data: [], error: null }

    if (sourceExercisesError) {
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(sourceExercisesError.message)}`)
    }

    type SourceExerciseRow = {
      session_id: string
      name: string
      description: string | null
      sets: number | null
      reps: number | null
      rest_time: string | null
      tempo: string | null
      load: string | null
      video_url: string | null
      notes: string | null
      exercise_order: number
      exercise_id: string | null
    }
    const typedSourceExercises = (sourceExercises ?? []) as unknown as SourceExerciseRow[]

    const exercisesToInsert = typedSourceExercises
      .map((ex) => {
        const newSessionId = sessionIdMap.get(ex.session_id)
        if (!newSessionId) return null
        return {
          session_id: newSessionId,
          name: ex.name,
          description: ex.description,
          sets: ex.sets,
          reps: ex.reps,
          rest_time: ex.rest_time,
          tempo: ex.tempo,
          load: ex.load,
          video_url: ex.video_url,
          notes: ex.notes,
          exercise_order: ex.exercise_order,
          exercise_id: ex.exercise_id,
        }
      })
      .filter(
        (
          v
        ): v is {
          session_id: string
          name: string
          description: string | null
          sets: number | null
          reps: number | null
          rest_time: string | null
          tempo: string | null
          load: string | null
          video_url: string | null
          notes: string | null
          exercise_order: number
          exercise_id: string | null
        } => !!v
      )

    const { error: exInsertError } = exercisesToInsert.length
      ? await supabase.from('program_exercises').insert(exercisesToInsert)
      : { error: null }

    if (exInsertError) {
      redirect(`${actionBasePath}/${id}?error=${encodeURIComponent(exInsertError.message)}`)
    }

    const firstNewWeekId = typedSourceWeeks.length ? weekIdMap.get(typedSourceWeeks[0].id) : null
    const url = new URL(`${actionBasePath}/${newProgramId}`, 'http://localhost')
    if (firstNewWeekId) url.searchParams.set('openWeek', firstNewWeekId)
    redirect(url.pathname + url.search)
  }

  async function addExerciseToSession(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const client = String(formData.get('client') ?? '')
    const tmpId = String(formData.get('tmp_id') ?? '')

    const sessionId = String(formData.get('session_id') ?? '')
    const exerciseId = String(formData.get('exercise_id') ?? '')

    if (!sessionId || !exerciseId) {
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const { data: insertedId, error } = await (supabase as unknown as RpcClient).rpc('insert_program_exercise', {
      p_session_id: sessionId,
      p_exercise_id: exerciseId,
    })

    if (error || !insertedId) {
      revalidatePath(`${basePath}/${id}`)
      const msg = error?.message ?? 'insert_failed'
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    if (client === '1') {
      return {
        insertedId: String(insertedId),
        tmpId: tmpId || null,
      }
    }

    revalidatePath(`${basePath}/${id}`)
  }

  async function replaceProgramExercise(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '')

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      if (client === '1') {
        throw new Error('read_only')
      }
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const programExerciseId = String(formData.get('program_exercise_id') ?? '')
    const sessionId = String(formData.get('session_id') ?? '')
    const newExerciseId = String(formData.get('exercise_id') ?? '')

    if (programExerciseId.startsWith('tmp-')) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error('exercise_not_saved_yet')
      }
      redirect(`/dashboard/programs/${id}?error=exercise_not_saved_yet`)
    }

    if (!programExerciseId || !sessionId || !newExerciseId) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error('missing_ids')
      }
      redirect(`/dashboard/programs/${id}?error=missing_ids`)
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id,week_id')
      .eq('id', sessionId)
      .maybeSingle()

    const typedSession = session as unknown as { id: string; week_id: string } | null

    if (!typedSession) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error('session_not_found')
      }
      redirect(`/dashboard/programs/${id}?error=session_not_found`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', typedSession.week_id)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek || typedWeek.program_id !== id) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error('invalid_week')
      }
      redirect(`/dashboard/programs/${id}?error=invalid_week`)
    }

    const { data: updatedRow, error } = await supabase
      .from('program_exercises')
      .update({ exercise_id: newExerciseId })
      .eq('id', programExerciseId)
      .eq('session_id', sessionId)
      .select('id')
      .maybeSingle()

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error(error.message)
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    if (!updatedRow) {
      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        throw new Error('replace_not_applied')
      }
      redirect(`/dashboard/programs/${id}?error=replace_not_applied`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }
  }

  async function deleteProgramExercise(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
    
    const client = String(formData.get('client') ?? '')

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      if (client === '1') {
        throw new Error('read_only')
      }
      redirect(`${basePath}/${id}?error=read_only`)
    }

    const programExerciseId = String(formData.get('program_exercise_id') ?? '')
    const sessionId = String(formData.get('session_id') ?? '')
    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')

    if (!programExerciseId || !sessionId) {
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id,week_id')
      .eq('id', sessionId)
      .maybeSingle()

    const typedSession = session as unknown as { id: string; week_id: string } | null

    if (!typedSession) {
      redirect(`${basePath}/${id}?error=session_not_found`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', typedSession.week_id)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek || typedWeek.program_id !== id) {
      if (client === '1') {
        throw new Error('invalid_week')
      }
      redirect(`${basePath}/${id}?error=invalid_week`)
    }

    const { error } = await supabase
      .from('program_exercises')
      .delete()
      .eq('id', programExerciseId)
      .eq('session_id', sessionId)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)

    if (client === '1') {
      return
    }

    const url = new URL(`${basePath}/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)
    redirect(url.pathname + url.search)
  }

  async function updateProgramTitle(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const nextTitle = String(formData.get('title') ?? '').trim()
    const client = String(formData.get('client') ?? '')

    const { error } = await supabase.from('programs').update({ title: nextTitle }).eq('id', id)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        return
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(`/dashboard/programs/${id}`)
  }

  async function updateWeekTitle(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const weekId = String(formData.get('week_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const client = String(formData.get('client') ?? '')
    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')

    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', weekId)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek || typedWeek.program_id !== id) {
      redirect(`/dashboard/programs/${id}?error=invalid_week`)
    }

    const { error } = await supabase.from('program_weeks').update({ title }).eq('id', weekId)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        return
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(url.pathname + url.search)
  }

  async function updateSessionTitle(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const sessionId = String(formData.get('session_id') ?? '')
    const weekId = String(formData.get('week_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const client = String(formData.get('client') ?? '')
    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')

    if (!sessionId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_id`)
    }

    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', weekId)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek || typedWeek.program_id !== id) {
      redirect(`/dashboard/programs/${id}?error=invalid_week`)
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id,week_id')
      .eq('id', sessionId)
      .eq('week_id', weekId)
      .maybeSingle()

    const typedSession = session as unknown as { id: string; week_id: string } | null

    if (!typedSession) {
      redirect(`/dashboard/programs/${id}?error=session_not_found`)
    }

    const { error } = await supabase.from('sessions').update({ title }).eq('id', sessionId)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        return
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(url.pathname + url.search)
  }

  async function saveAllExercises(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const client = String(formData.get('client') ?? '')

    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')

    const titleField = formData.get('title')
    const hasTitleField = titleField !== null
    const title = hasTitleField ? String(titleField ?? '').trim() : ''
    const description = String(formData.get('description') ?? '').trim()
    const goal = String(formData.get('goal') ?? '').trim()
    const level = String(formData.get('level') ?? '').trim()
    const duration = String(formData.get('duration') ?? '').trim()

    const structureOrderRaw = String(formData.get('structure_order') ?? '').trim()

    if (hasTitleField && !title) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        return
      }
      redirect(`/dashboard/programs/${id}`)
    }

    if (hasTitleField) {
      const { error: programError } = await supabase
        .from('programs')
        .update({
          title,
          description: description || null,
          goal: goal || null,
          level: level || null,
          duration: duration || null,
        })
        .eq('id', id)

      if (programError) {
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(programError.message)}`)
      }
    }

    if (structureOrderRaw) {
      try {
        const parsed = JSON.parse(structureOrderRaw) as {
          weeksDirty?: boolean
          orderedWeekIds?: string[]
          dirtyWeekIds?: string[]
          sessionsByWeekIds?: Record<string, string[]>
          dirtySessionIds?: string[]
          exercisesBySessionIds?: Record<string, string[]>
        }

        const isUuid = (value: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

        const sanitizeIds = (ids: string[] | undefined) => (ids ?? []).map(String).filter((v) => isUuid(v))

        const sanitized = {
          ...parsed,
          orderedWeekIds: sanitizeIds(parsed.orderedWeekIds),
          dirtyWeekIds: sanitizeIds(parsed.dirtyWeekIds),
          dirtySessionIds: sanitizeIds(parsed.dirtySessionIds),
          sessionsByWeekIds: (() => {
            const obj = parsed.sessionsByWeekIds && typeof parsed.sessionsByWeekIds === 'object' ? parsed.sessionsByWeekIds : null
            if (!obj) return undefined
            const next: Record<string, string[]> = {}
            for (const [weekId, sessionIds] of Object.entries(obj)) {
              if (!isUuid(String(weekId))) continue
              next[String(weekId)] = sanitizeIds(sessionIds)
            }
            return next
          })(),
          exercisesBySessionIds: (() => {
            const obj = parsed.exercisesBySessionIds && typeof parsed.exercisesBySessionIds === 'object' ? parsed.exercisesBySessionIds : null
            if (!obj) return undefined
            const next: Record<string, string[]> = {}
            for (const [sessionId, exerciseIds] of Object.entries(obj)) {
              if (!isUuid(String(sessionId))) continue
              next[String(sessionId)] = sanitizeIds(exerciseIds)
            }
            return next
          })(),
        }

        const { error: rpcError } = await (supabase as unknown as RpcClient).rpc('apply_structure_order', {
          p_program_id: id,
          p_payload: sanitized,
        })

        if (rpcError) {
          revalidatePath(`/dashboard/programs/${id}`)
          if (client === '1') {
            throw new Error(rpcError.message)
          }
          redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(rpcError.message)}`)
        }
      } catch {
        // ignore invalid payload
      }
    }

    const programExerciseIds = (formData.getAll('pe_ids') ?? []).map((v) => String(v)).filter(Boolean)

    if (programExerciseIds.length === 0) {
      const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
      if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
      if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)

      revalidatePath(`/dashboard/programs/${id}`)

      if (client === '1') {
        return
      }
      redirect(url.pathname + url.search)
    }

    const { data: peRows } = await supabase
      .from('program_exercises')
      .select('id,session_id,name')
      .in('id', programExerciseIds)

    const typedPeRows = (peRows ?? []) as unknown as { id: string; session_id: string; name: string }[]
    const peById = new Map(typedPeRows.map((r) => [r.id, r]))
    const sessionIds = Array.from(new Set(typedPeRows.map((r) => r.session_id)))

    const { data: sessions } = await supabase.from('sessions').select('id,week_id').in('id', sessionIds)
    const typedSessions = (sessions ?? []) as unknown as { id: string; week_id: string }[]
    const weekIds = Array.from(new Set(typedSessions.map((s) => s.week_id)))

    const { data: weeks } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .in('id', weekIds)

    const typedWeeks = (weeks ?? []) as unknown as { id: string; program_id: string }[]
    const weekById = new Map(typedWeeks.map((w) => [w.id, w]))

    for (const s of typedSessions) {
      const w = weekById.get(s.week_id)
      if (!w || w.program_id !== id) {
        redirect(`/dashboard/programs/${id}?error=invalid_week`)
      }
    }

    type ProgramExerciseUpdate = {
      id: string
      session_id: string
      name: string
      sets: number | null
      reps: number | null
      rest_time: string | null
      tempo: string | null
      load: string | null
      notes: string | null
    }

    const updates: ProgramExerciseUpdate[] = programExerciseIds.map((peId) => {
      const pe = peById.get(peId)
      if (!pe) {
        redirect(`/dashboard/programs/${id}?error=invalid_exercise`)
      }

      const setsRaw = String(formData.get(`sets_${peId}`) ?? '').trim()
      const repsRaw = String(formData.get(`reps_${peId}`) ?? '').trim()
      const restTimeRaw = String(formData.get(`rest_time_${peId}`) ?? '').trim()
      const tempoRaw = String(formData.get(`tempo_${peId}`) ?? '').trim()
      const loadRaw = String(formData.get(`load_${peId}`) ?? '').trim()
      const notesRaw = String(formData.get(`notes_${peId}`) ?? '').trim()

      const sets = setsRaw ? Number(setsRaw) : null
      const reps = repsRaw ? Number(repsRaw) : null

      return {
        id: peId,
        session_id: pe.session_id,
        name: pe.name,
        sets: Number.isFinite(sets as number) ? sets : null,
        reps: Number.isFinite(reps as number) ? reps : null,
        rest_time: restTimeRaw || null,
        tempo: tempoRaw || null,
        load: loadRaw || null,
        notes: notesRaw || null,
      }
    })

    const chunkSize = 50
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      const { error } = await supabase.from('program_exercises').upsert(chunk, { onConflict: 'id' })
      if (error) {
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)
    redirect(url.pathname + url.search)
  }

  async function duplicateSession(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const weekId = String(formData.get('week_id') ?? '')
    const sessionId = String(formData.get('session_id') ?? '')
    const client = String(formData.get('client') ?? '')

    if (!weekId || !sessionId) {
      if (client === '1') {
        throw new Error('missing_ids')
      }
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', weekId)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null

    if (!typedWeek || typedWeek.program_id !== id) {
      redirect(`/dashboard/programs/${id}?error=invalid_week`)
    }

    const { data: sourceSession } = await supabase
      .from('sessions')
      .select('id,week_id,title,description')
      .eq('id', sessionId)
      .eq('week_id', weekId)
      .maybeSingle()

    const typedSourceSession = sourceSession as unknown as {
      id: string
      week_id: string
      title: string
      description: string | null
    } | null

    if (!typedSourceSession) {
      if (client === '1') {
        throw new Error('session_not_found')
      }
      redirect(`${basePath}/${id}?error=session_not_found`)
    }

    const { data: last } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (last?.session_order ?? 0) + 1

    const { data: insertedSession, error: insertSessionError } = await supabase
      .from('sessions')
      .insert({
        week_id: weekId,
        title: `${typedSourceSession.title} (copie)`,
        description: typedSourceSession.description,
        session_order: nextOrder,
      })
      .select('id')
      .maybeSingle()

    if (insertSessionError || !insertedSession?.id) {
      const msg = insertSessionError?.message ?? 'insert_failed'
      revalidatePath(`${basePath}/${id}`)
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newSessionId = insertedSession.id as unknown as string

    const { data: sourceExercises } = await supabase
      .from('program_exercises')
      .select('exercise_id,name,exercise_order,sets,reps,rest_time,tempo,load,notes')
      .eq('session_id', sessionId)
      .order('exercise_order', { ascending: true })

    type SourceExerciseRow = {
      exercise_id: string
      name: string
      exercise_order: number
      sets: number | null
      reps: number | null
      rest_time: string | null
      tempo: string | null
      load: string | null
      notes: string | null
    }

    const typedSourceExercises = (sourceExercises ?? []) as unknown as SourceExerciseRow[]

    for (const ex of typedSourceExercises) {
      type ProgramExerciseInsert = {
        session_id: string
        exercise_id: string
        name: string
        sets: number | null
        reps: number | null
        rest_time: string | null
        tempo: string | null
        load: string | null
        notes: string | null
        exercise_order: number
      }

      const payload: ProgramExerciseInsert = {
        session_id: newSessionId,
        exercise_id: ex.exercise_id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest_time: ex.rest_time,
        tempo: ex.tempo,
        load: ex.load,
        notes: ex.notes,
        exercise_order: ex.exercise_order,
      }

      const { error } = await (supabase.from('program_exercises') as unknown as {
        insert: (v: ProgramExerciseInsert) => Promise<{ error: { message: string } | null }>
      }).insert(payload)

      if (error) {
        revalidatePath(`${basePath}/${id}`)
        if (client === '1') {
          throw new Error(error.message)
        }
        redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    const url = new URL(`${basePath}/${id}`, 'http://localhost')
    url.searchParams.set('openWeek', weekId)
    url.searchParams.set('openSession', newSessionId)

    revalidatePath(`${basePath}/${id}`)

    if (client === '1') {
      return { newSessionId }
    }

    redirect(url.pathname + url.search)
  }

  async function duplicateWeek(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const sourceWeekId = String(formData.get('week_id') ?? '')
    const client = String(formData.get('client') ?? '')

    if (!sourceWeekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const { data: newWeekId, error: rpcError } = await (supabase as unknown as RpcClient).rpc('duplicate_week', {
      p_program_id: id,
      p_source_week_id: sourceWeekId,
    })

    if (rpcError || !newWeekId) {
      revalidatePath(`/dashboard/programs/${id}`)
      const msg = rpcError?.message ?? 'duplicate_failed'
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    url.searchParams.set('openWeek', String(newWeekId))

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(url.pathname + url.search)
  }

  async function addWeek(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const client = String(formData.get('client') ?? '')

    const title = String(formData.get('title') ?? '').trim() || 'Semaine'

    const { data: last } = await supabase
      .from('program_weeks')
      .select('week_order')
      .eq('program_id', id)
      .order('week_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (last?.week_order ?? 0) + 1

    const { error } = await supabase.from('program_weeks').insert({
      program_id: id,
      title,
      week_order: nextOrder,
    })

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(`/dashboard/programs/${id}`)
  }

  async function deleteWeek(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const client = String(formData.get('client') ?? '')

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const { error } = await supabase.from('program_weeks').delete().eq('id', weekId)

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(`/dashboard/programs/${id}`)
  }

  async function addSession(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const client = String(formData.get('client') ?? '')

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const title = String(formData.get('title') ?? '').trim() || 'Séance'

    const { data: last } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (last?.session_order ?? 0) + 1

    const { error } = await supabase.from('sessions').insert({
      week_id: weekId,
      title,
      session_order: nextOrder,
      description: null,
    })

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    redirect(`/dashboard/programs/${id}`)
  }

  async function deleteSession(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const sessionId = String(formData.get('session_id') ?? '')
    const weekId = String(formData.get('week_id') ?? '')
    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')
    const client = String(formData.get('client') ?? '')

    if (!sessionId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_id`)
    }

    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const { data: sourceSession } = await supabase
      .from('sessions')
      .select('id,week_id,session_order')
      .eq('id', sessionId)
      .eq('week_id', weekId)
      .maybeSingle()

    const typedSourceSession = sourceSession as unknown as { id: string; week_id: string; session_order: number } | null

    if (!typedSourceSession) {
      redirect(`/dashboard/programs/${id}?error=session_not_found`)
    }

    const { error } = await supabase.from('sessions').delete().eq('id', sessionId)

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    const { data: remainingSessions } = await supabase
      .from('sessions')
      .select('id,session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: true })

    const typedRemainingSessions = (remainingSessions ?? []) as unknown as { id: string; session_order: number }[]

    for (const s of typedRemainingSessions) {
      if (s.session_order > typedSourceSession.session_order) {
        const { error: updateError } = await supabase
          .from('sessions')
          .update({ session_order: s.session_order - 1 })
          .eq('id', s.id)

        if (updateError) {
          redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(updateError.message)}`)
        }
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)
    redirect(url.pathname + url.search)
  }

  const { data: weeks } = await structureClient
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  const weekIds = (weeks ?? []).map((w) => w.id)

  type SessionRow = {
    id: string
    week_id: string
    title: string
    description: string | null
    session_order: number
  }

  const sessions: SessionRow[] = weekIds.length
    ? ((await structureClient
        .from('sessions')
        .select('id,week_id,title,description,session_order')
        .in('week_id', weekIds)
        .order('session_order', { ascending: true })).data as SessionRow[]) ?? []
    : []

  const sessionsByWeek = new Map<string, SessionRow[]>()
  for (const s of sessions) {
    const list = sessionsByWeek.get(s.week_id) ?? []
    list.push(s)
    sessionsByWeek.set(s.week_id, list)
  }

  const sessionIds = sessions.map((s) => s.id)

  type ProgramExerciseRow = {
    id: string
    session_id: string
    exercise_id: string | null
    name: string | null
    exercise_order: number
    sets: number | null
    reps: number | null
    rest_time: string | null
    tempo: string | null
    load: string | null
    notes: string | null
    exercise_library: { name: string } | null
  }

  const programExercises: ProgramExerciseRow[] = sessionIds.length
    ? (((await structureClient
        .from('program_exercises')
        .select(
          'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,tempo,load,notes,exercise_library(name)'
        )
        .in('session_id', sessionIds)
        .order('exercise_order', { ascending: true })).data ?? []) as unknown as ProgramExerciseRow[])
    : []

  const exerciseIdsToHydrate = Array.from(
    new Set(
      programExercises
        .map((pe) => pe.exercise_id)
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    )
  )

  const { data: hydratedExercises } = exerciseIdsToHydrate.length
    ? await supabase.from('exercise_library').select('id,name').in('id', exerciseIdsToHydrate)
    : { data: [] as { id: string; name: string }[] | null }

  const exerciseNameById = new Map<string, string>()
  for (const row of hydratedExercises ?? []) {
    if (row?.id && row?.name) exerciseNameById.set(row.id, row.name)
  }

  const hydratedProgramExercises: ProgramExerciseRow[] = programExercises.map((pe) => {
    const libName = pe.exercise_library?.name
    if (libName && String(libName).trim()) return pe

    const nameFromLib = pe.exercise_id ? exerciseNameById.get(pe.exercise_id) : null
    if (!nameFromLib) return pe

    return {
      ...pe,
      exercise_library: { name: nameFromLib },
      name: pe.name ?? nameFromLib,
    }
  })

  const exercisesBySession = new Map<string, ProgramExerciseRow[]>()
  for (const pe of hydratedProgramExercises) {
    const list = exercisesBySession.get(pe.session_id) ?? []
    list.push(pe)
    exercisesBySession.set(pe.session_id, list)
  }

  const replaceExerciseId = normalizeFilter(replaceExercise ?? undefined)

  const { data: muscleGroups } = await supabase
    .from('exercise_library')
    .select('muscle_group')
    .not('muscle_group', 'is', null)
    .order('muscle_group', { ascending: true })

  const uniqueMuscles = Array.from(
    new Set((muscleGroups ?? []).map((m) => m.muscle_group).filter((m): m is string => !!m))
  )

  const initialTitle = program.title

  async function deleteProgram() {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.role === 'admin'

    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
    const redirectAfterDelete = isAdmin ? basePath : '/dashboard'

    const { data: currentProgram } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    if (!currentProgram) {
      redirect(redirectAfterDelete)
    }

    if (currentProgram.coach_id !== user.id && !isAdmin) {
      redirect(`${basePath}/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      redirect(`${basePath}/${id}?error=cannot_delete_published`)
    }

    const { error } = await supabase.from('programs').delete().eq('id', id)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    redirect(redirectAfterDelete)
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <ScrollToHash />
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0 flex-1">
            <EditableProgramTitleClient
              initialTitle={initialTitle}
              readOnly={readOnly}
              updateProgramTitleAction={updateProgramTitle}
            />
          </div>

          <div className="relative group shrink-0">
            <Link
              href={backHref}
              className="inline-flex"
              aria-label="Retour"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                <IconBack className="text-white" />
              </span>
            </Link>
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-black/80 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              Retour
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand)] ring-1 ring-gray-200">
          {readOnly ? 'Lecture seule' : program.is_published ? 'Publié' : 'Brouillon'}
        </div>

        {showForkButton ? (
          <div className="relative group shrink-0">
            <form action={forkProgram}>
              <SubmitButtonWithProgressClient
                label="Dupliquer le programme"
                iconOnly
                icon={
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                    <IconDuplicate className="text-white" />
                  </span>
                }
                style={{
                  padding: 0,
                  borderRadius: 9999,
                  border: '0px solid transparent',
                  background: 'transparent',
                  color: 'var(--brand)',
                  cursor: 'pointer',
                }}
              />
            </form>
            <span className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-lg bg-black/80 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              Dupliquer le programme
            </span>
          </div>
        ) : null}
      </div>

      {readOnly ? (
        <>
          <section className="mt-6 overflow-hidden rounded-2xl bg-gray-50/70 shadow-sm ring-1 ring-gray-200">
            <div className="grid gap-3 px-4 py-3">
              <div className="grid gap-0.5">
                <div className="text-xs font-extrabold text-[var(--brand)]">Description</div>
                <div className="text-sm leading-snug text-gray-800">{program.description ?? ''}</div>
              </div>

              <div className="grid gap-0.5">
                <div className="text-xs font-extrabold text-[var(--brand)]">Objectif</div>
                <div className="text-sm leading-snug text-gray-800">{program.goal ?? ''}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                  <div className="text-xs font-extrabold text-[var(--brand)]">Niveau</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900">{program.level ?? ''}</div>
                </div>
                <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-200">
                  <div className="text-xs font-extrabold text-[var(--brand)]">Durée</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900">{program.duration ?? ''}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6">
            <ProgramStructureClient
              programId={id}
              readOnly={readOnly}
              weeks={weeks ?? []}
              sessions={sessions}
              programExercises={hydratedProgramExercises}
              openWeek={openWeek}
              openSession={openSession}
              replaceExerciseId={replaceExerciseId ?? undefined}
              uniqueMuscles={uniqueMuscles}
              addWeekAction={addWeek}
              deleteWeekAction={deleteWeek}
              duplicateWeekAction={duplicateWeek}
              addSessionAction={addSession}
              deleteSessionAction={deleteSession}
              duplicateSessionAction={duplicateSession}
              updateWeekTitleAction={updateWeekTitle}
              updateSessionTitleAction={updateSessionTitle}
              addExerciseToSessionAction={addExerciseToSession}
              replaceProgramExerciseAction={replaceProgramExercise}
              deleteProgramExerciseAction={deleteProgramExercise}
            />
          </div>
        </>
      ) : (
        <>
          <section style={{ marginTop: 24, display: 'grid', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span>Description</span>
              <textarea
                name="description"
                rows={2}
                defaultValue={program.description ?? ''}
                form="save-all-exercises"
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span>Objectif</span>
              <input
                name="goal"
                defaultValue={program.goal ?? ''}
                form="save-all-exercises"
                style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span>Niveau</span>
                <select
                  name="level"
                  defaultValue={program.level ?? ''}
                  form="save-all-exercises"
                  style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                >
                  <option value="">Sélectionner…</option>
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Confirmé">Confirmé</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span>Durée</span>
                <select
                  name="duration"
                  defaultValue={program.duration ?? ''}
                  form="save-all-exercises"
                  style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
                >
                  <option value="">Sélectionner…</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const n = i + 1
                    const label = n === 1 ? '1 semaine' : `${n} semaines`
                    return (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    )
                  })}
                </select>
              </label>
            </div>
          </section>

          <ProgramStructureClient
            programId={id}
            readOnly={readOnly}
            weeks={weeks ?? []}
            sessions={sessions}
            programExercises={hydratedProgramExercises}
            openWeek={openWeek}
            openSession={openSession}
            replaceExerciseId={replaceExerciseId ?? undefined}
            uniqueMuscles={uniqueMuscles}
            addWeekAction={addWeek}
            deleteWeekAction={deleteWeek}
            duplicateWeekAction={duplicateWeek}
            addSessionAction={addSession}
            deleteSessionAction={deleteSession}
            duplicateSessionAction={duplicateSession}
            updateWeekTitleAction={updateWeekTitle}
            updateSessionTitleAction={updateSessionTitle}
            addExerciseToSessionAction={addExerciseToSession}
            replaceProgramExerciseAction={replaceProgramExercise}
            deleteProgramExerciseAction={deleteProgramExercise}
          />

          <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <SaveAllExercisesClient action={saveAllExercises} openWeek={openWeek ?? ''} openSession={openSession ?? ''} />

            <form action={deleteProgram}>
              <button
                type="submit"
                disabled={program.is_published}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #ef4444',
                  background: program.is_published ? '#fca5a5' : '#ef4444',
                  color: '#ffffff',
                  cursor: program.is_published ? 'not-allowed' : 'pointer',
                }}
                title="Supprimer le programme"
              >
                ✖
              </button>
            </form>
          </div>

          {program.is_published ? (
            <p style={{ color: '#6b7280', marginTop: 16 }}>
              Impossible de supprimer un programme publié.
            </p>
          ) : null}
        </>
      )}
    </main>
  )
}
