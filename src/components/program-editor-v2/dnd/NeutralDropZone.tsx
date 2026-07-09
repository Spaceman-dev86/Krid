'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo } from 'react'

import { DND } from './dndIds'

type Props = {
  id: typeof DND.paletteDropzone | typeof DND.libraryDropzone
  active: boolean
}

function NeutralDropZoneInner({ id, active }: Props) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={active ? 'pointer-events-auto absolute inset-0 z-10' : 'pointer-events-none absolute inset-0'}
      aria-hidden
    />
  )
}

export default memo(NeutralDropZoneInner)
