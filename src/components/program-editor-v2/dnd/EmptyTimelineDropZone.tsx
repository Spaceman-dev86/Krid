'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'

import { dropMarkerDragId } from './dndIds'

type Props = {
  sessionId: string
  active?: boolean
}

function EmptyTimelineDropZoneInner({ sessionId, active = false }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: dropMarkerDragId(sessionId, 0) })
  const showActive = isOver || active

  return (
    <div
      ref={setNodeRef}
      className={[
        'overflow-hidden rounded-xl border border-dashed px-3 text-center text-xs font-semibold transition-[border-color,background-color,padding] duration-200 ease-out',
        showActive
          ? 'border-[var(--brand)]/45 bg-[var(--brand)]/5 py-7 text-[var(--brand)]'
          : 'border-black/15 py-6 text-black/45',
      ].join(' ')}
    >
      {showActive ? (
        <div className="grid gap-2">
          <div className="mx-auto h-0.5 w-12 rounded-full bg-[var(--brand)]/70" />
          <span>Déposer ici</span>
        </div>
      ) : (
        'Timeline vide — glissez un bloc ou un exercice, ou ajoutez ci-dessous.'
      )}
    </div>
  )
}

export default memo(EmptyTimelineDropZoneInner)
