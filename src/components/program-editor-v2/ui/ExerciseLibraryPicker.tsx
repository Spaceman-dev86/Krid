'use client'

import { memo, useMemo, useState } from 'react'

import { useExerciseLibraryCatalog } from '../ExerciseLibraryContext'

import { EDITOR_TEXT_INPUT_X, EDITOR_TEXT_INPUT_X_DENSE } from './editorInputStyles'

type Props = {
  onSelect: (libraryExerciseId: string) => void
}

function ExerciseLibraryPickerInner({ onSelect }: Props) {
  const { exercises, muscleGroups } = useExerciseLibraryCatalog()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')

  const handleSelect = (libraryExerciseId: string) => {
    setQuery('')
    setMuscle('')
    onSelect(libraryExerciseId)
  }

  const showResults = query.trim().length >= 1 || muscle.trim().length > 0

  const filtered = useMemo(() => {
    if (!showResults) return []
    const q = query.trim().toLowerCase()
    const m = muscle.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (m && String(ex.muscle_group ?? '').trim().toLowerCase() !== m) return false
      if (!q) return true
      return String(ex.name).toLowerCase().includes(q)
    })
  }, [exercises, muscle, query, showResults])

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un exercice…"
          className={`h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} text-sm`}
        />
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          className={`h-8 w-[100px] shrink-0 rounded-lg border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} text-xs`}
        >
          <option value="">Muscle</option>
          {muscleGroups.map((mg) => (
            <option key={mg} value={mg}>
              {mg}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 max-h-40 overflow-y-auto">
        {!showResults ? null : filtered.length === 0 ? (
          <div className="py-2 text-center text-xs text-gray-500">Aucun exercice</div>
        ) : (
          filtered.slice(0, 12).map((ex) => (
            <button
              key={ex.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white"
              onClick={() => handleSelect(ex.id)}
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-[var(--brand)]">{ex.name}</span>
              {ex.muscle_group ? (
                <span className="ml-auto truncate pl-2 text-xs font-semibold text-gray-500">{ex.muscle_group}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default memo(ExerciseLibraryPickerInner)
