import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
import PublicProgramStructureReadOnlyClient from '../../../components/PublicProgramStructureReadOnlyClient'
import { IconBack } from '../../../components/ui/icons'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function PublicProgramDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('id,coach_id,title,description,goal,level,duration,image_url,is_published,created_at')
    .eq('id', id)
    .maybeSingle()

  if (!program || !program.is_published) {
    redirect('/programme')
  }

  const { data: weeks } = await supabase
    .from('program_weeks')
    .select('id,title,week_order')
    .eq('program_id', id)
    .order('week_order', { ascending: true })

  type WeekRow = { id: string; title: string; week_order: number }
  const typedWeeks = (weeks ?? []) as unknown as WeekRow[]

  const weekIds = typedWeeks.map((w) => w.id)

  const { data: sessions } = weekIds.length
    ? await supabase
        .from('sessions')
        .select('id,week_id,title,description,session_order')
        .in('week_id', weekIds)
        .order('session_order', { ascending: true })
    : { data: [] as unknown[] }

  type SessionRow = {
    id: string
    week_id: string
    title: string
    description: string | null
    session_order: number
  }
  const typedSessions = (sessions ?? []) as unknown as SessionRow[]

  const sessionIds = typedSessions.map((s) => s.id)

  const { data: programExercises } = sessionIds.length
    ? await supabase
        .from('program_exercises')
        .select(
          'id,session_id,exercise_id,name,exercise_order,sets,reps,rest_time,tempo,load,notes,exercise_library(name,demo_media_path)'
        )
        .in('session_id', sessionIds)
        .order('exercise_order', { ascending: true })
    : { data: [] as unknown[] }

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
    exercise_library: { name: string; demo_media_path?: string | null } | null
    demo_media_url?: string | null
  }
  const typedExercises = (programExercises ?? []) as unknown as ProgramExerciseRow[]

  const storageBucket = 'exercise-media'
  const uniquePaths = Array.from(
    new Set(
      typedExercises
        .map((e) => e.exercise_library?.demo_media_path ?? null)
        .filter((p): p is string => Boolean(p))
    )
  )

  const signedUrlByPath = new Map<string, string>()
  await Promise.all(
    uniquePaths.map(async (path) => {
      if (/^https?:\/\//i.test(path)) {
        signedUrlByPath.set(path, path)
        return
      }
      const { data } = await supabase.storage.from(storageBucket).createSignedUrl(path, 60 * 60)
      if (data?.signedUrl) {
        signedUrlByPath.set(path, data.signedUrl)
      }
    })
  )

  const exercisesWithMedia = typedExercises.map((e) => {
    const path = e.exercise_library?.demo_media_path ?? null
    const url = path ? signedUrlByPath.get(path) ?? null : null
    return { ...e, demo_media_url: url }
  })

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 24, paddingBottom: 96 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 900,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={program.title}
          >
            {program.title}
          </h1>
          <div style={{ color: '#6b7280', marginTop: 6 }}>
            Niveau : {program.level ?? '—'} · Durée : {program.duration ?? '—'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href="/programme"
            style={{ textDecoration: 'none', color: 'var(--brand)', fontWeight: 700 }}
            aria-label="Retour"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand)] text-white">
              <IconBack className="text-white" />
            </span>
          </Link>
        </div>
      </div>

      <section style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        {program.description ? (
          <div>
            <strong>Description</strong>
            <div>{program.description}</div>
          </div>
        ) : null}

        {program.goal ? (
          <div>
            <strong>Objectif</strong>
            <div>{program.goal}</div>
          </div>
        ) : null}
      </section>

      <section style={{ marginTop: 18 }}>
        <PublicProgramStructureReadOnlyClient
          programId={program.id}
          weeks={typedWeeks}
          sessions={typedSessions}
          programExercises={exercisesWithMedia}
        />
      </section>

      <Link
        href="/login"
        style={{
          position: 'fixed',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 50,
          display: 'block',
          textAlign: 'center',
          padding: '14px 16px',
          borderRadius: 14,
          border: '1px solid #111827',
          background: '#111827',
          color: '#ffffff',
          fontWeight: 900,
          textDecoration: 'none',
          maxWidth: 520,
          margin: '0 auto',
          boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
        }}
      >
        Accéder à l’app
      </Link>
    </main>
  )
}
