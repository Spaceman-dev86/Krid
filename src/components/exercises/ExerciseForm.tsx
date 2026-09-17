import { Button } from '@/src/components/ui'
import {
  createCoachExerciseAction,
  saveCoachExerciseAction,
} from '../../app/exercises/actions'
import type { CoachExerciseRow } from '../../lib/exercises/library'

type Props = {
  mode: 'new' | 'mine' | 'brouillon'
  exercise?: CoachExerciseRow | null
}

export function ExerciseForm({ mode, exercise }: Props) {
  const isNew = mode === 'new'
  const action = isNew ? createCoachExerciseAction : saveCoachExerciseAction

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      {!isNew && exercise ? <input type="hidden" name="id" value={exercise.id} /> : null}

      <label className="grid gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">Nom *</span>
        <input
          name="name"
          required
          defaultValue={exercise?.name ?? ''}
          className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">Type</span>
        <input
          name="exercise_type"
          defaultValue={exercise?.exercise_type ?? ''}
          placeholder="ex. musculation, cardio…"
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">
          Description
        </span>
        <textarea
          name="description"
          rows={3}
          defaultValue={exercise?.description ?? ''}
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">
            Groupe musculaire
          </span>
          <input
            name="muscle_group"
            defaultValue={exercise?.muscle_group ?? ''}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">
            Difficulté
          </span>
          <select
            name="difficulty"
            defaultValue={exercise?.difficulty ?? ''}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            <option value="débutant">Débutant</option>
            <option value="intermédiaire">Intermédiaire</option>
            <option value="avancé">Avancé</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-black/40">
          Vidéo (URL)
        </span>
        <input
          name="video_url"
          type="url"
          defaultValue={exercise?.video_url ?? ''}
          placeholder="https://…"
          className="rounded-xl border border-black/10 px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {isNew ? (
          <>
            <Button type="submit" className="!rounded-xl !px-4 !py-2.5 text-sm">
              Sauvegarder → Ma biblio
            </Button>
            <Button type="submit" name="as_draft" value="1" variant="secondary" className="!rounded-xl !px-4 !py-2.5 text-sm">
              Enregistrer en brouillon
            </Button>
          </>
        ) : mode === 'brouillon' ? (
          <>
            <Button type="submit" name="publish" value="1" className="!rounded-xl !px-4 !py-2.5 text-sm">
              Sauvegarder → Ma biblio
            </Button>
            <Button type="submit" name="keep_draft" value="1" variant="secondary" className="!rounded-xl !px-4 !py-2.5 text-sm">
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
