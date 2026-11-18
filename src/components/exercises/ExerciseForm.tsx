import { Button, daFieldClass, daSelectClass } from '@/src/components/ui'
import {
  createCoachExerciseAction,
  saveCoachExerciseAction,
} from '../../app/exercises/actions'
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_MUSCLE_GROUPS,
} from '../../lib/exercises/ficheConstants'
import type { CoachExerciseRow } from '../../lib/exercises/library'
import { originLabel } from '../../lib/exercises/library'

type Props = {
  mode: 'new' | 'mine' | 'brouillon'
  exercise?: CoachExerciseRow | null
}

export function ExerciseForm({ mode, exercise }: Props) {
  const isNew = mode === 'new'
  const action = isNew ? createCoachExerciseAction : saveCoachExerciseAction

  const difficultyDefault = exercise?.difficulty ?? ''
  const muscleDefault = exercise?.muscle_group ?? ''

  return (
    <form
      action={action}
      className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
    >
      {!isNew && exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}

      {!isNew && exercise ? (
        <p className="text-xs font-semibold text-[color:var(--muted)]">
          Origine :{' '}
          <span className="font-bold text-[color:var(--fg)]">{originLabel(exercise.source_kind)}</span>
          <span className="ml-1 font-normal">(visible coach uniquement)</span>
        </p>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
        <input name="name" required defaultValue={exercise?.name ?? ''} className={daFieldClass} />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Type</span>
        <input
          name="exercise_type"
          defaultValue={exercise?.exercise_type ?? ''}
          placeholder="ex. Force, Cardio…"
          className={daFieldClass}
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Consignes</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={exercise?.description ?? ''}
          className={daFieldClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Groupe musculaire</span>
          <select name="muscle_group" defaultValue={muscleDefault} className={daSelectClass}>
            <option value="">—</option>
            {EXERCISE_MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            {muscleDefault &&
            !(EXERCISE_MUSCLE_GROUPS as readonly string[]).includes(muscleDefault) ? (
              <option value={muscleDefault}>{muscleDefault}</option>
            ) : null}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Difficulté</span>
          <select name="difficulty" defaultValue={difficultyDefault} className={daSelectClass}>
            <option value="">—</option>
            {EXERCISE_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {difficultyDefault &&
            !(EXERCISE_DIFFICULTIES as readonly string[]).includes(difficultyDefault) ? (
              <option value={difficultyDefault}>{difficultyDefault}</option>
            ) : null}
          </select>
        </label>
      </div>

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Vidéo (URL)</span>
        <input
          name="video_url"
          type="url"
          defaultValue={exercise?.video_url ?? ''}
          placeholder="https://…"
          className={daFieldClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {isNew ? (
          <>
            <Button type="submit" className="!rounded-xl !px-4 !py-2.5 text-sm">
              Publier → Ma biblio
            </Button>
            <Button
              type="submit"
              name="as_draft"
              value="1"
              variant="secondary"
              className="!rounded-xl !px-4 !py-2.5 text-sm"
            >
              Enregistrer en brouillon
            </Button>
          </>
        ) : mode === 'brouillon' ? (
          <>
            <Button
              type="submit"
              name="publish"
              value="1"
              className="!rounded-xl !px-4 !py-2.5 text-sm"
            >
              Publier → Ma biblio
            </Button>
            <Button
              type="submit"
              name="keep_draft"
              value="1"
              variant="secondary"
              className="!rounded-xl !px-4 !py-2.5 text-sm"
            >
              Garder en brouillon
            </Button>
          </>
        ) : (
          <Button type="submit" className="!rounded-xl !px-4 !py-2.5 text-sm">
            Enregistrer
          </Button>
        )}
      </div>
    </form>
  )
}
