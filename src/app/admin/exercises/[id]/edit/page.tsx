import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ExerciseNotesAndBridgesEditor } from '@/src/components/admin/ExerciseNotesAndBridgesEditor'
import { Button, ConfirmSubmitButton, DaBanner, PageTitle, Muted, daFieldClass, daSelectClass } from '@/src/components/ui'
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_MUSCLE_GROUPS,
} from '@/src/lib/exercises/ficheConstants'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import { signExerciseMediaUrl } from '@/src/lib/exerciseMedia'
import {
  deleteTrainlyExerciseAction,
  publishTrainlyExerciseAction,
  saveDraftTrainlyExerciseAction,
  updateTrainlyExerciseAction,
} from '../../exerciseFicheActions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ error?: string; returnTo?: string }> | { error?: string; returnTo?: string }
}

type TypeRow = { id: string; label: string }
type Candidate = {
  id: string
  name: string
  exercise_type_id: string | null
  sport_id: string | null
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
  allow_duplicate: boolean | null
  coach_id: string | null
  status: string | null
  named_notes?: { title: string; body: string }[] | null
}

export default async function AdminExerciseEditPage({ params, searchParams }: Props) {
  const { id } = await params
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const { data: exercise, error } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,demo_media_path,exercise_type_id,sport_id,allow_duplicate,coach_id,named_notes,status',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !exercise) redirect('/admin/exercises')

  const row = exercise as unknown as ExerciseRow
  if (row.coach_id != null) {
    redirect(`/admin/exercises/${id}`)
  }

  const demoMediaUrl = await signExerciseMediaUrl(supabase, row.demo_media_path)

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

  const { data: linksRaw } = await supabase
    .from('exercise_replacements' as never)
    .select('replacement_id, title, note, position')
    .eq('exercise_id' as never, id as never)
    .order('position' as never, { ascending: true })

  const initialBridges = (
    (linksRaw ?? []) as { replacement_id: string; title: string | null; note: string | null }[]
  ).map((l) => ({
    title: l.title ?? '',
    note: l.note ?? '',
    exerciseId: l.replacement_id,
  }))

  const missingBridgeIds = initialBridges
    .map((b) => b.exerciseId)
    .filter((eid) => eid && !candidates.some((c) => c.id === eid))
  if (missingBridgeIds.length) {
    const { data: orphanRaw } = await supabase
      .from('exercise_library')
      .select('id, name, exercise_type_id, sport_id')
      .in('id', missingBridgeIds)
    for (const e of (orphanRaw ?? []) as Candidate[]) {
      candidates.push({
        id: e.id,
        name: `${e.name} (non publié)`,
        exercise_type_id: e.exercise_type_id,
        sport_id: e.sport_id,
      })
    }
  }

  const backHref = '/admin/exercises'

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-sm text-[color:var(--muted)]">
          <Link href={backHref} className="font-semibold text-[var(--brand)] hover:underline">
            ← Exercices
          </Link>
        </p>
        <PageTitle className="mt-2">Modifier l’exercice</PageTitle>
        <Muted className="mt-1 truncate">{row.name}</Muted>
      </div>

      {q.error ? <DaBanner tone="danger" className="mb-4">{q.error}</DaBanner> : null}

      {demoMediaUrl ? (
        <div className="mb-4 overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface)] ring-1 ring-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={demoMediaUrl} alt={row.name} className="mx-auto max-h-56 w-full object-contain p-4" />
        </div>
      ) : null}

      <form className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <input type="hidden" name="id" value={id} />

        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
          <input name="name" required defaultValue={row.name} className={daFieldClass} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Type *</span>
            <select
              name="exercise_type_id"
              required
              defaultValue={row.exercise_type_id ?? ''}
              className={daSelectClass}
            >
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
            <select
              name="sport_id"
              required
              defaultValue={row.sport_id ?? ''}
              className={daSelectClass}
            >
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
          <textarea
            name="description"
            rows={3}
            defaultValue={row.description ?? ''}
            className={daFieldClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Groupe musculaire</span>
            <select name="muscle_group" defaultValue={row.muscle_group ?? ''} className={daSelectClass}>
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
            <select name="difficulty" defaultValue={row.difficulty ?? ''} className={daSelectClass}>
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
            <input name="video_url" defaultValue={row.video_url ?? ''} className={daFieldClass} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted)]">Média démo (Storage)</span>
            <input name="demo_media_path" defaultValue={row.demo_media_path ?? ''} className={daFieldClass} />
          </label>
        </div>

        <ExerciseNotesAndBridgesEditor
          candidates={candidates}
          types={types}
          sports={sports}
          initialNotes={Array.isArray(row.named_notes) ? row.named_notes : []}
          initialBridges={initialBridges}
          excludeId={id}
        />

        <label className="inline-flex items-center gap-2 text-sm text-[color:var(--fg)]">
          <input
            type="checkbox"
            name="allow_duplicate"
            defaultChecked={row.allow_duplicate !== false}
            className="accent-[var(--brand)]"
          />
          Duplicable (coach peut récupérer une copie)
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          {row.status === 'published' ? (
            <>
              <Button type="submit" formAction={updateTrainlyExerciseAction}>
                Enregistrer
              </Button>
              <Button type="submit" formAction={saveDraftTrainlyExerciseAction} variant="secondary">
                Repasser en brouillon
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" formAction={publishTrainlyExerciseAction}>
                Publier
              </Button>
              <Button type="submit" formAction={saveDraftTrainlyExerciseAction} variant="secondary">
                Sauvegarder brouillon
              </Button>
            </>
          )}
        </div>
      </form>

      <form action={deleteTrainlyExerciseAction} className="mt-6">
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton
          confirmMessage="Mettre cet exercice Trainly à la corbeille ?"
          variant="secondary"
          size="sm"
        >
          Supprimer
        </ConfirmSubmitButton>
      </form>
    </main>
  )
}
