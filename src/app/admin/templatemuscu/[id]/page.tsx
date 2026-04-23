import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { createClient } from '../../../../lib/supabase/server'
import EditableProgramTitleClient from '../../../../components/EditableProgramTitleClient'
import ProgramStructureClient from '../../../../components/ProgramStructureClient'
import SaveAllExercisesClient from '../../../../components/SaveAllExercisesClient'

type UntypedSupabaseClient = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  from: (table: string) => PostgrestBuilder
}

type PostgrestResponse = { data: unknown; error: { message: string } | null }

type PostgrestBuilder = PromiseLike<PostgrestResponse> & {
  select: (columns: string, options?: Record<string, unknown>) => PostgrestBuilder
  eq: (column: string, value: unknown) => PostgrestBuilder
  in: (column: string, values: unknown[]) => PostgrestBuilder
  order: (column: string, options?: { ascending?: boolean }) => PostgrestBuilder
  limit: (count: number) => PostgrestBuilder
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => PostgrestBuilder
  update: (values: Record<string, unknown>) => PostgrestBuilder
  delete: () => PostgrestBuilder
}

async function createUntypedClient(): Promise<UntypedSupabaseClient> {
  return (await createClient()) as unknown as UntypedSupabaseClient
}

type WeekRow = {
  id: string
  title: string
  week_order: number
}

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

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

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: {
    openWeek?: string | string[]
    openSession?: string | string[]
    replaceExercise?: string | string[]
  }
}

