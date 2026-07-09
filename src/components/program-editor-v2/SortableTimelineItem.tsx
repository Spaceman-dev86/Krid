'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo } from 'react'

import { useTimelineItem } from '../../store/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { useEditorShowGrip, useMobileDragHold, MOBILE_DRAG_LABEL } from './dnd/useEditorDndActivator'
import TimelineItemView from './TimelineItemView'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from './ui/editorIconLayout'
import { IconGrip } from './ui/EditorIcons'

type Props = {
  itemId: string
  disabled?: boolean
}

function SortableTimelineItemInner({ itemId, disabled = false }: Props) {
  const item = useTimelineItem(itemId)
  const editingProgramExerciseId = useProgramEditorUiStore((s) => s.editingProgramExerciseId)
  const showGrip = useEditorShowGrip()
  const disableThisRow =
    disabled ||
    Boolean(
      editingProgramExerciseId &&
        item?.kind === 'exercise' &&
        item.programExerciseId === editingProgramExerciseId
    )

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    disabled: disableThisRow,
  })
  const setActiveDrag = useProgramEditorUiStore((s) => s.setActiveDrag)

  const { mobileListeners, mobileDragClass, mobileAttributes } = useMobileDragHold({
    enabled: !showGrip,
    isDragging,
    attributes,
    listeners,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      {showGrip ? (
        <div className={`flex ${EDITOR_GRIP_ROW_GAP}`}>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...{ [EDITOR_DND_HANDLE]: '' }}
            className={`mt-2 ${EDITOR_GRIP_BUTTON_CLASS}`}
            aria-label="Réordonner"
            {...attributes}
            {...listeners}
            onMouseDown={() => setActiveDrag(itemId, 'Timeline')}
          >
            <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
          </button>
          <div className="min-w-0 flex-1">
            <TimelineItemView itemId={itemId} compact={isDragging} />
          </div>
        </div>
      ) : (
        <div
          ref={setActivatorNodeRef}
          className={[
            'min-w-0 select-none touch-manipulation rounded-xl transition-all duration-150 max-[767px]:cursor-grab',
            mobileDragClass,
          ].join(' ')}
          {...mobileAttributes}
          {...mobileListeners}
          title={MOBILE_DRAG_LABEL}
          aria-label={MOBILE_DRAG_LABEL}
        >
          <TimelineItemView itemId={itemId} compact={isDragging} />
        </div>
      )}
    </div>
  )
}

export default memo(SortableTimelineItemInner)
