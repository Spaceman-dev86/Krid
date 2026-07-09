import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../../lib/supabase/server'
import ScrollToHash from '../../../../components/ScrollToHash'
import ProgramStructureClient from '../../../../components/ProgramStructureClient'
import ProgramBlocksEditorClient from '../../../../components/ProgramBlocksEditorClient'
import ProgramStructureTimelineV2Client from '../../../../components/ProgramStructureTimelineV2Client'
import EditableProgramTitleClient from '../../../../components/EditableProgramTitleClient'
import PublicProgramStructureReadOnlyClient from '../../../../components/PublicProgramStructureReadOnlyClient'
import DeleteProgramConfirmClient from '../../../../components/DeleteProgramConfirmClient'
import { IconBack } from '../../../../components/ui/icons'

type UntypedSupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  from: (table: string) => PostgrestBuilder
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (path: string, expiresIn: number) => Promise<{ data: { signedUrl?: string } | null }>
    }
  }
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

type PostgrestResponse = { data: unknown; error: { message: string } | null }

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
}

type PostgrestBuilder = PromiseLike<PostgrestResponse> & {
  select: (columns: string, options?: Record<string, unknown>) => PostgrestBuilder
  eq: (column: string, value: unknown) => PostgrestBuilder
  in: (column: string, values: unknown[]) => PostgrestBuilder
  not: (column: string, operator: string, value: unknown) => PostgrestBuilder
  ilike: (column: string, pattern: string) => PostgrestBuilder
  order: (column: string, options?: { ascending?: boolean }) => PostgrestBuilder
  limit: (count: number) => PostgrestBuilder
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => PostgrestBuilder
  upsert: (values: Record<string, unknown> | Record<string, unknown>[], options?: Record<string, unknown>) => PostgrestBuilder
  update: (values: Record<string, unknown>) => PostgrestBuilder
  delete: () => PostgrestBuilder
}

async function createUntypedClient(): Promise<UntypedSupabaseClient> {
  return (await createClient()) as unknown as UntypedSupabaseClient
}

