'use client'

import { memo, useCallback, useState } from 'react'

import { createTempId } from '../../domain/program-editor'
import type { BlockKind } from '../../domain/program-editor/minimalCommands'
import { useApplyCommand, useTimelineItemIds } from '../../store/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { useEditorDndActions } from './dnd/useEditorDndActions'
import { EDITOR_TEXT_INPUT_X, EDITOR_TEXT_INPUT_X_DENSE } from './ui/editorInputStyles'
import { EDITOR_CLS } from './editorLayoutConstants'
import ExerciseLibraryPicker from './ui/ExerciseLibraryPicker'
import { handleSingleLineTextKeyDown } from './ui/textFieldKeyboard'

type Props = {
  sessionId: string
}

function SessionTimelineAddFooterInner({ sessionId }: Props) {
  const applyCommand = useApplyCommand()
  const itemIds = useTimelineItemIds(sessionId)
  const { insertBlockAt } = useEditorDndActions()
  const openPanel = useProgramEditorUiStore((s) =>
    s.openSessionAddPanel?.sessionId === sessionId ? s.openSessionAddPanel.kind : null
  )
  const setOpenSessionAddPanel = useProgramEditorUiStore((s) => s.setOpenSessionAddPanel)
  const setEditingProgramExerciseId = useProgramEditorUiStore((s) => s.setEditingProgramExerciseId)
  const [blockKind, setBlockKind] = useState<BlockKind>('warmup')
  const [blockTitle, setBlockTitle] = useState('')

  const togglePanel = useCallback(
    (kind: 'exercise' | 'block') => {
      setOpenSessionAddPanel(openPanel === kind ? null : { sessionId, kind })
    },
    [openPanel, sessionId, setOpenSessionAddPanel]
  )

  const addExercise = useCallback(
    (libraryExerciseId: string) => {
      const programExerciseId = createTempId('pe')
      applyCommand({
        type: 'timeline.exercise.add',
        sessionId,
        timelineItemId: createTempId('item'),
        programExerciseId,
        libraryExerciseId,
      })
      setEditingProgramExerciseId(programExerciseId)
      setOpenSessionAddPanel(null)
    },
    [applyCommand, sessionId, setEditingProgramExerciseId, setOpenSessionAddPanel]
  )

  const createBlock = useCallback(() => {
    insertBlockAt(sessionId, itemIds.length, blockKind, blockTitle.trim() || undefined)
    setOpenSessionAddPanel(null)
    setBlockTitle('')
  }, [blockKind, blockTitle, insertBlockAt, itemIds.length, sessionId, setOpenSessionAddPanel])

  return (
    <div className="mt-3 px-0 pb-0">
      <div className="grid grid-cols-2 gap-0.5">
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglePanel('exercise')
          }}
        >
          + Exercice
        </button>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            togglePanel('block')
          }}
        >
          + Bloc
        </button>
      </div>

      {openPanel === 'exercise' ? (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3 shadow-sm shadow-black/10">
          <ExerciseLibraryPicker onSelect={addExercise} />
        </div>
      ) : null}

      {openPanel === 'block' ? (
        <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3 shadow-sm shadow-black/10">
          <div className={`grid gap-2 ${EDITOR_CLS.gridAddFooterUntil868}`}>
            <select
              value={blockKind}
              onChange={(e) => setBlockKind(e.target.value as BlockKind)}
              className={`h-10 w-full rounded-xl border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X} pr-8 text-sm`}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="neutral">Bloc neutre</option>
              <option value="warmup">Warm-up</option>
              <option value="crossfit">CrossFit</option>
              <option value="superset">Superset</option>
            </select>
            <input
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              placeholder="Titre…"
              className={`h-10 w-full rounded-xl border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X} text-sm`}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleSingleLineTextKeyDown}
            />
          </div>
          <button
            type="button"
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[rgb(245,245,245)] px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              createBlock()
            }}
          >
            + Créer
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default memo(SessionTimelineAddFooterInner)
