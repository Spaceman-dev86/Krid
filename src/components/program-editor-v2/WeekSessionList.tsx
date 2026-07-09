'use client'

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo } from 'react'

import SessionCard from './SessionCard'
import { useEditorShowGrip, useMobileDragHold } from './dnd/useEditorDndActivator'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from './ui/editorIconLayout'
import { IconGrip } from './ui/EditorIcons'

type SortableSessionProps = {
  sessionId: string
}

function SortableSessionRow({ sessionId }: SortableSessionProps) {
  const showGrip = useEditorShowGrip()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: sessionId,
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
          aria-label="Réordonner la séance"
          {...attributes}
          {...listeners}
        >
          <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <SessionCard
          sessionId={sessionId}
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

type Props = {
  weekId: string
  sessionIds: string[]
}

function WeekSessionListInner({ weekId, sessionIds }: Props) {
  void weekId

  if (sessionIds.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/15 px-3 py-6 text-center text-sm font-medium text-black/45">
        Aucune séance — ajoutez-en une ci-dessous.
      </div>
    )
  }

  return (
    <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
      <div className="grid gap-3">
        {sessionIds.map((sessionId) => (
          <SortableSessionRow key={sessionId} sessionId={sessionId} />
        ))}
      </div>
    </SortableContext>
  )
}

export default memo(WeekSessionListInner)
