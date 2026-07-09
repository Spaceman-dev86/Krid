'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo } from 'react'

import type { WeekNode } from '../../domain/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { useEditorShowGrip, useMobileDragHold } from './dnd/useEditorDndActivator'
import { isExternalPaletteOrLibraryDragId } from './dnd/dndIds'
import WeekSection from './WeekSection'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from './ui/editorIconLayout'
import { IconGrip } from './ui/EditorIcons'

type Props = {
  week: WeekNode
}

function SortableWeekSectionInner({ week }: Props) {
  const activeDragItemId = useProgramEditorUiStore((s) => s.activeDragItemId)
  const showGrip = useEditorShowGrip()
  const isExternalDrag = Boolean(activeDragItemId && isExternalPaletteOrLibraryDragId(activeDragItemId))
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: week.id,
      disabled: isExternalDrag,
    })

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
        transition,
        opacity: isDragging ? 0.55 : 1,
      }}
      className={showGrip ? `flex ${EDITOR_GRIP_ROW_GAP}` : 'min-w-0'}
    >
      {showGrip ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...{ [EDITOR_DND_HANDLE]: '' }}
          className={`mt-4 ${EDITOR_GRIP_BUTTON_CLASS}`}
          aria-label="Réordonner la semaine"
          {...attributes}
          {...listeners}
        >
          <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <WeekSection
          week={week}
          mobileDrag={
            showGrip
              ? undefined
              : {
                  activatorRef: setActivatorNodeRef,
                  attributes: mobileAttributes,
                  listeners: mobileListeners,
                  dragClass: mobileDragClass,
                }
          }
        />
      </div>
    </div>
  )
}

function propsAreEqual(prev: Props, next: Props) {
  if (prev.week.id !== next.week.id) return false
  if (prev.week.title !== next.week.title) return false
  if (prev.week.notes !== next.week.notes) return false
  if (prev.week.sessionIds.length !== next.week.sessionIds.length) return false
  for (let i = 0; i < prev.week.sessionIds.length; i += 1) {
    if (prev.week.sessionIds[i] !== next.week.sessionIds[i]) return false
  }
  return true
}

export default memo(SortableWeekSectionInner, propsAreEqual)
