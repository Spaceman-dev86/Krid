import Link from 'next/link'

import { ExerciseNotesAndBridgesEditor } from '@/src/components/admin/ExerciseNotesAndBridgesEditor'
import { Button, DaBanner, PageTitle, Muted, daFieldClass, daSelectClass } from '@/src/components/ui'
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_MUSCLE_GROUPS,
} from '@/src/lib/exercises/ficheConstants'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import {
  createTrainlyExerciseDraftAction,
  createTrainlyExercisePublishedAction,
} from '../exerciseFicheActions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ error?: string; ok?: string }> | { error?: string; ok?: string }
}

type TypeRow = { id: string; label: string }
type Candidate = {
  id: string
  name: string
  exercise_type_id: string | null
  sport_id: string | null
}

export default async function NewAdminExercisePage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const { data: typesRaw } = await supabase
    .from('exercise_types' as never)
    .select('id, label')
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
    .order('label' as never, { ascending: true })

  const types = (typesRaw ?? []) as TypeRow[]

  const { data: sportsRaw } = await supabase
    .from('sports' as never)
    .select('id, label')
    .is('coach_id' as never, null)
    .is('deleted_at' as never, null)
    .order('label' as never, { ascending: true })

  const sports = (sportsRaw ?? []) as { id: string; label: string }[]

  const { data: candidatesRaw } = await supabase
    .from('exercise_library')
    .select('id, name, exercise_type_id, sport_id')
    .is('coach_id', null)
    .is('deleted_at', null)
    .eq('status', 'published')
    .order('name', { ascending: true })
    .limit(500)

  const candidates = (candidatesRaw ?? []) as Candidate[]

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-sm text-[color:var(--muted)]">
          <Link href="/admin/exercises" className="font-semibold text-[var(--brand)] hover:underline">
            ← Exercices
          </Link>
        </p>
        <PageTitle className="mt-2">Nouvel exercice Trainly</PageTitle>
        <Muted className="mt-1">
          Types · sports catalogue. Gérer → onglets Types / Sport.
        </Muted>
      </div>

      {params.error ? <DaBanner tone="danger" className="mb-4">{params.error}</DaBanner> : null}

      {!types.length ? (
        <DaBanner tone="warning" className="mb-4">
          Aucun type. Crée-en un dans{' '}
          <Link href="/admin/exercises?view=types" className="underline">
            Types
          </Link>{' '}
          d’abord.
        </DaBanner>
      ) : null}

      {!sports.length ? (
        <DaBanner tone="warning" className="mb-4">
          Aucun sport — applique la migration 42 ou crée-en un dans{' '}
          <Link href="/admin/exercises?view=sports" className="underline">
            Sport
          </Link>
          .
        </DaBanner>
      ) : null}

      <form className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
          <input name="name" required className={daFieldClass} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Type *</span>
            <select name="exercise_type_id" required defaultValue="" className={daSelectClass}>
              <option value="" disabled>
                Sélectionner…
              </option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Sport *</span>
            <select name="sport_id" required defaultValue="" className={daSelectClass}>
              <option value="" disabled>
                Sélectionner…
              </option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Consignes</span>
          <textarea name="description" rows={3} className={daFieldClass} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Groupe musculaire</span>
            <select name="muscle_group" defaultValue="" className={daSelectClass}>
              <option value="">—</option>
              {EXERCISE_MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Difficulté</span>
            <select name="difficulty" defaultValue="" className={daSelectClass}>
              <option value="">—</option>
              {EXERCISE_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">YouTube / URL vidéo</span>
            <input name="video_url" className={daFieldClass} placeholder="https://…" />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Média démo (Storage)</span>
            <input name="demo_media_path" className={daFieldClass} placeholder="mon-exo.gif" />
          </label>
        </div>

        <ExerciseNotesAndBridgesEditor candidates={candidates} types={types} sports={sports} />

        <label className="inline-flex items-center gap-2 text-sm text-[color:var(--fg)]">
          <input type="checkbox" name="allow_duplicate" defaultChecked className="accent-[var(--brand)]" />
          Duplicable (coach peut récupérer une copie)
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" formAction={createTrainlyExercisePublishedAction}>
            Créer
          </Button>
          <Button type="submit" formAction={createTrainlyExerciseDraftAction} variant="secondary">
            Brouillon
          </Button>
        </div>
      </form>
    </main>
  )
}
