'use client'

import { useDraggable } from '@dnd-kit/core'
import { memo } from 'react'

import { libraryExerciseDragId } from '../dnd/dndIds'
import { useEditorShowGrip, useMobileDragHold } from '../dnd/useEditorDndActivator'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from '../ui/editorIconLayout'
import { IconGrip } from '../ui/EditorIcons'

type Props = {
  libraryExerciseId: string
  name: string
  muscleGroup?: string | null
  highlighted: boolean
}

function LibraryExerciseDraggableInner({ libraryExerciseId, name, muscleGroup, highlighted }: Props) {
  const showGrip = useEditorShowGrip()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: libraryExerciseDragId(libraryExerciseId),
    disabled: false,
  })

  const { mobileListeners, mobileDragClass, mobileAttributes } = useMobileDragHold({
    enabled: !showGrip,
    isDragging,
    attributes,
    listeners,
  })

  const baseClass = [
    'w-full min-w-0 rounded-none border-0 border-b border-[var(--brand)]/30 bg-white px-2.5 py-2 text-left transition duration-150',
    highlighted ? 'bg-white' : 'hover:bg-white',
  ].join(' ')

  const content = (
    <div className="min-w-0 flex-1">
      <div className="break-words text-sm font-semibold leading-snug text-[var(--brand)]">{name}</div>
      {muscleGroup ? (
        <div className="mt-0.5 break-words text-[10px] font-bold leading-snug text-[var(--brand)]/70">
          {muscleGroup}
        </div>
      ) : null}
    </div>
  )

  if (showGrip) {
    return (
      <div ref={setNodeRef} style={{ opacity: isDragging ? 0.45 : 1 }} className={`flex items-start ${baseClass} ${EDITOR_GRIP_ROW_GAP}`}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...{ [EDITOR_DND_HANDLE]: '' }}
          className={`mt-0.5 ${EDITOR_GRIP_BUTTON_CLASS}`}
          aria-label={`Glisser ${name}`}
          {...attributes}
          {...listeners}
        >
          <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
        </button>
        {content}
      </div>
    )
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node)
        setActivatorNodeRef(node)
      }}
      style={{ opacity: isDragging ? 0.45 : 1 }}
      className={['touch-manipulation', baseClass, mobileDragClass].join(' ')}
      {...mobileAttributes}
      {...mobileListeners}
    >
      {content}
    </div>
  )
}

export default memo(LibraryExerciseDraggableInner)
