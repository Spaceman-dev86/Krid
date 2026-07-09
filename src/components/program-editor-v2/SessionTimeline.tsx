'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { memo, useMemo } from 'react'

import { useTimelineItemIds } from '../../store/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import DropMarker from './dnd/DropMarker'
import EmptyTimelineDropZone from './dnd/EmptyTimelineDropZone'
import { dropMarkerDragId, isExternalPaletteOrLibraryDragId, parseDropMarkerDragId } from './dnd/dndIds'
import SessionTimelineAddFooter from './SessionTimelineAddFooter'
import SortableTimelineItem from './SortableTimelineItem'

/** Même espacement que entre deux séances (`WeekSessionList`). */
const TIMELINE_ITEM_GAP = 'gap-3'

type Props = {
  sessionId: string
}

function SessionTimelineInner({ sessionId }: Props) {
  const itemIds = useTimelineItemIds(sessionId)
  const activeDragItemId = useProgramEditorUiStore((s) => s.activeDragItemId)
  const activeDropMarkerId = useProgramEditorUiStore((s) => s.activeDropMarkerId)
  const isExternalDrag = Boolean(
    activeDragItemId && isExternalPaletteOrLibraryDragId(activeDragItemId)
  )
  const sortDisabled = isExternalDrag

  const activeInsertIndex = useMemo(() => {
    const parsed = parseDropMarkerDragId(activeDropMarkerId ?? '')
    if (!parsed || parsed.sessionId !== sessionId) return null
    return parsed.index
  }, [activeDropMarkerId, sessionId])

  if (itemIds.length === 0) {
    return (
      <>
        <EmptyTimelineDropZone
          sessionId={sessionId}
          active={activeDropMarkerId === dropMarkerDragId(sessionId, 0)}
        />
        <SessionTimelineAddFooter sessionId={sessionId} />
      </>
    )
  }

  return (
    <>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="relative">
          <DropMarker
            sessionId={sessionId}
            index={0}
            active={activeInsertIndex === 0}
            className="top-0 -translate-y-1/2"
          />
          <div className={`grid ${TIMELINE_ITEM_GAP}`}>
            {itemIds.map((itemId, idx) => (
              <div key={itemId} className="relative">
                <SortableTimelineItem itemId={itemId} disabled={sortDisabled} />
                <DropMarker
                  sessionId={sessionId}
                  index={idx + 1}
                  active={activeInsertIndex === idx + 1}
                  className="top-full mt-1.5 -translate-y-1/2"
                />
              </div>
            ))}
          </div>
        </div>
      </SortableContext>
      <SessionTimelineAddFooter sessionId={sessionId} />
    </>
  )
}

export default memo(SessionTimelineInner)
