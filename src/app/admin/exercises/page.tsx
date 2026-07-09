import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'
import { Container } from '../../../components/marketing'
import DashboardExerciseLibraryClient from '../../../components/DashboardExerciseLibraryClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ExerciseListRow = {
  id: string
  name: string
  muscle_group: string | null
  difficulty: string | null
  demo_media_path?: string | null
}

type ExerciseListItem = ExerciseListRow & {
  thumb_url?: string | null
}

function normalizeDemoMediaPath(input: string) {
  const cleaned = input.replace(/^\/+/, '').trim()
  if (cleaned.toLowerCase().startsWith('exercise-media/')) {
    return cleaned.slice('exercise-media/'.length)
  }
  return cleaned
}

export default async function AdminExercisesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/loginadmin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const typedProfile = profile as unknown as { role: string | null } | null
  if (typedProfile?.role !== 'admin') {
    redirect('/dashboard/exercises')
  }

  let exercises: ExerciseListRow[] | null = null
  let errorMessage: string | null = null

  const storageBucket = 'exercise-media'

  const withMedia = await supabase
    .from('exercise_library')
    .select('id,name,muscle_group,difficulty,demo_media_path')
    .order('created_at', { ascending: false })

  if (withMedia.error) {
    const fallback = await supabase
      .from('exercise_library')
      .select('id,name,muscle_group,difficulty')
      .order('created_at', { ascending: false })
    exercises = fallback.data as unknown as ExerciseListRow[] | null
    errorMessage = fallback.error ? fallback.error.message : null
  } else {
    exercises = withMedia.data as unknown as ExerciseListRow[] | null
    errorMessage = null
  }

  const items: ExerciseListItem[] | null = exercises
    ? await Promise.all(
        exercises.map(async (e) => {
          const raw = e.demo_media_path ?? null
          if (!raw) return e

          const isUrl = /^https?:\/\//i.test(raw)
          if (isUrl) {
            return { ...e, thumb_url: raw }
          }

          const path = normalizeDemoMediaPath(raw)
          const signed = await supabase.storage.from(storageBucket).createSignedUrl(path, 60 * 60)
          if (!signed.error && signed.data?.signedUrl) {
            return { ...e, thumb_url: signed.data.signedUrl }
          }

          return e
        }),
      )
    : null

  return (
    <main className="min-h-screen bg-transparent">
      <Container className="py-6 sm:py-10 px-2 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Bibliothèque d’exercices</h1>
            <p className="mt-1 text-sm text-black/60">{items ? `${items.length} exercice(s)` : '0 exercice'}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/admin/exercises/new"
              aria-label="Créer un exercice"
              title="Créer un exercice"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand)] text-white ring-1 ring-black/10 hover:opacity-90"
            >
              <span className="text-lg font-black leading-none">+</span>
            </Link>
            <Link
              href="/admin"
              aria-label="Retour admin"
              title="Retour admin"
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
            >
              ←
            </Link>
          </div>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-red-700">{errorMessage}</p> : null}

        {items ? (
          <div className="mt-5">
            <DashboardExerciseLibraryClient
              items={items}
              returnTo="/admin/exercises"
              exerciseBasePath="/admin/exercises"
            />
          </div>
        ) : null}
      </Container>
    </main>
  )
}