export default async function AdminTemplateMuscuDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params

  const supabase = await createUntypedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const profile = profileData as unknown as { role: string | null } | null
  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  const openWeek = Array.isArray(searchParams?.openWeek) ? searchParams?.openWeek[0] : searchParams?.openWeek
  const openSession = Array.isArray(searchParams?.openSession) ? searchParams?.openSession[0] : searchParams?.openSession
  const replaceExerciseId = Array.isArray(searchParams?.replaceExercise)
    ? searchParams?.replaceExercise[0]
    : searchParams?.replaceExercise

  const basePath = '/admin/templatemuscu'

  type ProgramRow = {
    id: string
    coach_id: string
    title: string | null
    description: string | null
    goal: string | null
    level: string | null
    duration: string | null
    is_template: boolean | null
    is_published: boolean | null
  }

  type MinimalProgramsQuery = {
    from: (table: 'programs') => {
      select: (columns: string) => {
        eq: (column: 'id', value: string) => {
          maybeSingle: () => Promise<{ data: ProgramRow | null }>
        }
      }
    }
  }

  type MinimalProgramsUpdate = {
    from: (table: 'programs') => {
      update: (values: Partial<ProgramRow>) => {
        eq: (column: 'id', value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  }

  const { data: program } = await (supabase as unknown as MinimalProgramsQuery)
    .from('programs')
    .select('id,coach_id,title,description,goal,level,duration,is_template,is_published')
    .eq('id', id)
    .maybeSingle()

  const typedProgram = program as ProgramRow | null

  if (!typedProgram || !typedProgram.is_template) {
    redirect(basePath)
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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const nextTitle = String(formData.get('title') ?? '').trim()
    const client = String(formData.get('client') ?? '')

    const { error } = await (supabase as unknown as MinimalProgramsUpdate)
      .from('programs')
      .update({ title: nextTitle || null })
      .eq('id', id)

    if (error) {
      revalidatePath(`${basePath}/${id}`)
      if (client === '1') return
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
  }

  async function noopAddExerciseToSession(_formData: FormData) {
    'use server'
  }

  async function noopReplaceProgramExercise(_formData: FormData) {
    'use server'
  }

  async function noopDeleteProgramExercise(_formData: FormData) {
    'use server'
  }

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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
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
      revalidatePath(`${basePath}/${id}`)
      if (client === '1') return
      redirect(`${basePath}/${id}`)
    }

    if (hasTitleField) {
      const { error: programError } = await (supabase as unknown as MinimalProgramsUpdate)
        .from('programs')
        .update({
          title: title || null,
          description: description || null,
          goal: goal || null,
          level: level || null,
          duration: duration || null,
        })
        .eq('id', id)

      if (programError) {
        redirect(`${basePath}/${id}?error=${encodeURIComponent(programError.message)}`)
      }
    }

    if (structureOrderRaw) {
      try {
        const parsed = JSON.parse(structureOrderRaw) as {
          orderedWeekIds?: string[]
          sessionsByWeekIds?: Record<string, string[]>
        }

        const orderedWeekIds = parsed.orderedWeekIds ?? []
        const sessionsByWeekIds = parsed.sessionsByWeekIds ?? {}

        for (let idx = 0; idx < orderedWeekIds.length; idx++) {
          const weekId = orderedWeekIds[idx]
          await supabase.from('program_weeks').update({ week_order: idx + 1 }).eq('id', weekId)

          const orderedSessionIds = sessionsByWeekIds[weekId] ?? []
          for (let sidx = 0; sidx < orderedSessionIds.length; sidx++) {
            const sessionId = orderedSessionIds[sidx]
            await supabase.from('sessions').update({ session_order: sidx + 1 }).eq('id', sessionId)
          }
        }
      } catch {
        // ignore
      }
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

  async function addWeek(formData: FormData) {
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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const title = String(formData.get('title') ?? '').trim() || 'Semaine'

    const { data: lastData } = await supabase
      .from('program_weeks')
      .select('week_order')
      .eq('program_id', id)
      .order('week_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const last = lastData as unknown as { week_order: number | null } | null

    const nextOrder = (last?.week_order ?? 0) + 1

    const { error } = await supabase.from('program_weeks').insert({ program_id: id, title, week_order: nextOrder })

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
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

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`${basePath}/${id}?error=missing_week_id`)
    }

    const { error } = await supabase.from('program_weeks').delete().eq('id', weekId)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
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

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`${basePath}/${id}?error=missing_week_id`)
    }

    const { data: sourceWeekData } = await supabase
      .from('program_weeks')
      .select('id,title')
      .eq('id', weekId)
      .maybeSingle()

    const sourceWeek = sourceWeekData as unknown as { id: string; title: string } | null

    if (!sourceWeek) {
      redirect(`${basePath}/${id}?error=week_not_found`)
    }

    const { data: lastData } = await supabase
      .from('program_weeks')
      .select('week_order')
      .eq('program_id', id)
      .order('week_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const last = lastData as unknown as { week_order: number | null } | null

    const nextOrder = (last?.week_order ?? 0) + 1

    const { data: insertedWeekData, error: weekInsertError } = await supabase
      .from('program_weeks')
      .insert({ program_id: id, title: `${sourceWeek.title} (copie)`, week_order: nextOrder })
      .select('id')
      .maybeSingle()

    const insertedWeek = insertedWeekData as unknown as { id: string } | null

    if (weekInsertError || !insertedWeek) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(weekInsertError?.message ?? 'duplicate_week_failed')}`)
    }

    const { data: sourceSessions } = await supabase
      .from('sessions')
      .select('title,description,session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: true })

    const typedSourceSessions = (sourceSessions ?? []) as unknown as {
      title: string
      description: string | null
      session_order: number
    }[]

    if (typedSourceSessions.length > 0) {
      await supabase.from('sessions').insert(
        typedSourceSessions.map((s) => ({
          week_id: insertedWeek.id,
          title: s.title,
          description: s.description,
          session_order: s.session_order,
        }))
      )
    }

    revalidatePath(`${basePath}/${id}`)
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

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    if (!weekId) {
      redirect(`${basePath}/${id}?error=missing_week_id`)
    }

    const title = String(formData.get('title') ?? '').trim() || 'Séance'

    const { data: lastData } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const last = lastData as unknown as { session_order: number | null } | null

    const nextOrder = (last?.session_order ?? 0) + 1

    const { error } = await supabase.from('sessions').insert({ week_id: weekId, title, session_order: nextOrder })

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
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

    const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = profileData as unknown as { role: string | null } | null
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    const sessionId = String(formData.get('session_id') ?? '')
    if (!weekId || !sessionId) {
      redirect(`${basePath}/${id}?error=missing_session_id`)
    }

    const { error } = await supabase.from('sessions').delete().eq('id', sessionId)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
  }

  async function duplicateSession(formData: FormData) {
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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    const sessionId = String(formData.get('session_id') ?? '')
    if (!weekId || !sessionId) {
      redirect(`${basePath}/${id}?error=missing_session_id`)
    }

    const { data: sourceSessionData } = await supabase
      .from('sessions')
      .select('id,week_id,title,description')
      .eq('id', sessionId)
      .eq('week_id', weekId)
      .maybeSingle()

    const sourceSession = sourceSessionData as unknown as { id: string; week_id: string; title: string; description: string | null } | null

    if (!sourceSession) {
      redirect(`${basePath}/${id}?error=session_not_found`)
    }

    const { data: lastData } = await supabase
      .from('sessions')
      .select('session_order')
      .eq('week_id', weekId)
      .order('session_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const last = lastData as unknown as { session_order: number | null } | null

    const nextOrder = (last?.session_order ?? 0) + 1

    const { data: insertedSessionData, error: insertSessionError } = await supabase
      .from('sessions')
      .insert({
        week_id: weekId,
        title: `${sourceSession.title} (copie)`,
        description: sourceSession.description,
        session_order: nextOrder,
      })
      .select('id')
      .maybeSingle()

    const insertedSession = insertedSessionData as unknown as { id: string } | null

    if (insertSessionError || !insertedSession) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(insertSessionError?.message ?? 'duplicate_session_failed')}`)
    }

    revalidatePath(`${basePath}/${id}`)

    return { newSessionId: insertedSession.id as unknown as string }
  }

  async function updateWeekTitle(formData: FormData) {
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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const weekId = String(formData.get('week_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()

    if (!weekId) {
      redirect(`${basePath}/${id}?error=missing_week_id`)
    }

    const { error } = await supabase.from('program_weeks').update({ title }).eq('id', weekId)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
  }

  async function updateSessionTitle(formData: FormData) {
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
    if (profile?.role !== 'admin') {
      redirect('/dashboard')
    }

    const sessionId = String(formData.get('session_id') ?? '')
    const title = String(formData.get('title') ?? '').trim()

    if (!sessionId) {
      redirect(`${basePath}/${id}?error=missing_session_id`)
    }

    const { error } = await supabase.from('sessions').update({ title }).eq('id', sessionId)

    if (error) {
      redirect(`${basePath}/${id}?error=${encodeURIComponent(error.message)}`)
    }

    revalidatePath(`${basePath}/${id}`)
  }

  const structureClient = supabase

  const { data: weeks } = await structureClient
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  const typedWeeks = (weeks ?? []) as unknown as WeekRow[]
  const weekIds = typedWeeks.map((w) => w.id)

  const sessions: SessionRow[] = weekIds.length
    ? ((await structureClient
        .from('sessions')
        .select('id,week_id,title,description,session_order')
        .in('week_id', weekIds)
        .order('session_order', { ascending: true })).data as SessionRow[]) ?? []
    : []

  const hydratedProgramExercises: ProgramExerciseRow[] = []

  const uniqueMuscles: string[] = []

  const initialTitle = String(typedProgram.title ?? '')

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          position: 'static',
          background: '#ffffff',
          paddingBottom: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <EditableProgramTitleClient initialTitle={initialTitle} readOnly={false} updateProgramTitleAction={updateProgramTitle} />
          </div>

          <Link
            href="/admin"
            style={{
              textDecoration: 'none',
              color: '#111827',
              padding: '6px 8px',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              flexShrink: 0,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
            title="Retour"
            aria-label="Retour"
          >
            ←
          </Link>
        </div>
      </div>

      <p style={{ color: '#6b7280', marginTop: 8 }}>Template muscu · Modifiable (sans exercices)</p>

      <section style={{ marginTop: 24, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Description</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={typedProgram.description ?? ''}
            form="save-all-exercises"
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Objectif</span>
          <input
            name="goal"
            defaultValue={typedProgram.goal ?? ''}
            form="save-all-exercises"
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Niveau</span>
            <select
              name="level"
              defaultValue={typedProgram.level ?? ''}
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
              defaultValue={typedProgram.duration ?? ''}
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

      {(() => {
        const addWeekLegacy = async (fd: FormData) => {
          await addWeek(fd)
        }
        const addSessionLegacy = async (fd: FormData) => {
          await addSession(fd)
        }

        return (
      <ProgramStructureClient
        programId={id}
        readOnly={false}
        hideExercises
        weeks={typedWeeks}
        sessions={sessions}
        programExercises={hydratedProgramExercises}
        openWeek={openWeek}
        openSession={openSession}
        replaceExerciseId={replaceExerciseId ?? undefined}
        uniqueMuscles={uniqueMuscles}
        addWeekAction={addWeekLegacy}
        deleteWeekAction={deleteWeek}
        duplicateWeekAction={duplicateWeek}
        addSessionAction={addSessionLegacy}
        deleteSessionAction={deleteSession}
        duplicateSessionAction={duplicateSession}
        updateWeekTitleAction={updateWeekTitle}
        updateSessionTitleAction={updateSessionTitle}
        addExerciseToSessionAction={noopAddExerciseToSession}
        replaceProgramExerciseAction={noopReplaceProgramExercise}
        deleteProgramExerciseAction={noopDeleteProgramExercise}
      />
        )
      })()}

      <div style={{ position: 'fixed', right: 16, bottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <SaveAllExercisesClient action={saveAllExercises} openWeek={openWeek ?? ''} openSession={openSession ?? ''} />
      </div>
    </main>
  )
}