type MinimalProgramsUpdate = {
  from: (table: 'programs') => {
    update: (values: {
      title?: string | null
      description?: string | null
      goal?: string | null
      level?: string | null
      duration?: string | null
    }) => {
      eq: (column: 'id', value: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

type MinimalProgramsPublishUpdate = {
  from: (table: 'programs') => {
    update: (values: { is_published: boolean }) => {
      eq: (column: 'id', value: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    openWeek?: string
    openSession?: string
    openExercise?: string
    openBlock?: string
    replaceExercise?: string
    legacy?: string
    showLegacy?: string
    blocks?: string
  }>
}

function normalizeFilter(value: string | undefined) {
  const v = (value ?? '').trim()
  return v.length > 0 ? v : null
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function ProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const rawSearchParams = await searchParams
  const openWeek = firstParam(rawSearchParams.openWeek)
  const openSession = firstParam(rawSearchParams.openSession)
  const openExercise = firstParam(rawSearchParams.openExercise)
  const openBlock = firstParam(rawSearchParams.openBlock)
  const replaceExercise = firstParam(rawSearchParams.replaceExercise)
  const legacy = firstParam(rawSearchParams.legacy)
  const showLegacy = firstParam(rawSearchParams.showLegacy)
  const blocks = firstParam(rawSearchParams.blocks)

  const supabase = await createUntypedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as unknown as { role: string | null } | null

  const isAdmin = profile?.role === 'admin'
  const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
  const backHref = isAdmin ? '/admin' : '/dashboard'

  async function deleteProgram(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
    const backHref = isAdmin ? '/admin' : '/dashboard'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`${basePath}/${id}?error=read_only`)
    }

    const { error } = await supabase.from('programs').delete().eq('id', id)
    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(basePath)
    redirect(backHref)
  }

  async function publishProgram(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    if (!isAdmin) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const { error } = await (supabase as unknown as MinimalProgramsPublishUpdate)
      .from('programs')
      .update({ is_published: true })
      .eq('id', id)

    if (error) {
      redirect(`/admin/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath('/programs')
    revalidatePath(`/programme/${id}`)
    revalidatePath(`/admin/programs/${id}`)
    redirect(`/admin/programs/${id}`)
  }

  const { data: programData, error } = await supabase
    .from('programs')
    .select(
      'id,coach_id,title,description,goal,level,duration,image_url,is_published,created_at'
    )
    .eq('id', id)
    .maybeSingle()

  const program = programData as unknown as {
    id: string
    coach_id: string
    title: string
    description: string | null
    goal: string | null
    level: string | null
    duration: string | null
    image_url: string | null
    is_published: boolean
    created_at: string
  } | null

  if (error || !program) {
    redirect(basePath)
  }

  const readOnly = !isAdmin && program.is_published

  const structureClient = supabase

  async function saveAllExercises(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!currentProgram || (!isAdmin && currentProgram.coach_id !== user.id)) {
      if (client === '1') throw new Error('read_only')
      redirect(`${basePath}/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`${basePath}/${id}?error=published_read_only`)
    }

    const descriptionRaw = String(formData.get('description') ?? '').trim()
    const goalRaw = String(formData.get('goal') ?? '').trim()
    const levelRaw = String(formData.get('level') ?? '').trim()
    const durationRaw = String(formData.get('duration') ?? '').trim()

    const updatePayload = {
      description: descriptionRaw || null,
      goal: goalRaw || null,
      level: levelRaw || null,
      duration: durationRaw || null,
    }

    const { error } = await (supabase as unknown as MinimalProgramsUpdate).from('programs').update(updatePayload).eq('id', id)
    if (error) {
      revalidatePath(`${basePath}/${id}`)
      if (client === '1') throw new Error(error.message)
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
    if (client === '1') return
    redirect(`${basePath}/${id}`)
  }

  async function updateProgramTitle(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const nextTitle = String(formData.get('title') ?? '').trim()

    const { data: currentProgramData } = await supabase.from('programs').select('id,coach_id').eq('id', id).maybeSingle()
    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        throw new Error('read_only')
      }
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const { error } = await (supabase as unknown as MinimalProgramsUpdate).from('programs').update({ title: nextTitle || null }).eq('id', id)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') {
        throw new Error(error.message)
      }
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function updateSessionsOrder(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const weekId = String(formData.get('week_id') ?? '')
    const orderedIdsJson = String(formData.get('ordered_session_ids_json') ?? '')
    const client = String(formData.get('client') ?? '')

    if (!weekId || !orderedIdsJson) {
      if (client === '1') {
        throw new Error('missing_ids')
      }
      redirect(`/dashboard/programs/${id}?error=missing_ids`)
    }

    let orderedIds: string[] = []
    try {
      const parsed = JSON.parse(orderedIdsJson) as unknown
      if (Array.isArray(parsed)) orderedIds = parsed.map((v) => String(v))
    } catch {
      if (client === '1') {
        throw new Error('invalid_ordered_ids')
      }
      redirect(`/dashboard/programs/${id}?error=invalid_ordered_ids`)
    }

    if (!orderedIds.length) return

    const { data: existing } = await supabase.from('sessions').select('id').eq('week_id', weekId)
    const existingIds = new Set(((existing ?? []) as unknown as { id: string }[]).map((r) => String(r.id)))

    for (const id of orderedIds) {
      if (!existingIds.has(String(id))) {
        if (client === '1') throw new Error('invalid_session_id')
        redirect(`/dashboard/programs/${id}?error=invalid_session_id`)
      }
    }

    for (let idx = 0; idx < orderedIds.length; idx++) {
      const sessionId = orderedIds[idx]
      const tmpBase = 1000000 + Math.floor(Date.now() % 1000000)
      const tmpOrder = tmpBase + idx
      const { error } = await supabase.from('sessions').update({ session_order: tmpOrder }).eq('id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    for (let idx = 0; idx < orderedIds.length; idx++) {
      const sessionId = orderedIds[idx]
      const nextOrder = idx + 1
      const { error } = await supabase.from('sessions').update({ session_order: nextOrder }).eq('id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function addExerciseToSession(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
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

    const newProgramExerciseId = String(insertedId)

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_exercise', {
      p_session_id: sessionId,
      p_program_exercise_id: newProgramExerciseId,
    })

    if (appendRes.error) {
      if (client === '1') {
        throw new Error(appendRes.error.message)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(appendRes.error.message)}`)
    }

    if (client === '1') {
      return {
        insertedId: newProgramExerciseId,
        tmpId: tmpId || null,
      }
    }

    revalidatePath(`${basePath}/${id}`)
  }

  async function replaceProgramExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '')

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
    
    const client = String(formData.get('client') ?? '')

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

  async function updateWeekMeta(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const weekId = String(formData.get('week_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const notesRaw = String(formData.get('notes') ?? '').trim()
    const notes = notesRaw ? notesRaw : null
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

    const { error } = await supabase.from('program_weeks').update({ title, notes }).eq('id', weekId)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') return
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)

    revalidatePath(`/dashboard/programs/${id}`)
    if (client === '1') return
    redirect(url.pathname + url.search)
  }

  async function updateSessionMeta(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const sessionId = String(formData.get('session_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()
    const descriptionRaw = String(formData.get('description') ?? '').trim()
    const description = descriptionRaw ? descriptionRaw : null
    const client = String(formData.get('client') ?? '')
    const returnOpenWeek = String(formData.get('openWeek') ?? '')
    const returnOpenSession = String(formData.get('openSession') ?? '')

    if (!sessionId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_id`)
    }

    const { data: session } = await supabase.from('sessions').select('id,week_id').eq('id', sessionId).maybeSingle()
    const typedSession = session as unknown as { id: string; week_id: string } | null
    if (!typedSession) {
      redirect(`/dashboard/programs/${id}?error=session_not_found`)
    }

    const { data: week } = await supabase
      .from('program_weeks')
      .select('id,program_id')
      .eq('id', typedSession.week_id)
      .maybeSingle()

    const typedWeek = week as unknown as { id: string; program_id: string } | null
    if (!typedWeek || typedWeek.program_id !== id) {
      redirect(`/dashboard/programs/${id}?error=invalid_week`)
    }

    const { error } = await supabase.from('sessions').update({ title, description }).eq('id', sessionId)

    if (error) {
      revalidatePath(`/dashboard/programs/${id}`)
      if (client === '1') return
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    const url = new URL(`/dashboard/programs/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)

    revalidatePath(`/dashboard/programs/${id}`)
    if (client === '1') return
    redirect(url.pathname + url.search)
  }

  async function updateProgramExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!currentProgram || (!isAdmin && currentProgram.coach_id !== user.id)) {
      if (client === '1') throw new Error('read_only')
      redirect(`${basePath}/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`${basePath}/${id}?error=published_read_only`)
    }

    const programExerciseId = String(formData.get('program_exercise_id') ?? '').trim()
    const sessionId = String(formData.get('session_id') ?? '').trim()

    if (!programExerciseId || !sessionId) {
      if (client === '1') throw new Error('missing_ids')
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const setsRaw = String(formData.get('sets') ?? '').trim()
    const repsRaw = String(formData.get('reps') ?? '').trim()
    const restTimeRaw = String(formData.get('rest_time') ?? '').trim()
    const rpeRaw = String(formData.get('rpe') ?? '').trim()
    const tempoRaw = String(formData.get('tempo') ?? '').trim()
    const loadRaw = String(formData.get('load') ?? '').trim()
    const notesRaw = String(formData.get('notes') ?? '').trim()

    const rpe = rpeRaw ? Number(rpeRaw) : null

    const payload = {
      sets: setsRaw || null,
      reps: repsRaw || null,
      rest_time: restTimeRaw || null,
      rpe: Number.isFinite(rpe as number) ? rpe : null,
      tempo: tempoRaw || null,
      load: loadRaw || null,
      notes: notesRaw || null,
    }

    const { error } = await supabase
      .from('program_exercises')
      .update(payload)
      .eq('id', programExerciseId)
      .eq('session_id', sessionId)

    if (error) {
      if (client === '1') {
        throw new Error(error.message)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
    if (client === '1') {
      return
    }

    redirect(`${basePath}/${id}`)
  }

  async function duplicateProgramExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'
    const client = String(formData.get('client') ?? '').trim()
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!currentProgram || (!isAdmin && currentProgram.coach_id !== user.id)) {
      if (client === '1') {
        throw new Error('read_only')
      }
      redirect(`${basePath}/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      if (client === '1') {
        throw new Error('published_read_only')
      }
      redirect(`${basePath}/${id}?error=published_read_only`)
    }

    const sessionId = String(formData.get('session_id') ?? '').trim()
    const programExerciseId = String(formData.get('program_exercise_id') ?? '').trim()
    const sourceSessionItemId = String(formData.get('source_session_item_id') ?? '').trim()

    if (!sessionId || !programExerciseId || !sourceSessionItemId) {
      if (client === '1') {
        throw new Error('missing_ids')
      }
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const { data: sourceRowData } = await supabase
      .from('program_exercises')
      .select('exercise_id,name,sets,reps,rest_time,rpe,tempo,load,notes')
      .eq('id', programExerciseId)
      .eq('session_id', sessionId)
      .maybeSingle()

    const sourceRow = sourceRowData as unknown as {
      exercise_id: string | null
      name: string
      sets: string | null
      reps: string | null
      rest_time: string | null
      rpe: number | null
      tempo: string | null
      load: string | null
      notes: string | null
    } | null

    if (!sourceRow) {
      if (client === '1') {
        throw new Error('source_not_found')
      }
      redirect(`${basePath}/${id}?error=source_not_found`)
    }

    const { data: maxOrderData } = await supabase
      .from('program_exercises')
      .select('exercise_order')
      .eq('session_id', sessionId)
      .order('exercise_order', { ascending: false })
      .limit(1)

    const typedMax = (maxOrderData ?? []) as unknown as { exercise_order: number | null }[]
    const maxOrder = typedMax[0]?.exercise_order ?? -1
    const nextOrder = Number.isFinite(maxOrder as number) ? (maxOrder as number) + 1 : 0

    type ProgramExerciseInsert = {
      session_id: string
      exercise_id: string | null
      name: string
      exercise_order: number
      sets: string | null
      reps: string | null
      rest_time: string | null
      rpe: number | null
      tempo: string | null
      load: string | null
      notes: string | null
    }

    const insertPayload: ProgramExerciseInsert = {
      session_id: sessionId,
      exercise_id: sourceRow.exercise_id,
      name: sourceRow.name,
      exercise_order: nextOrder,
      sets: sourceRow.sets,
      reps: sourceRow.reps,
      rest_time: sourceRow.rest_time,
      rpe: sourceRow.rpe,
      tempo: sourceRow.tempo,
      load: sourceRow.load,
      notes: sourceRow.notes,
    }

    const { data: insertedPe, error: insertError } = await supabase
      .from('program_exercises')
      .insert(insertPayload)
      .select('id')
      .maybeSingle()

    if (insertError || !insertedPe) {
      const msg = insertError?.message ?? 'insert_failed'
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newProgramExerciseId = String((insertedPe as unknown as { id: string }).id)

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_exercise', {
      p_session_id: sessionId,
      p_program_exercise_id: newProgramExerciseId,
    })

    if (appendRes.error) {
      const msg = appendRes.error.message
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const { data: allItemsData, error: itemsError } = await supabase
      .from('session_items')
      .select('id,position,kind,program_exercise_id')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })

    if (itemsError) {
      const msg = itemsError.message
      if (client === '1') {
        throw new Error(msg)
      }
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const allItems = (allItemsData ?? []) as unknown as {
      id: string
      position: number
      kind: string
      program_exercise_id: string | null
    }[]

    const created = allItems
      .filter((r) => r.kind === 'exercise' && r.program_exercise_id === newProgramExerciseId)
      .slice()
      .sort((a, b) => b.position - a.position)[0]
    const newSessionItemId = created?.id ?? null

    if (!newSessionItemId) {
      if (client === '1') {
        throw new Error('session_item_not_found')
      }
      redirect(`${basePath}/${id}?error=session_item_not_found`)
    }

    const sourcePos = allItems.find((r) => r.id === sourceSessionItemId)?.position
    const insertPosition = typeof sourcePos === 'number' ? sourcePos + 1 : allItems.length

    const currentIds = allItems.map((r) => r.id)
    const without = currentIds.filter((x) => x !== newSessionItemId)
    const clampedInsert = Math.max(0, Math.min(without.length, insertPosition))
    const orderedIds = without.slice(0, clampedInsert).concat([newSessionItemId]).concat(without.slice(clampedInsert))

    const minPos = allItems.length ? allItems[0]!.position : 0
    const tmpBase = minPos - orderedIds.length - 10

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const tmpPos = tmpBase + idx
      const { error } = await supabase
        .from('session_items')
        .update({ position: tmpPos })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') {
          throw new Error(error.message)
        }
        redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const { error } = await supabase
        .from('session_items')
        .update({ position: idx })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') {
          throw new Error(error.message)
        }
        redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    revalidatePath(`${basePath}/${id}`)
    if (client === '1') {
      return { newProgramExerciseId, newSessionItemId }
    }
  }

  async function duplicateSession(formData: FormData) {
    'use server'

    type SessionItemRow = {
      id: string
      position: number
      kind: string
      program_exercise_id: string | null
      session_block_id: string | null
    }

    type BlockExerciseRow = {
      position: number
      exercise_id: string
      exercise_name: string
      sets: number | null
      reps: number | null
      load_text: string | null
      rest_seconds: number | null
      notes: string | null
    }

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'
    const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'

    const sourceWeekId = String(formData.get('week_id') ?? '').trim()
    const sourceSessionId = String(formData.get('session_id') ?? '').trim()
    const returnOpenWeek = String(formData.get('openWeek') ?? '').trim()
    const returnOpenSession = String(formData.get('openSession') ?? '').trim()
    const client = String(formData.get('client') ?? '').trim()

    if (!sourceWeekId || !sourceSessionId) {
      if (client === '1') throw new Error('missing_ids')
      redirect(`${basePath}/${id}?error=missing_ids`)
    }

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!currentProgram || (!isAdmin && currentProgram.coach_id !== user.id)) {
      if (client === '1') throw new Error('read_only')
      redirect(`${basePath}/${id}?error=read_only`)
    }

    if (currentProgram.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`${basePath}/${id}?error=published_read_only`)
    }

    const { data: sessionRow } = await supabase
      .from('sessions')
      .select('id,week_id,session_order,title,description')
      .eq('id', sourceSessionId)
      .maybeSingle()

    const sourceSession = sessionRow as unknown as {
      id: string
      week_id: string
      session_order: number | null
      title: string | null
      description: string | null
    } | null

    if (!sourceSession || String(sourceSession.week_id) !== String(sourceWeekId)) {
      if (client === '1') throw new Error('invalid_session')
      redirect(`${basePath}/${id}?error=invalid_session`)
    }

    const { data: maxOrderData } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', sourceWeekId)
      .order('session_order', { ascending: false })
      .limit(1)

    const typedMaxOrder = (maxOrderData ?? []) as unknown as { session_order: number | null }[]
    const maxOrder = typedMaxOrder[0]?.session_order ?? -1
    const newOrder = Number.isFinite(maxOrder as number) ? (maxOrder as number) + 1 : 0

    const { data: insertedSessionData, error: insertSessionError } = await supabase
      .from('sessions')
      .insert({
        week_id: sourceWeekId,
        session_order: newOrder,
        title: sourceSession.title,
        description: sourceSession.description,
      })
      .select('id')
      .maybeSingle()

    const insertedSession = insertedSessionData as unknown as { id: string } | null
    if (insertSessionError || !insertedSession?.id) {
      const msg = insertSessionError?.message ?? 'duplicate_session_failed'
      if (client === '1') throw new Error(msg)
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newSessionId = insertedSession.id

    const { data: sourceItemsData, error: itemsError } = await supabase
      .from('session_items')
      .select('id,position,kind,program_exercise_id,session_block_id')
      .eq('session_id', sourceSessionId)
      .order('position', { ascending: true })

    if (itemsError) {
      const msg = itemsError.message
      if (client === '1') throw new Error(msg)
      redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
    }

    const sourceItems = (sourceItemsData ?? []) as unknown as SessionItemRow[]

    for (const it of sourceItems) {
      if (it.kind === 'exercise') {
        const sourcePeId = String(it.program_exercise_id ?? '')
        if (!sourcePeId) continue

        const { data: sourcePeData, error: peError } = await supabase
          .from('program_exercises')
          .select('exercise_id,name,sets,reps,rest_time,rpe,tempo,load,notes')
          .eq('id', sourcePeId)
          .eq('session_id', sourceSessionId)
          .maybeSingle()

        const sourcePe = sourcePeData as unknown as {
          exercise_id: string | null
          name: string
          sets: string | null
          reps: string | null
          rest_time: string | null
          rpe: number | null
          tempo: string | null
          load: string | null
          notes: string | null
        } | null

        if (peError || !sourcePe) {
          const msg = peError?.message ?? 'exercise_not_found'
          if (client === '1') throw new Error(msg)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
        }

        const { data: maxExOrderData } = await supabase
          .from('program_exercises')
          .select('exercise_order')
          .eq('session_id', newSessionId)
          .order('exercise_order', { ascending: false })
          .limit(1)

        const typedMaxEx = (maxExOrderData ?? []) as unknown as { exercise_order: number | null }[]
        const maxEx = typedMaxEx[0]?.exercise_order ?? -1
        const nextExOrder = Number.isFinite(maxEx as number) ? (maxEx as number) + 1 : 0

        const { data: insertedPe, error: insertPeError } = await supabase
          .from('program_exercises')
          .insert({
            session_id: newSessionId,
            exercise_id: sourcePe.exercise_id,
            name: sourcePe.name,
            exercise_order: nextExOrder,
            sets: sourcePe.sets,
            reps: sourcePe.reps,
            rest_time: sourcePe.rest_time,
            rpe: sourcePe.rpe,
            tempo: sourcePe.tempo,
            load: sourcePe.load,
            notes: sourcePe.notes,
          })
          .select('id')
          .maybeSingle()

        const newProgramExerciseId = String((insertedPe as unknown as { id?: string } | null)?.id ?? '')
        if (insertPeError || !newProgramExerciseId) {
          const msg = insertPeError?.message ?? 'insert_failed'
          if (client === '1') throw new Error(msg)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
        }

        const { error: insertItemError } = await supabase.from('session_items').insert({
          session_id: newSessionId,
          position: it.position,
          kind: 'exercise',
          program_exercise_id: newProgramExerciseId,
          session_block_id: null,
        })

        if (insertItemError) {
          if (client === '1') throw new Error(insertItemError.message)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(insertItemError.message)}`)
        }

        continue
      }

      if (it.kind === 'block') {
        const sourceBlockId = String(it.session_block_id ?? '')
        if (!sourceBlockId) continue

        const { data: sourceBlockData, error: sourceBlockError } = await supabase
          .from('session_blocks')
          .select('type,title,notes,crosstraining_style,rounds,timecap_seconds,rest_seconds,warmup_duration_seconds')
          .eq('id', sourceBlockId)
          .maybeSingle()

        if (sourceBlockError || !sourceBlockData) {
          const msg = sourceBlockError?.message ?? 'block_not_found'
          if (client === '1') throw new Error(msg)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
        }

        const sourceBlockPayload = sourceBlockData as unknown as {
          type: string
          title: string | null
          notes: string | null
          crosstraining_style: string | null
          rounds: number | null
          timecap_seconds: number | null
          rest_seconds: number | null
          warmup_duration_seconds: number | null
        }

        const { data: insertedBlockData, error: insertBlockError } = await supabase
          .from('session_blocks')
          .insert({
            program_session_id: newSessionId,
            position: it.position,
            type: sourceBlockPayload.type,
            title: sourceBlockPayload.title,
            notes: sourceBlockPayload.notes,
            crosstraining_style: sourceBlockPayload.crosstraining_style,
            rounds: sourceBlockPayload.rounds,
            timecap_seconds: sourceBlockPayload.timecap_seconds,
            rest_seconds: sourceBlockPayload.rest_seconds,
            warmup_duration_seconds: sourceBlockPayload.warmup_duration_seconds,
          })
          .select('id')
          .maybeSingle()

        const insertedBlock = insertedBlockData as unknown as { id: string } | null
        if (insertBlockError || !insertedBlock?.id) {
          const msg = insertBlockError?.message ?? 'insert_block_failed'
          if (client === '1') throw new Error(msg)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(msg)}`)
        }

        const { data: sourceBlockExercisesData, error: sourceBlockExercisesError } = await supabase
          .from('block_exercises')
          .select('position,exercise_id,exercise_name,sets,reps,load_text,rest_seconds,notes')
          .eq('session_block_id', sourceBlockId)
          .order('position', { ascending: true })

        if (sourceBlockExercisesError) {
          if (client === '1') throw new Error(sourceBlockExercisesError.message)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(sourceBlockExercisesError.message)}`)
        }

        const sourceBlockExercises = (sourceBlockExercisesData ?? []) as unknown as BlockExerciseRow[]

        if (sourceBlockExercises.length) {
          const payload = sourceBlockExercises.map((be) => ({
            session_block_id: insertedBlock.id,
            position: be.position,
            exercise_id: be.exercise_id,
            exercise_name: be.exercise_name,
            sets: be.sets,
            reps: be.reps,
            load_text: be.load_text,
            rest_seconds: be.rest_seconds,
            notes: be.notes,
          }))

          const { error: insertBlockExercisesError } = await supabase.from('block_exercises').insert(payload)
          if (insertBlockExercisesError) {
            if (client === '1') throw new Error(insertBlockExercisesError.message)
            redirect(`${basePath}/${id}?error=${encodeURIComponent(insertBlockExercisesError.message)}`)
          }
        }

        const { error: insertItemError } = await supabase.from('session_items').insert({
          session_id: newSessionId,
          position: it.position,
          kind: 'block',
          program_exercise_id: null,
          session_block_id: insertedBlock.id,
        })

        if (insertItemError) {
          if (client === '1') throw new Error(insertItemError.message)
          redirect(`${basePath}/${id}?error=${encodeURIComponent(insertItemError.message)}`)
        }
      }
    }

    revalidatePath(`${basePath}/${id}`)

    if (client === '1') {
      return { newSessionId }
    }

    const url = new URL(`${basePath}/${id}`, 'http://localhost')
    if (returnOpenWeek) url.searchParams.set('openWeek', returnOpenWeek)
    if (returnOpenSession) url.searchParams.set('openSession', returnOpenSession)
    redirect(url.pathname + url.search)
  }

  async function duplicateWeek(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

    const typedLast = last as unknown as { week_order: number } | null
    const nextOrder = (typedLast?.week_order ?? 0) + 1

    const { data: insertedRow, error } = await supabase
      .from('program_weeks')
      .insert({
        program_id: id,
        title,
        week_order: nextOrder,
      })
      .select('id,week_order,title,notes')
      .maybeSingle()

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return {
        newWeekId: (insertedRow as unknown as { id?: string } | null)?.id ?? null,
        week_order: (insertedRow as unknown as { week_order?: number | null } | null)?.week_order ?? null,
        title: (insertedRow as unknown as { title?: string | null } | null)?.title ?? null,
        notes: (insertedRow as unknown as { notes?: string | null } | null)?.notes ?? null,
      }
    }

    redirect(`/dashboard/programs/${id}`)
  }

  async function deleteWeek(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

    if (client === '1') {
      return
    }

    revalidatePath(`/dashboard/programs/${id}`)

    redirect(`/dashboard/programs/${id}`)
  }

  async function addSession(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

    if (!currentProgram || (currentProgram.coach_id !== user.id && !isAdmin)) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    const client = String(formData.get('client') ?? '')

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`/dashboard/programs/${id}?error=missing_week_id`)
    }

    const title = String(formData.get('title') ?? '').trim() || 'S├®ance'

    const { data: last } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const typedLast = last as unknown as { session_order: number } | null
    const nextOrder = (typedLast?.session_order ?? 0) + 1

    const { data: insertedData, error } = await supabase
      .from('sessions')
      .insert({
        week_id: weekId,
        title,
        session_order: nextOrder,
        description: null,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
    }

    if (client === '1') {
      const inserted = insertedData as unknown as { id?: string | null } | null
      return { newSessionId: inserted?.id ?? null }
    }

    revalidatePath(`/dashboard/programs/${id}`)

    redirect(`/dashboard/programs/${id}`)
  }

  async function deleteSession(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const { data: currentProgramData } = await supabase
      .from('programs')
      .select('id,coach_id')
      .eq('id', id)
      .maybeSingle()

    const currentProgram = currentProgramData as unknown as { id: string; coach_id: string } | null

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

  const { data: weeksData } = await structureClient
    .from('program_weeks')
    .select('id,title,week_order,notes')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  type WeekRow = { id: string; title: string; week_order: number; notes: string | null }
  const typedWeeks = (weeksData ?? []) as unknown as WeekRow[]

  const weekIds = typedWeeks.map((w) => w.id)

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

  type SessionBlockRow = {
    id: string
    program_session_id: string
    position: number
    type: string
    title: string | null
    notes: string | null
    crosstraining_style: string | null
    rounds: number | null
    timecap_seconds: number | null
    rest_seconds: number | null
    warmup_duration_seconds: number | null
  }

  type BlockExerciseRow = {
    id: string
    session_block_id: string
    position: number
    exercise_id: string | null
    exercise_name: string | null
    sets: number | null
    reps: number | null
    load_text: string | null
    rest_seconds: number | null
    notes: string | null
    exercise_library: { name: string } | null
  }

  type SessionItemRow = {
    id: string
    session_id: string
    position: number
    kind: string
    program_exercise_id: string | null
    session_block_id: string | null
  }

  const sessionBlocks: SessionBlockRow[] = sessionIds.length
    ? (((await structureClient
        .from('session_blocks')
        .select(
          'id,program_session_id,position,type,title,notes,crosstraining_style,rounds,timecap_seconds,rest_seconds,warmup_duration_seconds'
        )
        .in('program_session_id', sessionIds)
        .order('position', { ascending: true })).data ?? []) as unknown as SessionBlockRow[])
    : []

  const sessionItemsRes: PostgrestResponse = sessionIds.length
    ? await structureClient
        .from('session_items')
        .select('id,session_id,position,kind,program_exercise_id,session_block_id')
        .in('session_id', sessionIds)
        .order('position', { ascending: true })
    : { data: [], error: null }

  const sessionItems: SessionItemRow[] = (
    sessionItemsRes.error ? [] : ((sessionItemsRes.data ?? []) as unknown as SessionItemRow[])
  )

  const sessionBlockIds = sessionBlocks.map((b) => b.id)

  const blockExercises: BlockExerciseRow[] = sessionBlockIds.length
    ? (((await structureClient
        .from('block_exercises')
        .select('id,session_block_id,position,exercise_id,exercise_name,sets,reps,load_text,rest_seconds,notes,exercise_library(name)')
        .in('session_block_id', sessionBlockIds)
        .order('position', { ascending: true })).data ?? []) as unknown as BlockExerciseRow[])
    : []

  type ProgramExerciseRow = {
    id: string
    session_id: string
    exercise_id: string | null
    name: string | null
    exercise_order: number
    sets: number | null
    reps: number | null
    rest_time: string | null
    rpe: number | null
    tempo: string | null
    load: string | null
    notes: string | null
    exercise_library: { name: string; demo_media_path?: string | null } | null
    demo_media_url?: string | null
  }

  const programExercises: ProgramExerciseRow[] = sessionIds.length
    ? (((await structureClient
        .from('program_exercises')
        .select(
          'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,rpe,tempo,load,notes,exercise_library(name,demo_media_path)'
        )
        .in('session_id', sessionIds)
        .order('exercise_order', { ascending: true })).data ?? []) as unknown as ProgramExerciseRow[])
    : []

  const storageBucket = 'exercise-media'
  function normalizeStoragePath(p: string) {
    let out = p.trim()
    if (out.startsWith('/')) out = out.slice(1)
    if (out.startsWith(`${storageBucket}/`)) out = out.slice(storageBucket.length + 1)
    return out
  }

  function getStoragePathFromUrl(raw: string) {
    try {
      const u = new URL(raw)
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => p === 'object')
      if (idx === -1) return null
      const bucketIdx = idx + 2
      if (!parts[bucketIdx] || parts[bucketIdx] !== storageBucket) return null
      const internal = parts.slice(bucketIdx + 1).join('/')
      return internal || null
    } catch {
      return null
    }
  }

  const programExercisesList = (programExercises ?? []) as unknown as ProgramExerciseRow[]

  const uniquePathsSet = new Set<string>()
  for (const e of programExercisesList) {
    const p = e.exercise_library?.demo_media_path ?? null
    if (p) uniquePathsSet.add(p)
  }
  const uniquePaths: string[] = Array.from(uniquePathsSet)

  const signedUrlByPath = new Map<string, string>()
  const signedUrlTasks: Promise<void>[] = uniquePaths.map(async (path) => {
    const isHttp = /^https?:\/\//i.test(path)
    const internalFromUrl = isHttp ? getStoragePathFromUrl(path) : null
    const internalPath = internalFromUrl ?? (isHttp ? null : path)

    if (!internalPath) {
      signedUrlByPath.set(path, path)
      return
    }

    const { data } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)
    if (data?.signedUrl) {
      signedUrlByPath.set(path, data.signedUrl)
    }
  })

  await Promise.all(signedUrlTasks)

  const programExercisesWithMedia: ProgramExerciseRow[] = programExercises.map((e) => {
    const path = e.exercise_library?.demo_media_path ?? null
    const url = path ? signedUrlByPath.get(path) ?? null : null
    return { ...e, demo_media_url: url }
  })

  const exerciseIdsToHydrateSet = new Set<string>()
  for (const pe of programExercisesList) {
    const v = pe.exercise_id
    if (typeof v === 'string' && v.trim().length > 0) {
      exerciseIdsToHydrateSet.add(v)
    }
  }
  const exerciseIdsToHydrate = Array.from(exerciseIdsToHydrateSet)

  const { data: hydratedExercises } = exerciseIdsToHydrate.length
    ? await supabase.from('exercise_library').select('id,name').in('id', exerciseIdsToHydrate)
    : { data: [] as { id: string; name: string }[] | null }

  const exerciseNameById = new Map<string, string>()
  const typedHydratedExercises = (hydratedExercises ?? []) as unknown as { id: string; name: string }[]
  for (const row of typedHydratedExercises) {
    if (row?.id && row?.name) exerciseNameById.set(row.id, row.name)
  }

  const hydratedProgramExercises: ProgramExerciseRow[] = programExercisesWithMedia.map((pe) => {
    const libName = pe.exercise_library?.name
    if (libName && String(libName).trim()) return pe

    const nameFromLib = pe.exercise_id ? exerciseNameById.get(pe.exercise_id) : null
    if (!nameFromLib) return pe

    return {
      ...pe,
      exercise_library: { ...(pe.exercise_library ?? {}), name: nameFromLib },
      name: pe.name ?? nameFromLib,
    }
  })

  const exercisesBySession = new Map<string, ProgramExerciseRow[]>()
  for (const pe of hydratedProgramExercises) {
    const list = exercisesBySession.get(pe.session_id) ?? []
    list.push(pe)
    exercisesBySession.set(pe.session_id, list)
  }

  const replaceExerciseId = normalizeFilter(replaceExercise)

  const legacyFlag = String(legacy ?? showLegacy ?? '').trim()
  const legacyFlagLower = legacyFlag.toLowerCase()
  const shouldShowLegacyStructure = legacyFlagLower === '1' || legacyFlagLower === 'true'

  const blocksFlag = String(blocks ?? '').trim().toLowerCase()
  const shouldShowBlocksEditor = blocksFlag === '1' || blocksFlag === 'true' || Boolean(openBlock)

  const { data: muscleGroupsData } = await supabase
    .from('exercise_library')
    .select('muscle_group')
    .not('muscle_group', 'is', null)
    .order('muscle_group', { ascending: true })

  const muscleGroups = (muscleGroupsData ?? []) as unknown as { muscle_group: string | null }[]

  const uniqueMuscles: string[] = Array.from(
    new Set(muscleGroups.map((m) => m.muscle_group).filter((m): m is string => !!m))
  )

  const { data: exerciseLibraryDataForPanel } = await supabase
    .from('exercise_library')
    .select('id,name,muscle_group')
    .order('name', { ascending: true })
    .limit(50)

  const exerciseLibraryForPanel = (exerciseLibraryDataForPanel ?? []) as unknown as {
    id: string
    name: string | null
    muscle_group: string | null
  }[]

  async function addBlock(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()

    const sessionId = String(formData.get('session_id') ?? '').trim()
    const rawType = String(formData.get('type') ?? '').trim().toLowerCase()
    const rawTitle = String(formData.get('title') ?? '').trim()
    if (!sessionId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_id`)
    }

    const allowedTypes = new Set(['strength', 'warmup', 'crosstraining', 'cardio', 'mobility'])
    const type = allowedTypes.has(rawType) ? rawType : 'strength'
    const title = rawTitle ? rawTitle : null

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null

    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { data: existingBlocks } = await supabase
      .from('session_blocks')
      .select('position')
      .eq('program_session_id', sessionId)
      .order('position', { ascending: false })
      .limit(1)

    const typedExistingBlocks = (existingBlocks ?? []) as unknown as { position: number | null }[]
    const maxPos = (typedExistingBlocks[0]?.position ?? -1) as unknown as number
    const position = Number.isFinite(maxPos) ? maxPos + 1 : 0

    const { data: insertedBlockData, error: insertError } = await supabase
      .from('session_blocks')
      .insert({
        program_session_id: sessionId,
        position,
        type,
        title,
        notes: null,
      })
      .select('id')
      .maybeSingle()

    if (insertError) {
      if (client === '1') throw new Error(insertError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(insertError.message)}`)
    }

    const newBlockId = (insertedBlockData as unknown as { id?: string } | null)?.id ?? null
    if (!newBlockId) {
      redirect(`/dashboard/programs/${id}?error=block_insert_failed`)
    }

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_block', {
      p_session_id: sessionId,
      p_session_block_id: newBlockId,
    })

    if (appendRes.error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(appendRes.error.message)}`)
    }

    if (client === '1') {
      const { data: newItemsData } = await supabase
        .from('block_exercises')
        .select('id,session_block_id,position,exercise_id,exercise_name,sets,reps,load_text,rest_seconds,notes,exercise_library(name)')
        .eq('session_block_id', newBlockId)
        .order('position', { ascending: true })

      const newBlockExercises = (newItemsData ?? []) as unknown as BlockExerciseRow[]
      return { newBlockId, newBlockExercises }
    }
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function updateBlock(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const blockId = String(formData.get('session_block_id') ?? '').trim()
    const rawTitle = String(formData.get('title') ?? '').trim()
    const rawNotes = String(formData.get('notes') ?? '').trim()
    const rawStyle = String(formData.get('crosstraining_style') ?? '').trim()

    if (!blockId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_block_id`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null

    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const title = rawTitle ? rawTitle : null
    const notes = rawNotes ? rawNotes : null
    const crosstraining_style = rawStyle ? rawStyle : null

    const { error: updateError } = await supabase
      .from('session_blocks')
      .update({ title, notes, crosstraining_style })
      .eq('id', blockId)
    if (updateError) {
      if (client === '1') throw new Error(updateError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(updateError.message)}`)
    }

    if (client === '1') return
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function deleteBlockExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const blockExerciseId = String(formData.get('block_exercise_id') ?? '').trim()
    if (!blockExerciseId) {
      if (client === '1') throw new Error('missing_block_exercise_id')
      redirect(`/dashboard/programs/${id}?error=missing_block_exercise_id`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null

    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { error: deleteError } = await supabase.from('block_exercises').delete().eq('id', blockExerciseId)
    if (deleteError) {
      if (client === '1') throw new Error(deleteError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(deleteError.message)}`)
    }

    if (client === '1') return
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function insertSessionItemBlockAtPosition(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const sessionId = String(formData.get('session_id') ?? '').trim()
    const rawType = String(formData.get('type') ?? '').trim().toLowerCase()
    const rawTitle = String(formData.get('title') ?? '').trim()
    const rawInsertPos = String(formData.get('insert_position') ?? '').trim()
    const insertPosition = Number.parseInt(rawInsertPos, 10)

    if (!sessionId || !Number.isFinite(insertPosition)) {
      if (client === '1') throw new Error('missing_ids')
      redirect(`/dashboard/programs/${id}?error=missing_ids`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const allowedTypes = new Set(['strength', 'warmup', 'crosstraining', 'cardio', 'mobility'])
    const type = allowedTypes.has(rawType) ? rawType : 'strength'
    const title = rawTitle ? rawTitle : null

    const { data: existingBlocks } = await supabase
      .from('session_blocks')
      .select('position')
      .eq('program_session_id', sessionId)
      .order('position', { ascending: false })
      .limit(1)

    const typedExistingBlocks = (existingBlocks ?? []) as unknown as { position: number | null }[]
    const maxPos = (typedExistingBlocks[0]?.position ?? -1) as unknown as number
    const blockPosition = Number.isFinite(maxPos) ? maxPos + 1 : 0

    const { data: insertedBlockData, error: insertError } = await supabase
      .from('session_blocks')
      .insert({
        program_session_id: sessionId,
        position: blockPosition,
        type,
        title,
        notes: null,
      })
      .select('id')
      .maybeSingle()

    if (insertError) {
      const msg = insertError.message
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newBlockId = (insertedBlockData as unknown as { id?: string } | null)?.id ?? null
    if (!newBlockId) {
      if (client === '1') throw new Error('block_insert_failed')
      redirect(`/dashboard/programs/${id}?error=block_insert_failed`)
    }

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_block', {
      p_session_id: sessionId,
      p_session_block_id: newBlockId,
    })
    if (appendRes.error) {
      const msg = appendRes.error.message
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const { data: allItemsData, error: itemsError } = await supabase
      .from('session_items')
      .select('id,position,kind,session_block_id')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })

    if (itemsError) {
      const msg = itemsError.message
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const allItems = (allItemsData ?? []) as unknown as {
      id: string
      position: number
      kind: string
      session_block_id: string | null
    }[]

    const created = allItems
      .filter((r) => r.kind === 'block' && r.session_block_id === newBlockId)
      .slice()
      .sort((a, b) => b.position - a.position)[0]
    const newSessionItemId = created?.id ?? null

    if (!newSessionItemId) {
      if (client === '1') throw new Error('session_item_not_found')
      redirect(`/dashboard/programs/${id}?error=session_item_not_found`)
    }

    const currentIds = allItems.map((r) => r.id)
    const without = currentIds.filter((x) => x !== newSessionItemId)
    const clampedInsert = Math.max(0, Math.min(without.length, insertPosition))
    const orderedIds = without.slice(0, clampedInsert).concat([newSessionItemId]).concat(without.slice(clampedInsert))

    const minPos = allItems.length ? allItems[0]!.position : 0
    const tmpBase = minPos - orderedIds.length - 10

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const tmpPos = tmpBase + idx
      const { error } = await supabase
        .from('session_items')
        .update({ position: tmpPos })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const { error } = await supabase
        .from('session_items')
        .update({ position: idx })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)

    if (client === '1') {
      return { newBlockId, newSessionItemId }
    }
  }

  async function insertSessionItemExerciseAtPosition(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const sessionId = String(formData.get('session_id') ?? '').trim()
    const exerciseId = String(formData.get('exercise_id') ?? '').trim()
    const rawInsertPos = String(formData.get('insert_position') ?? '').trim()
    const insertPosition = Number.parseInt(rawInsertPos, 10)

    if (!sessionId || !exerciseId || !Number.isFinite(insertPosition)) {
      if (client === '1') throw new Error('missing_ids')
      redirect(`/dashboard/programs/${id}?error=missing_ids`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { data: insertedId, error: insertPeError } = await (supabase as unknown as RpcClient).rpc('insert_program_exercise', {
      p_session_id: sessionId,
      p_exercise_id: exerciseId,
    })

    if (insertPeError || !insertedId) {
      const msg = insertPeError?.message ?? 'insert_failed'
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const newProgramExerciseId = String(insertedId)

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_exercise', {
      p_session_id: sessionId,
      p_program_exercise_id: newProgramExerciseId,
    })
    if (appendRes.error) {
      const msg = appendRes.error.message
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const { data: allItemsData, error: itemsError } = await supabase
      .from('session_items')
      .select('id,position,kind,program_exercise_id')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })

    if (itemsError) {
      const msg = itemsError.message
      if (client === '1') throw new Error(msg)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(msg)}`)
    }

    const allItems = (allItemsData ?? []) as unknown as {
      id: string
      position: number
      kind: string
      program_exercise_id: string | null
    }[]

    const created = allItems
      .filter((r) => r.kind === 'exercise' && r.program_exercise_id === newProgramExerciseId)
      .slice()
      .sort((a, b) => b.position - a.position)[0]
    const newSessionItemId = created?.id ?? null

    if (!newSessionItemId) {
      if (client === '1') throw new Error('session_item_not_found')
      redirect(`/dashboard/programs/${id}?error=session_item_not_found`)
    }

    const currentIds = allItems.map((r) => r.id)
    const without = currentIds.filter((x) => x !== newSessionItemId)
    const clampedInsert = Math.max(0, Math.min(without.length, insertPosition))
    const orderedIds = without.slice(0, clampedInsert).concat([newSessionItemId]).concat(without.slice(clampedInsert))

    const minPos = allItems.length ? allItems[0]!.position : 0
    const tmpBase = minPos - orderedIds.length - 10

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const tmpPos = tmpBase + idx
      const { error } = await supabase.from('session_items').update({ position: tmpPos }).eq('id', itemId).eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const { error } = await supabase.from('session_items').update({ position: idx }).eq('id', itemId).eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    if (client === '1') {
      return { newProgramExerciseId, newSessionItemId }
    }

    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function updateSessionItemsOrder(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()
    const sessionId = String(formData.get('session_id') ?? '').trim()
    const rawIds = String(formData.get('ordered_ids_json') ?? '').trim()
    if (!sessionId || !rawIds) {
      if (client === '1') throw new Error('missing_ids')
      redirect(`/dashboard/programs/${id}?error=missing_ids`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    let orderedIds: string[] = []
    try {
      const parsed = JSON.parse(rawIds) as unknown
      orderedIds = Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
    } catch {
      orderedIds = []
    }

    if (orderedIds.length === 0) {
      if (client === '1') throw new Error('invalid_payload')
      redirect(`/dashboard/programs/${id}?error=invalid_payload`)
    }

    const { data: minRow, error: minError } = await supabase
      .from('session_items')
      .select('position')
      .eq('session_id', sessionId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (minError) {
      if (client === '1') throw new Error(minError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(minError.message)}`)
    }

    const minPos = (minRow as unknown as { position: number | null } | null)?.position ?? 0
    const tmpBase = minPos - orderedIds.length - 10

    // Pass 1: move every involved row to a temporary unique position (avoids unique constraint collisions)
    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const tmpPos = tmpBase + idx
      const { error } = await supabase
        .from('session_items')
        .update({ position: tmpPos })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    // Pass 2: apply the final positions
    for (let idx = 0; idx < orderedIds.length; idx += 1) {
      const itemId = orderedIds[idx]
      const { error } = await supabase
        .from('session_items')
        .update({ position: idx })
        .eq('id', itemId)
        .eq('session_id', sessionId)
      if (error) {
        if (client === '1') throw new Error(error.message)
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(error.message)}`)
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function deleteBlock(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()

    const blockId = String(formData.get('session_block_id') ?? '').trim()
    if (!blockId) {
      if (client === '1') throw new Error('missing_session_block_id')
      redirect(`/dashboard/programs/${id}?error=missing_session_block_id`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { error: deleteSessionItemError } = await supabase
      .from('session_items')
      .delete()
      .eq('session_block_id', blockId)
      .eq('kind', 'block')
    if (deleteSessionItemError) {
      if (client === '1') throw new Error(deleteSessionItemError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(deleteSessionItemError.message)}`)
    }

    const { error: deleteItemsError } = await supabase.from('block_exercises').delete().eq('session_block_id', blockId)
    if (deleteItemsError) {
      if (client === '1') throw new Error(deleteItemsError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(deleteItemsError.message)}`)
    }

    const { error: deleteBlockError } = await supabase.from('session_blocks').delete().eq('id', blockId)
    if (deleteBlockError) {
      if (client === '1') throw new Error(deleteBlockError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(deleteBlockError.message)}`)
    }

    if (client === '1') return
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function duplicateBlock(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()

    const blockId = String(formData.get('session_block_id') ?? '').trim()
    if (!blockId) {
      redirect(`/dashboard/programs/${id}?error=missing_session_block_id`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null
    if (!programForCheck) {
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { data: sourceBlockData, error: sourceBlockError } = await supabase
      .from('session_blocks')
      .select('id,program_session_id,type,title,notes,crosstraining_style,rounds,timecap_seconds,rest_seconds,warmup_duration_seconds')
      .eq('id', blockId)
      .maybeSingle()

    if (sourceBlockError) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(sourceBlockError.message)}`)
    }

    const sourceBlock = sourceBlockData as unknown as
      | {
          program_session_id: string
          type: string
          title: string | null
          notes: string | null
          crosstraining_style: string | null
          rounds: number | null
          timecap_seconds: number | null
          rest_seconds: number | null
          warmup_duration_seconds: number | null
        }
      | null

    if (!sourceBlock) {
      redirect(`/dashboard/programs/${id}?error=block_not_found`)
    }

    const { data: existingBlocks } = await supabase
      .from('session_blocks')
      .select('position')
      .eq('program_session_id', sourceBlock.program_session_id)
      .order('position', { ascending: false })
      .limit(1)

    const typedExistingBlocks = (existingBlocks ?? []) as unknown as { position: number | null }[]
    const maxPos = (typedExistingBlocks[0]?.position ?? -1) as unknown as number
    const position = Number.isFinite(maxPos) ? maxPos + 1 : 0

    const { data: insertedBlockData, error: insertError } = await supabase
      .from('session_blocks')
      .insert({
        program_session_id: sourceBlock.program_session_id,
        position,
        type: sourceBlock.type,
        title: sourceBlock.title ? `${sourceBlock.title} (copie)` : '(copie)',
        notes: sourceBlock.notes,
        crosstraining_style: sourceBlock.crosstraining_style,
        rounds: sourceBlock.rounds,
        timecap_seconds: sourceBlock.timecap_seconds,
        rest_seconds: sourceBlock.rest_seconds,
        warmup_duration_seconds: sourceBlock.warmup_duration_seconds,
      })
      .select('id')
      .maybeSingle()

    if (insertError) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(insertError.message)}`)
    }

    const newBlockId = (insertedBlockData as unknown as { id?: string } | null)?.id ?? null
    if (!newBlockId) {
      redirect(`/dashboard/programs/${id}?error=duplicate_block_failed`)
    }

    const appendRes = await (supabase as unknown as RpcClient).rpc('append_session_item_block', {
      p_session_id: sourceBlock.program_session_id,
      p_session_block_id: newBlockId,
    })

    if (appendRes.error) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(appendRes.error.message)}`)
    }

    const { data: sourceItemsData } = await supabase
      .from('block_exercises')
      .select('position,exercise_id,exercise_name,sets,reps,load_text,rest_seconds,notes')
      .eq('session_block_id', blockId)
      .order('position', { ascending: true })

    const sourceItems = (sourceItemsData ?? []) as unknown as {
      position: number | null
      exercise_id: string | null
      exercise_name: string | null
      sets: number | null
      reps: number | null
      load_text: string | null
      rest_seconds: number | null
      notes: string | null
    }[]

    if (sourceItems.length) {
      const payload = sourceItems.map((it) => ({
        session_block_id: newBlockId,
        position: it.position,
        exercise_id: it.exercise_id,
        exercise_name: it.exercise_name,
        sets: it.sets,
        reps: it.reps,
        load_text: it.load_text,
        rest_seconds: it.rest_seconds,
        notes: it.notes,
      }))

      const { error: insertItemsError } = await supabase.from('block_exercises').insert(payload)
      if (insertItemsError) {
        redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(insertItemsError.message)}`)
      }
    }

    if (client === '1') {
      return { newBlockId }
    }
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function updateBlockExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()

    const blockExerciseId = String(formData.get('block_exercise_id') ?? '').trim()
    const loadTextRaw = String(formData.get('load_text') ?? '').trim()
    const notesRaw = String(formData.get('notes') ?? '').trim()

    if (!blockExerciseId) {
      if (client === '1') throw new Error('missing_block_exercise_id')
      redirect(`/dashboard/programs/${id}?error=missing_block_exercise_id`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null

    if (!programForCheck) {
      if (client === '1') throw new Error('program_not_found')
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      if (client === '1') throw new Error('read_only')
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      if (client === '1') throw new Error('published_read_only')
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const loadText = loadTextRaw ? loadTextRaw : null
    const notes = notesRaw ? notesRaw : null
    const { error: updateError } = await supabase
      .from('block_exercises')
      .update({ load_text: loadText, notes })
      .eq('id', blockExerciseId)
    if (updateError) {
      if (client === '1') throw new Error(updateError.message)
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(updateError.message)}`)
    }

    if (client === '1') return
    revalidatePath(`/dashboard/programs/${id}`)
  }

  async function addBlockExercise(formData: FormData) {
    'use server'

    const supabase = await createUntypedClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as unknown as { role: string | null } | null
    const isAdmin = profile?.role === 'admin'

    const client = String(formData.get('client') ?? '').trim()

    const sessionBlockId = String(formData.get('session_block_id') ?? '').trim()
    const exerciseId = String(formData.get('exercise_id') ?? '').trim()
    const exerciseNameRaw = String(formData.get('exercise_name') ?? '').trim()
    const rawNotes = String(formData.get('notes') ?? '').trim()

    const setsRaw = String(formData.get('sets') ?? '').trim()
    const repsRaw = String(formData.get('reps') ?? '').trim()
    const loadTextRaw = String(formData.get('load_text') ?? '').trim()
    const loadText = loadTextRaw ? loadTextRaw : null

    if (!sessionBlockId) {
      if (client === '1') throw new Error('missing_session_block_id')
      redirect(`/dashboard/programs/${id}?error=missing_session_block_id`)
    }

    if (!exerciseId && !exerciseNameRaw) {
      if (client === '1') return
      redirect(`/dashboard/programs/${id}?error=missing_exercise`)
    }

    const { data: programForCheckData } = await supabase
      .from('programs')
      .select('id,coach_id,is_published')
      .eq('id', id)
      .maybeSingle()

    const programForCheck = programForCheckData as unknown as { id: string; coach_id: string; is_published: boolean } | null

    if (!programForCheck) {
      redirect(`/dashboard/programs/${id}?error=program_not_found`)
    }

    if (!isAdmin && programForCheck.coach_id !== user.id) {
      redirect(`/dashboard/programs/${id}?error=read_only`)
    }

    if (programForCheck.is_published) {
      redirect(`/dashboard/programs/${id}?error=published_read_only`)
    }

    const { data: existingItems } = await supabase
      .from('block_exercises')
      .select('position')
      .eq('session_block_id', sessionBlockId)
      .order('position', { ascending: false })
      .limit(1)

    const typedExistingItems = (existingItems ?? []) as unknown as { position: number | null }[]
    const maxPos = (typedExistingItems[0]?.position ?? -1) as unknown as number
    const position = Number.isFinite(maxPos) ? maxPos + 1 : 0

    const notes = rawNotes ? rawNotes : null

    const setsNumber = setsRaw ? Number(setsRaw) : null
    const repsNumber = repsRaw ? Number(repsRaw) : null
    const sets = Number.isFinite(setsNumber as number) ? setsNumber : null
    const reps = Number.isFinite(repsNumber as number) ? repsNumber : null

    const { data: insertedRow, error: insertError } = await supabase
      .from('block_exercises')
      .insert({
      session_block_id: sessionBlockId,
      position,
      exercise_id: exerciseId ? exerciseId : null,
      exercise_name: exerciseId ? null : exerciseNameRaw,
      sets,
      reps,
      load_text: loadText,
      rest_seconds: null,
      notes,
      })
      .select('id,position')
      .maybeSingle()

    if (insertError) {
      redirect(`/dashboard/programs/${id}?error=${encodeURIComponent(insertError.message)}`)
    }

    if (client === '1') {
      return {
        newBlockExerciseId: (insertedRow as unknown as { id?: string } | null)?.id ?? null,
        position: (insertedRow as unknown as { position?: number | null } | null)?.position ?? null,
      }
    }

    revalidatePath(`/dashboard/programs/${id}`)
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 pb-12 md:px-8">
      <ScrollToHash />

      <header className="sticky top-16 z-30 -mx-4 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[var(--brand)]">Program Builder</div>
            <div className="mt-1 min-w-0">
              <EditableProgramTitleClient initialTitle={program.title} readOnly={readOnly} updateProgramTitleAction={updateProgramTitle} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {readOnly ? (
              <div className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-[var(--brand)] ring-1 ring-gray-200">
                Lecture seule
              </div>
            ) : (
              <Link
                href={`/programme/${program.id}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10"
              >
                Voir le rendu
              </Link>
            )}

            {isAdmin && !program.is_published ? (
              <form action={publishProgram}>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-[var(--brand)] shadow-sm hover:bg-gray-50"
                >
                  Publier
                </button>
              </form>
            ) : null}

            {!readOnly ? (
              <>
                <form id="delete-program-form" action={deleteProgram}>
                  <input type="hidden" name="client" value="1" />
                </form>
                <DeleteProgramConfirmClient formId="delete-program-form" />
              </>
            ) : null}

            <Link
              href={backHref}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-900"
              aria-label="Retour"
            >
              <IconBack className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

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
                  <div className="text-xs font-extrabold text-[var(--brand)]">Dur├®e</div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900">{program.duration ?? ''}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6">
            <PublicProgramStructureReadOnlyClient
              programId={program.id}
              weeks={typedWeeks}
              sessions={sessions}
              programExercises={programExercisesWithMedia}
              exerciseDetailHrefPrefix="/dashboard/exercises"
              programDetailHref={`/dashboard/programs/${program.id}`}
              initialOpenWeekId={openWeek ?? null}
              initialOpenSessionId={openSession ?? null}
              initialOpenExerciseId={openExercise ?? null}
            />
          </div>
        </>
      ) : (
        <>
          <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="text-xs font-extrabold text-[var(--brand)]">Infos g├®n├®rales</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">Ces infos appara├«tront en haut de la page programme.</div>

            <form id="save-all-exercises" action={saveAllExercises} className="mt-3 grid gap-3">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Description</span>
                  <textarea
                    name="description"
                    rows={2}
                    defaultValue={program.description ?? ''}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Objectif</span>
                  <input
                    name="goal"
                    defaultValue={program.goal ?? ''}
                    className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Niveau</span>
                  <select name="level" defaultValue={program.level ?? ''} className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm">
                    <option value="">S├®lectionnerÔÇª</option>
                    <option value="D├®butant">D├®butant</option>
                    <option value="Interm├®diaire">Interm├®diaire</option>
                    <option value="Confirm├®">Confirm├®</option>
                  </select>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-sm font-semibold text-gray-800">Dur├®e</span>
                  <input
                    name="duration"
                    defaultValue={program.duration ?? ''}
                    className="h-9 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                    placeholder="8 semaines"
                  />
                </label>
              </div>
            </form>
          </section>

          <section className="mt-6">
            {shouldShowLegacyStructure ? (
              <div className="grid gap-4 md:grid-cols-[minmax(320px,1fr)_2fr_minmax(360px,1fr)]">
                <div />

                <div className="md:sticky md:top-[136px]">
                  {/** Legacy editor expects action handlers returning void/Promise<void>. */}
                  {(() => {
                    const addBlockLegacy = async (fd: FormData) => {
                      await addBlock(fd)
                    }
                    const addWeekLegacy = async (fd: FormData) => {
                      await addWeek(fd)
                    }
                    const addSessionLegacy = async (fd: FormData) => {
                      await addSession(fd)
                    }
                    const addExerciseToSessionLegacy = async (fd: FormData) => {
                      await addExerciseToSession(fd)
                    }
                    const addBlockExerciseLegacy = async (fd: FormData) => {
                      await addBlockExercise(fd)
                    }

                    return (
                      <>
                  {shouldShowBlocksEditor ? (
                    <ProgramBlocksEditorClient
                      readOnly={readOnly}
                      sessions={sessions}
                      sessionBlocks={sessionBlocks}
                      blockExercises={blockExercises}
                      exerciseLibrary={exerciseLibraryForPanel}
                      openSession={openSession}
                      openBlockId={openBlock}
                      addBlockAction={addBlock}
                      updateBlockAction={updateBlock}
                      addBlockExerciseAction={addBlockExerciseLegacy}
                    />
                  ) : null}

                  <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <div className="text-xs font-extrabold text-[var(--brand)]">Structure</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Semaines & trainings</div>

                    <ProgramStructureClient
                      programId={id}
                      readOnly={readOnly}
                      weeks={typedWeeks}
                      sessions={sessions}
                      programExercises={hydratedProgramExercises}
                      sessionBlocks={sessionBlocks}
                      blockExercises={blockExercises}
                      openWeek={openWeek}
                      openSession={openSession}
                      replaceExerciseId={replaceExerciseId ?? undefined}
                      uniqueMuscles={uniqueMuscles}
                      addBlockAction={addBlockLegacy}
                      updateBlockAction={updateBlock}
                      deleteBlockAction={deleteBlock}
                      duplicateBlockAction={duplicateBlock}
                      addWeekAction={addWeekLegacy}
                      deleteWeekAction={deleteWeek}
                      duplicateWeekAction={duplicateWeek}
                      addSessionAction={addSessionLegacy}
                      deleteSessionAction={deleteSession}
                      duplicateSessionAction={duplicateSession}
                      updateWeekTitleAction={updateWeekMeta}
                      updateSessionTitleAction={updateSessionMeta}
                      addExerciseToSessionAction={addExerciseToSessionLegacy}
                      addBlockExerciseAction={addBlockExerciseLegacy}
                      updateBlockExerciseAction={updateBlockExercise}
                      replaceProgramExerciseAction={replaceProgramExercise}
                      deleteProgramExerciseAction={deleteProgramExercise}
                    />
                  </div>
                      </>
                    )
                  })()}
                </div>

                <div className="md:sticky md:top-[136px] md:h-[calc(100vh-120px)]">
                  <div className="h-full overflow-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                    <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Biblioth├¿que</div>

                    <div className="mt-3 rounded-2xl bg-gray-50 p-2 ring-1 ring-gray-200">
                      <div className="grid gap-1.5">
                        {exerciseLibraryForPanel.map((it, idx) => (
                          <div key={`${it.id}-${idx}`} className="rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-gray-200">
                            <div className="truncate text-[13px] font-extrabold text-gray-900">
                              {idx + 1}. {String(it.name ?? '').trim() || 'ÔÇö'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <ProgramStructureTimelineV2Client
                weeks={typedWeeks}
                sessions={sessions}
                programExercises={hydratedProgramExercises}
                sessionBlocks={sessionBlocks}
                blockExercises={blockExercises}
                sessionItems={sessionItems}
                openWeek={openWeek}
                openSession={openSession}
                openBlockId={openBlock}
                addWeekAction={addWeek}
                addSessionAction={addSession}
                deleteWeekAction={deleteWeek}
                duplicateWeekAction={duplicateWeek}
                deleteSessionAction={deleteSession}
                duplicateSessionAction={duplicateSession}
                updateBlockAction={updateBlock}
                updateSessionItemsOrderAction={updateSessionItemsOrder}
                updateSessionsOrderAction={updateSessionsOrder}
                insertSessionItemBlockAtPositionAction={insertSessionItemBlockAtPosition}
                exerciseLibrary={exerciseLibraryForPanel}
                muscleGroups={uniqueMuscles}
                insertSessionItemExerciseAtPositionAction={insertSessionItemExerciseAtPosition}
                addBlockExerciseAction={addBlockExercise}
                deleteBlockAction={deleteBlock}
                duplicateBlockAction={duplicateBlock}
                deleteProgramExerciseAction={deleteProgramExercise}
                updateProgramExerciseAction={updateProgramExercise}
                duplicateProgramExerciseAction={duplicateProgramExercise}
                updateWeekMetaAction={updateWeekMeta}
                updateSessionMetaAction={updateSessionMeta}
                renderBlockEditor={
                  <ProgramBlocksEditorClient
                    embedded
                    readOnly={readOnly}
                    sessions={sessions}
                    sessionBlocks={sessionBlocks}
                    blockExercises={blockExercises}
                    exerciseLibrary={exerciseLibraryForPanel}
                    openSession={openSession}
                    openBlockId={openBlock}
                    addBlockAction={addBlock}
                    updateBlockAction={updateBlock}
                    addBlockExerciseAction={addBlockExercise}
                    updateBlockExerciseAction={updateBlockExercise}
                    deleteBlockExerciseAction={deleteBlockExercise}
                  />
                }
              />
            )}
          </section>
        </>
      )}
    </main>
  )
}
