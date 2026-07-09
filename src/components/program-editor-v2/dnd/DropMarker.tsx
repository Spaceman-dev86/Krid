'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'

import { dropMarkerDragId } from './dndIds'

/** Hauteur de l'espace ouvert à l'insertion (px). */
const INSERT_SLOT_PX = 10

type Props = {
  sessionId: string
  index: number
  active?: boolean
  className?: string
}

/**
 * Zone d'insertion : au survol, un petit espace s'ouvre + trait violet.
 * Zone de hit élargie (invisible) pour un drop fluide.
 */
function DropMarkerInner({ sessionId, index, active = false, className = '' }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: dropMarkerDragId(sessionId, index) })
  const showActive = isOver || active

  return (
    <div
      ref={setNodeRef}
      className={['absolute left-0 right-0 z-10 flex items-center justify-center', className].join(' ')}
      style={{ height: 28 }}
      aria-hidden
    >
      <div
        className="flex w-full items-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: showActive ? INSERT_SLOT_PX : 0 }}
      >
        <div
          className={[
            'mx-2 h-0.5 w-full rounded-full bg-[var(--brand)] transition-opacity duration-150',
            showActive ? 'opacity-80' : 'opacity-0',
          ].join(' ')}
        />
      </div>
    </div>
  )
}

export default memo(DropMarkerInner)
