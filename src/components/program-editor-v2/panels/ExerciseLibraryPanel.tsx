'use client'

import { memo, useMemo, useState, type CSSProperties } from 'react'

import { useProgramEditorUiStore } from '../../../store/program-editor/uiStore'
import { useExerciseLibraryCatalog } from '../ExerciseLibraryContext'
import { DND } from '../dnd/dndIds'
import NeutralDropZone from '../dnd/NeutralDropZone'
import { EDITOR_SECTION_TITLE_CLASS } from '../ui/editorSectionTitle'
import { EDITOR_PANEL_SHADOW_CLASS, EDITOR_ROUNDED_FIELD_CLASS, EDITOR_TEXT_INPUT_X, EDITOR_TEXT_INPUT_X_DENSE } from '../ui/editorInputStyles'
import LibraryExerciseDraggable from './LibraryExerciseDraggable'

const DEFAULT_VISIBLE_ROWS = 10
const STACKED_SIDEBAR_VISIBLE_ROWS = 5
const ROW_HEIGHT_REM = 3.5
const ROW_GAP_REM = 0.375

function libraryListMaxHeight(rows: number) {
  return `calc(${rows} * ${ROW_HEIGHT_REM}rem + ${rows - 1} * ${ROW_GAP_REM}rem)`
}

const LIBRARY_LIST_MAX_H = libraryListMaxHeight(DEFAULT_VISIBLE_ROWS)
const LIBRARY_LIST_STACKED_MAX_H = libraryListMaxHeight(STACKED_SIDEBAR_VISIBLE_ROWS)

type Props = {
  className?: string
  stickyFill?: boolean
}

function ExerciseLibraryPanelInner({ className = '', stickyFill = false }: Props) {
  const { exercises, muscleGroups } = useExerciseLibraryCatalog()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState('')
  const highlightId = useProgramEditorUiStore((s) => s.paletteHighlightId)
  const activeDragItemId = useProgramEditorUiStore((s) => s.activeDragItemId)
  const isExternalDrag = Boolean(
    activeDragItemId?.startsWith(DND.paletteBlockPrefix) ||
      activeDragItemId?.startsWith(DND.libraryExercisePrefix)
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const m = muscle.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (m && String(ex.muscle_group ?? '').trim().toLowerCase() !== m) return false
      if (!q) return true
      return String(ex.name).toLowerCase().includes(q)
    })
  }, [exercises, muscle, query])

  return (
    <div
      className={[
        'relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white',
        EDITOR_PANEL_SHADOW_CLASS,
        stickyFill ? 'h-full' : 'max-h-[min(60vh,520px)]',
        className,
      ].join(' ')}
      style={
        {
          '--library-list-h-stacked': LIBRARY_LIST_STACKED_MAX_H,
          '--library-list-h-default': LIBRARY_LIST_MAX_H,
        } as CSSProperties
      }
    >
      <NeutralDropZone id={DND.libraryDropzone} active={isExternalDrag} />
      <div className="shrink-0 rounded-t-2xl bg-white px-3 pb-3 pt-3">
        <div className={`${EDITOR_SECTION_TITLE_CLASS} leading-tight max-[867px]:text-sm`}>
          Bibliothèque
          <span className="hidden min-[868px]:inline"> d&apos;exercice</span>
          <span className="block min-[868px]:hidden">d&apos;exercice</span>
        </div>
        <p className="mt-1 text-[10px] font-medium text-[var(--muted)]">Glisser dans une séance ou un bloc ouvert.</p>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className={`h-9 w-full min-w-0 ${EDITOR_ROUNDED_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} text-sm`}
          />
          <select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
            className={`h-9 w-full rounded-xl border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} pr-7 text-sm`}
          >
            <option value="">Muscle</option>
            {muscleGroups.map((mg) => (
              <option key={mg} value={mg}>
                {mg}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={[
          'min-h-0 shrink-0 overflow-x-hidden overflow-y-auto overscroll-contain px-3 pb-3',
          'min-[768px]:max-[999px]:max-h-[var(--library-list-h-stacked)]',
          'min-[1000px]:max-h-[var(--library-list-h-default)]',
        ].join(' ')}
      >
        <div className="grid gap-1.5">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-600">Aucun exercice.</div>
          ) : (
            filtered.map((ex) => (
              <div
                key={ex.id}
                onMouseEnter={() => useProgramEditorUiStore.getState().setPaletteHighlight(ex.id)}
                onMouseLeave={() => useProgramEditorUiStore.getState().setPaletteHighlight(null)}
              >
                <LibraryExerciseDraggable
                  libraryExerciseId={ex.id}
                  name={ex.name}
                  muscleGroup={ex.muscle_group}
                  highlighted={highlightId === ex.id}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(ExerciseLibraryPanelInner)
