'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'

import type { ProgramExerciseUpdatePatch } from '../../domain/program-editor'
import { useProgramExercise } from '../../store/program-editor'
import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import { EDITOR_TEXT_INPUT_X_DENSE } from './ui/editorInputStyles'
import {
  draftToProgramExercisePatch,
  programExerciseToDraft,
  type PrescriptionDraft,
} from './utils/prescriptionDraft'
import {
  formatSecondsToMmSs,
  parseMmSsToSeconds,
  parseOptionalInt,
  stepNumberString,
} from './utils/prescriptionHelpers'
import { EDITOR_CLS } from './editorLayoutConstants'
import StepperInput from './ui/StepperInput'
import { handleMultilineTextKeyDown, handleSingleLineTextKeyDown } from './ui/textFieldKeyboard'

type Props = {
  programExerciseId: string
}

function ExerciseEditFieldsInner({ programExerciseId }: Props) {
  const pe = useProgramExercise(programExerciseId)
  const tryApplyCommand = useProgramDocumentStore((s) => s.tryApplyCommand)
  const [draft, setDraft] = useState<PrescriptionDraft>(() =>
    pe ? programExerciseToDraft(pe) : emptyDraft()
  )
  const draftRef = useRef(draft)
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (pe) {
      const next = programExerciseToDraft(pe)
      draftRef.current = next
      setDraft(next)
    }
  }, [pe])

  useEffect(() => {
    return () => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
    }
  }, [])

  const commitPatch = useCallback(
    (patch: ProgramExerciseUpdatePatch | null) => {
      if (!patch || Object.keys(patch).length === 0) return
      tryApplyCommand({ type: 'programExercise.update', programExerciseId, patch })
    },
    [programExerciseId, tryApplyCommand]
  )

  const commitDraft = useCallback(() => {
    if (!pe) return
    commitPatch(draftToProgramExercisePatch(draft, pe))
  }, [commitPatch, draft, pe])

  const updateDraft = useCallback((partial: Partial<PrescriptionDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial }
      draftRef.current = next
      return next
    })
  }, [])

  const scheduleNotesCommit = useCallback(
    (nextNotes: string) => {
      if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current)
      notesDebounceRef.current = setTimeout(() => {
        notesDebounceRef.current = null
        if (!pe) return
        const patch = draftToProgramExercisePatch({ ...draftRef.current, notes: nextNotes }, pe)
        commitPatch(patch)
      }, 450)
    },
    [commitPatch, pe]
  )

  if (!pe) return null

  return (
    <div className="mt-2 grid gap-2" onClick={(e) => e.stopPropagation()}>
      <div className={`grid gap-2 ${EDITOR_CLS.gridStackUntil868}`}>
        <StepperInput
          label="Séries"
          value={draft.sets}
          onChange={(sets) => updateDraft({ sets })}
          onBlur={commitDraft}
          onStep={(delta) => {
            const next = stepNumberString(draft.sets, delta, { min: 0 })
            updateDraft({ sets: next })
            commitPatch({ sets: parseOptionalInt(next) })
          }}
        />
        <StepperInput
          label="Rép."
          value={draft.reps}
          onChange={(reps) => updateDraft({ reps })}
          onBlur={commitDraft}
          onStep={(delta) => {
            const next = stepNumberString(draft.reps, delta, { min: 0 })
            updateDraft({ reps: next })
            commitPatch({ reps: parseOptionalInt(next) })
          }}
        />
        <StepperInput
          label="Repos (min)"
          value={draft.restTime}
          placeholder="mm:ss"
          inputMode="text"
          onChange={(restTime) => updateDraft({ restTime })}
          onBlur={commitDraft}
          onStep={(delta) => {
            const cur = parseMmSsToSeconds(draft.restTime) ?? 0
            const next = formatSecondsToMmSs(Math.max(0, cur + delta * 15))
            updateDraft({ restTime: next })
            commitPatch({ restTime: next.trim() || null })
          }}
        />
      </div>

      <div className={`grid gap-2 ${EDITOR_CLS.gridStackUntil868}`}>
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold text-gray-600">RPE</span>
          <select
            value={draft.rpe}
            onChange={(e) => {
              const next = e.target.value
              updateDraft({ rpe: next })
              commitPatch({ rpe: parseOptionalInt(next) })
            }}
            className={`h-8 w-full rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} text-sm`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <option value="">—</option>
            {Array.from({ length: 10 }).map((_, idx) => {
              const v = String(idx + 1)
              return (
                <option key={v} value={v}>
                  {v}
                </option>
              )
            })}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold text-gray-600">Tempo</span>
          <input
            value={draft.tempo}
            onChange={(e) => updateDraft({ tempo: e.target.value })}
            onBlur={commitDraft}
            className={`h-8 w-full rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} text-sm`}
            placeholder="ex: 3010"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={handleSingleLineTextKeyDown}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold text-gray-600">Charge (Kg)</span>
          <input
            value={draft.load}
            onChange={(e) => updateDraft({ load: e.target.value })}
            onBlur={commitDraft}
            className={`h-8 w-full rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} text-sm`}
            placeholder="ex: 40kg"
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={handleSingleLineTextKeyDown}
          />
        </label>
      </div>

      <label className="grid gap-1">
        <span className="text-[11px] font-semibold text-gray-600">Note</span>
        <textarea
          value={draft.notes}
          onChange={(e) => {
            const next = e.target.value
            updateDraft({ notes: next })
            scheduleNotesCommit(next)
          }}
          onBlur={() => {
            if (notesDebounceRef.current) {
              clearTimeout(notesDebounceRef.current)
              notesDebounceRef.current = null
            }
            commitDraft()
          }}
          className={`min-h-[72px] w-full resize-y rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} py-2 text-sm`}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={handleMultilineTextKeyDown}
        />
      </label>
    </div>
  )
}

function emptyDraft(): PrescriptionDraft {
  return { sets: '', reps: '', restTime: '', rpe: '', tempo: '', load: '', notes: '' }
}

export default memo(ExerciseEditFieldsInner)
