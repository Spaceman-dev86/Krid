import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { CoachExerciseFicheForm } from '../../../../components/exercises/CoachExerciseFicheForm'
import { CoachQueryFlash } from '../../../../components/coach/CoachQueryFlash'
import { Muted, PageTitle } from '@/src/components/ui'
import { signExerciseMediaUrl } from '@/src/lib/exerciseMedia'
import { canAccessCoachApp } from '../../../../lib/auth/roles'
import { loadCoachFicheOptions } from '../../../../lib/exercises/loadCoachFicheOptions'
import { createClient } from '../../../../lib/supabase/server'
import type { ExerciseSourceKind } from '../../../../lib/exercises/library'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ error?: string; saved?: string; forked?: string }>
    | { error?: string; saved?: string; forked?: string }
}

type ExerciseRow = {
  id: string
  name: string
  description: string | null
  muscle_group: string | null
  difficulty: string | null
  video_url: string | null
  demo_media_path: string | null
  exercise_type_id: string | null
  sport_id: string | null
  coach_id: string | null
  status: string | null
  source_kind: string | null
  named_notes?: { title: string; body: string }[] | null
}

export default async function EditBrouillonExercisePage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,demo_media_path,exercise_type_id,sport_id,coach_id,named_notes,status,source_kind',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const row = exercise as unknown as ExerciseRow | null
  if (!row || row.coach_id !== user.id) {
    redirect('/exercises/brouillon?error=' + encodeURIComponent('Exercice introuvable'))
  }
  if (row.status === 'published') redirect(`/exercises/mine/${id}`)

  const { data: bridgesRaw } = await supabase
    .from('exercise_replacements' as never)
    .select('title, note, replacement_id, position')
    .eq('exercise_id' as never, id as never)
    .order('position' as never, { ascending: true })

  const bridges = ((bridgesRaw ?? []) as {
    title?: string | null
    note?: string | null
    replacement_id: string
  }[]).map((b) => ({
    title: b.title ?? 'Remplacement',
    note: b.note ?? '',
    exerciseId: b.replacement_id,
  }))

  const { types, sports, candidates } = await loadCoachFicheOptions(supabase, user.id)

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            forked: { tone: 'success', message: 'Copié depuis Krid — tu peux éditer' },
          }}
        />
      </Suspense>
      <div>
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/exercises/brouillon"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Brouillons
          </Link>
        </p>
        <PageTitle className="mt-2">{row.name}</PageTitle>
        <Muted className="mt-1">Brouillon · hors builder tant que tu ne publies pas</Muted>
      </div>
      <CoachExerciseFicheForm
        mode="brouillon"
        coachId={user.id}
        types={types}
        sports={sports}
        candidates={candidates}
        initial={{
          id: row.id,
          name: row.name,
          description: row.description,
          muscle_group: row.muscle_group,
          difficulty: row.difficulty,
          video_url: row.video_url,
          demo_media_path: row.demo_media_path,
          demo_media_url: await signExerciseMediaUrl(supabase, row.demo_media_path),
          exercise_type_id: row.exercise_type_id,
          sport_id: row.sport_id,
          source_kind: (row.source_kind as ExerciseSourceKind) || 'own',
          named_notes: row.named_notes,
          bridges,
        }}
      />
    </div>
  )
}
