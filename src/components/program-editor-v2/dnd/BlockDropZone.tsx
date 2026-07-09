'use client'

import { useDroppable } from '@dnd-kit/core'
import { memo, type ReactNode } from 'react'

import { useProgramEditorUiStore } from '../../../store/program-editor/uiStore'
import { blockDropDragId, DND } from './dndIds'

type Props = {
  blockId: string
  children: ReactNode
}

function BlockDropZoneInner({ blockId, children }: Props) {
  const activeDragItemId = useProgramEditorUiStore((s) => s.activeDragItemId)
  const isLibraryDrag = Boolean(
    activeDragItemId?.startsWith(DND.libraryExercisePrefix)
  )
  const { setNodeRef, isOver } = useDroppable({ id: blockDropDragId(blockId) })
  const showHighlight = isLibraryDrag && isOver

  return (
    <div
      ref={setNodeRef}
      className={[
        'min-h-[120px] rounded-xl transition-colors',
        showHighlight
          ? 'bg-[var(--brand)]/5 outline outline-2 outline-[var(--brand)] outline-offset-2'
          : undefined,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export default memo(BlockDropZoneInner)
