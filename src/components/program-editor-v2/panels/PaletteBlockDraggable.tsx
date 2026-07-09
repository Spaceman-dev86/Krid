'use client'

import { memo } from 'react'

import { useDraggable } from '@dnd-kit/core'

import type { BlockKindDrag } from '../dnd/dndIds'
import { paletteBlockDragId } from '../dnd/dndIds'
import { useEditorShowGrip, useMobileDragHold } from '../dnd/useEditorDndActivator'
import {
  EDITOR_DND_HANDLE,
  EDITOR_GRIP_BUTTON_CLASS,
  EDITOR_GRIP_ICON_SIZE,
  EDITOR_GRIP_ROW_GAP,
} from '../ui/editorIconLayout'
import { IconGrip } from '../ui/EditorIcons'

type Props = {
  kind: BlockKindDrag
  label: string
  highlighted: boolean
}

function PaletteBlockDraggableInner({ kind, label, highlighted }: Props) {
  const showGrip = useEditorShowGrip()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: paletteBlockDragId(kind),
    disabled: false,
  })

  const { mobileListeners, mobileDragClass, mobileAttributes } = useMobileDragHold({
    enabled: !showGrip,
    isDragging,
    attributes,
    listeners,
  })

  const baseClass = [
    'w-full rounded-none border-0 border-b border-[var(--brand)]/30 bg-white px-2.5 py-2 text-left text-[var(--brand)] transition duration-150',
    highlighted ? 'bg-white' : 'hover:bg-white',
  ].join(' ')

  if (showGrip) {
    return (
      <div ref={setNodeRef} style={{ opacity: isDragging ? 0.45 : 1 }} className={`flex items-center ${baseClass} ${EDITOR_GRIP_ROW_GAP}`}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...{ [EDITOR_DND_HANDLE]: '' }}
          className={EDITOR_GRIP_BUTTON_CLASS}
          aria-label={`Glisser ${label}`}
          {...attributes}
          {...listeners}
        >
          <IconGrip size={EDITOR_GRIP_ICON_SIZE} />
        </button>
        <span className="min-w-0 flex-1 text-sm font-extrabold">{label}</span>
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
      <span className="min-w-0 flex-1 text-sm font-extrabold">{label}</span>
    </div>
  )
}

export default memo(PaletteBlockDraggableInner)
