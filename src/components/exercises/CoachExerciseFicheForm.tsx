import { ExerciseNotesAndBridgesEditor } from '@/src/components/admin/ExerciseNotesAndBridgesEditor'
import { CoachExerciseDemoMediaField } from '@/src/components/exercises/CoachExerciseDemoMediaField'
import {
  ConfirmSubmitButton,
  PendingFormButton,
  daFieldClass,
  daSelectClass,
} from '@/src/components/ui'
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_MUSCLE_GROUPS,
} from '@/src/lib/exercises/ficheConstants'
import type {
  FicheCandidate,
  FicheSportOption,
  FicheTypeOption,
} from '@/src/lib/exercises/loadCoachFicheOptions'
import { originLabel, type ExerciseSourceKind } from '@/src/lib/exercises/library'
import {
  createCoachExerciseDraftAction,
  createCoachExercisePublishedAction,
  moveCoachExerciseToDraftAction,
  saveAndPublishCoachExerciseAction,
  saveCoachExerciseAction,
  saveKeepDraftCoachExerciseAction,
  softDeleteCoachExerciseAction,
} from '@/src/app/exercises/actions'

export type CoachExerciseFicheInitial = {
  id?: string
  name?: string
  description?: string | null
  muscle_group?: string | null
  difficulty?: string | null
  video_url?: string | null
  demo_media_path?: string | null
  demo_media_url?: string | null
  exercise_type_id?: string | null
  sport_id?: string | null
  source_kind?: ExerciseSourceKind
  named_notes?: { title: string; body: string }[] | null
  bridges?: { title: string; note: string; exerciseId: string }[]
}

type Props = {
  mode: 'new' | 'mine' | 'brouillon'
  coachId: string
  types: FicheTypeOption[]
  sports: FicheSportOption[]
  candidates: FicheCandidate[]
  initial?: CoachExerciseFicheInitial
}

export function CoachExerciseFicheForm({
  mode,
  coachId,
  types,
  sports,
  candidates,
  initial,
}: Props) {
  const isNew = mode === 'new'
  const muscleDefault = initial?.muscle_group ?? ''
  const difficultyDefault = initial?.difficulty ?? ''

  const name = initial?.name?.trim() || 'cet exercice'

  return (
    <form className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
      {!isNew && initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {!isNew ? (
        <input type="hidden" name="from" value={mode === 'mine' ? 'mine' : 'brouillon'} />
      ) : null}

      {!isNew && initial?.source_kind ? (
        <p className="text-xs text-[color:var(--muted)]">
          Origine{' '}
          <span className="font-bold text-[color:var(--fg)]">
            {originLabel(initial.source_kind)}
          </span>
          <span className="ml-1">· visible seulement pour toi</span>
        </p>
      ) : null}

      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          className={daFieldClass}
          placeholder="Ex. Squat goblet"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Type *</span>
          <select
            name="exercise_type_id"
            required
            defaultValue={initial?.exercise_type_id ?? ''}
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
            defaultValue={initial?.sport_id ?? ''}
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
          defaultValue={initial?.description ?? ''}
          className={daFieldClass}
          placeholder="Ce que ton client doit retenir pour bien exécuter le mouvement."
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
        <span className="text-xs font-semibold text-[color:var(--muted)]">Vidéo (lien optionnel)</span>
        <input
          name="video_url"
          defaultValue={initial?.video_url ?? ''}
          className={daFieldClass}
          placeholder="https://…"
        />
      </label>

      <CoachExerciseDemoMediaField
        coachId={coachId}
        exerciseId={initial?.id}
        initialPath={initial?.demo_media_path}
        initialSignedUrl={initial?.demo_media_url}
      />

      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2">
        <p className="text-[11px] font-semibold text-[color:var(--muted)]">
          Remplacements · notes
        </p>
        <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
          Propose des variantes à ton client si besoin. Les séries / charges se règlent dans le
          builder programme.
        </p>
      </div>

      <ExerciseNotesAndBridgesEditor
        candidates={candidates}
        types={types}
        sports={sports}
        initialNotes={initial?.named_notes ?? undefined}
        initialBridges={initial?.bridges}
        excludeId={initial?.id ?? null}
      />

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        {isNew ? (
          <>
            <PendingFormButton
              type="submit"
              formAction={createCoachExerciseDraftAction}
              variant="secondary"
            >
              Garder en brouillon
            </PendingFormButton>
            <PendingFormButton type="submit" formAction={createCoachExercisePublishedAction}>
              Publier → Ma biblio
            </PendingFormButton>
          </>
        ) : mode === 'brouillon' ? (
          <>
            <ConfirmSubmitButton
              formAction={softDeleteCoachExerciseAction}
              confirmMessage={`Supprimer « ${name} » ?`}
              variant="secondary"
              size="md"
              pendingLabel="Suppression…"
            >
              Supprimer
            </ConfirmSubmitButton>
            <PendingFormButton
              type="submit"
              formAction={saveKeepDraftCoachExerciseAction}
              variant="secondary"
            >
              Garder en brouillon
            </PendingFormButton>
            <PendingFormButton type="submit" formAction={saveAndPublishCoachExerciseAction}>
              Publier → Ma biblio
            </PendingFormButton>
          </>
        ) : (
          <>
            <ConfirmSubmitButton
              formAction={softDeleteCoachExerciseAction}
              confirmMessage={`Supprimer « ${name} » ? Cette action archive l’exercice.`}
              variant="secondary"
              size="md"
              pendingLabel="Suppression…"
            >
              Supprimer
            </ConfirmSubmitButton>
            <PendingFormButton
              type="submit"
              formAction={moveCoachExerciseToDraftAction}
              variant="secondary"
            >
              → Brouillon
            </PendingFormButton>
            <PendingFormButton type="submit" formAction={saveCoachExerciseAction}>
              Enregistrer
            </PendingFormButton>
          </>
        )}
      </div>
      {mode === 'brouillon' || isNew ? (
        <p className="text-[11px] text-[color:var(--muted)]">
          Un brouillon n’apparaît pas dans le builder tant que tu ne le publies pas.
        </p>
      ) : (
        <p className="text-[11px] text-[color:var(--muted)]">
          Publié = utilisable dans tes programmes.
        </p>
      )}
    </form>
  )
}
