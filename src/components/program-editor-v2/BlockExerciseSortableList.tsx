'use client'

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo } from 'react'

import { useApplyCommand, useBlockExercise, useBlockExerciseIds } from '../../store/program-editor'
import useBlockExerciseDisplayName from './useBlockExerciseDisplayName'
import { useEditorShowGrip, useMobileDragHold, MOBILE_DRAG_LABEL } from './dnd/useEditorDndActivator'
import { EDITOR_CLS } from './editorLayoutConstants'
import InlineCommitField from './ui/InlineCommitField'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from './ui/editorIconLayout'
import { IconGrip } from './ui/EditorIcons'

type SortableRowProps = {
  blockExerciseId: string
}

function SortableBlockExerciseRow({ blockExerciseId }: SortableRowProps) {
  const row = useBlockExercise(blockExerciseId)
  const displayName = useBlockExerciseDisplayName(row)
  const applyCommand = useApplyCommand()
  const showGrip = useEditorShowGrip()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: blockExerciseId,
  })

  const { mobileListeners, mobileDragClass, mobileAttributes } = useMobileDragHold({
    enabled: !showGrip,
    isDragging,
    attributes,
    listeners,
  })

  if (!row) return null

  const rowContent = (
    <>
      <div className={`grid min-w-0 flex-1 items-start gap-1 ${EDITOR_CLS.gridPairUntil868}`}>
        <div
          className="min-w-0 truncate px-2 py-1.5 text-xs font-semibold text-[var(--brand)]"
          title={displayName}
        >
          {displayName}
        </div>
        <InlineCommitField
          value={row.notes ?? ''}
          placeholder="Notes"
          dense
          plain
          className="border-l border-gray-200 pl-2 max-[767px]:border-l-0 max-[767px]:pl-0"
          inputClassName="text-[11px] text-gray-600"
          onCommit={(notes) =>
            applyCommand({
              type: 'blockExercise.update',
              blockExerciseId,
              patch: { notes: notes || null },
            })
          }
        />
      </div>
      <button
        type="button"
        className="mt-1 shrink-0 px-1 text-xs font-semibold text-gray-500 hover:text-gray-900"
        aria-label="Supprimer l'exercice du bloc"
        onClick={(e) => {
          e.stopPropagation()
          applyCommand({ type: 'blockExercise.delete', blockExerciseId })
        }}
      >
        sup
      </button>
    </>
  )

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      {showGrip ? (
        <div className={`flex ${EDITOR_GRIP_ROW_GAP}`}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...{ [EDITOR_DND_HANDLE]: '' }}
            className={`mt-1.5 ${EDITOR_GRIP_BUTTON_CLASS}`}
            aria-label="Réordonner l'exercice"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
          </button>
          {rowContent}
        </div>
      ) : (
        <div
          ref={setActivatorNodeRef}
          className={[
            'flex touch-manipulation select-none items-start gap-1 rounded-lg transition-all duration-150 max-[767px]:cursor-grab',
            mobileDragClass,
          ].join(' ')}
          {...mobileAttributes}
          {...mobileListeners}
          title={MOBILE_DRAG_LABEL}
          aria-label={MOBILE_DRAG_LABEL}
        >
          {rowContent}
        </div>
      )}
    </div>
  )
}

type Props = {
  blockId: string
}

function BlockExerciseSortableListInner({ blockId }: Props) {
  const exerciseIds = useBlockExerciseIds(blockId)

  if (exerciseIds.length === 0) {
    return <div className="text-[11px] text-gray-500">Aucun exercice dans le bloc.</div>
  }

  return (
    <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
      <div className="grid gap-1" onClick={(e) => e.stopPropagation()}>
        {exerciseIds.map((beId) => (
          <SortableBlockExerciseRow key={beId} blockExerciseId={beId} />
        ))}
      </div>
    </SortableContext>
  )
}

export default memo(BlockExerciseSortableListInner)
