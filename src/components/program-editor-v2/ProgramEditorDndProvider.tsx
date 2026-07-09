'use client'

import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { arrayMove } from '@dnd-kit/sortable'
import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react'

import type { MinimalProgramDocument } from '../../domain/program-editor'
import { libraryExerciseName } from '../../domain/program-editor/devExerciseLibrary'
import { useExerciseLibraryCatalog } from './ExerciseLibraryContext'
import { getProgramDocument, useApplyCommand } from '../../store/program-editor'
import { useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import TimelineDragPreview from './ui/TimelineDragPreview'
import { editorCollisionDetection } from './dnd/collisionDetection'
import { useEditorDndSensors } from './dnd/useEditorDndSensors'
import {
  DND,
  isExternalPaletteOrLibraryDragId,
  parseBlockDropDragId,
  parseDropMarkerDragId,
  parseLibraryExerciseDragId,
  parsePaletteBlockDragId,
} from './dnd/dndIds'
import { useEditorDndActions } from './dnd/useEditorDndActions'
import { useEditorDragAutoScroll } from './dnd/useEditorDragAutoScroll'

const PALETTE_LABELS: Record<string, string> = {
  warmup: 'Warm-up',
  crossfit: 'CrossFit',
  superset: 'Superset',
  neutral: 'Bloc neutre',
}

type Props = {
  children: ReactNode
}

function ProgramEditorDndProviderInner({ children }: Props) {
  const { exercises: libraryExercises } = useExerciseLibraryCatalog()
  const applyCommand = useApplyCommand()
  const setActiveDrag = useProgramEditorUiStore((s) => s.setActiveDrag)
  const setActiveDropMarkerId = useProgramEditorUiStore((s) => s.setActiveDropMarkerId)
  const { insertBlockAt, insertExerciseAt, addExerciseToBlock } = useEditorDndActions()

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [lastOverId, setLastOverId] = useState<string | null>(null)
  const activeDropMarkerRef = useRef<string | null>(null)

  const sensors = useEditorDndSensors()

  const isExternalDrag = Boolean(activeDragId && isExternalPaletteOrLibraryDragId(activeDragId))

  useEditorDragAutoScroll(Boolean(activeDragId))

  const overlayLabel = useMemo(() => {
    if (!activeDragId) return null
    const paletteKind = parsePaletteBlockDragId(activeDragId)
    if (paletteKind) return { label: PALETTE_LABELS[paletteKind] ?? paletteKind, meta: 'Bloc' }
    const libraryId = parseLibraryExerciseDragId(activeDragId)
    if (libraryId) {
      const fromCatalog = libraryExercises.find((e) => e.id === libraryId)?.name
      const label = fromCatalog ?? libraryExerciseName(libraryId) ?? 'Exercice'
      return { label, meta: undefined }
    }
    return null
  }, [activeDragId, libraryExercises])

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id)
      setActiveDragId(id)
      setLastOverId(null)
      activeDropMarkerRef.current = null
      setActiveDropMarkerId(null)
      setActiveDrag(id, isExternalPaletteOrLibraryDragId(id) ? 'Palette' : 'Timeline')
    },
    [setActiveDrag, setActiveDropMarkerId]
  )

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const activeId = String(event.active.id)
      const overId = event.over?.id ? String(event.over.id) : null
      if (overId) setLastOverId(overId)

      const document = getProgramDocument()
      if (document?.entities.blockExercises[activeId]) {
        if (activeDropMarkerRef.current !== null) {
          activeDropMarkerRef.current = null
          setActiveDropMarkerId(null)
        }
        return
      }

      const nextMarker = overId?.startsWith(DND.dropMarkerPrefix) ? overId : null
      if (activeDropMarkerRef.current === nextMarker) return
      activeDropMarkerRef.current = nextMarker
      setActiveDropMarkerId(nextMarker)
    },
    [setActiveDropMarkerId]
  )

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id)
      const overId = event.over?.id ? String(event.over.id) : lastOverId
      const markerAtRelease = activeDropMarkerRef.current

      setActiveDragId(null)
      activeDropMarkerRef.current = null
      setActiveDropMarkerId(null)
      setLastOverId(null)
      setActiveDrag(null)

      const document = getProgramDocument()
      if (!overId || !document) return
      if (overId === DND.paletteDropzone || overId === DND.libraryDropzone) return

      const { openSessionIds, expandedBlockId } = useProgramEditorUiStore.getState()

      const resolveInsertIndex = (sessionId: string, targetOverId: string): number | null => {
        const marker = parseDropMarkerDragId(targetOverId)
        if (marker && marker.sessionId === sessionId) return marker.index

        const session = document.entities.sessions[sessionId]
        if (!session) return null

        const overIndex = session.timelineItemIds.indexOf(targetOverId)
        if (overIndex >= 0) return overIndex + 1

        return session.timelineItemIds.length
      }

      const paletteKind = parsePaletteBlockDragId(activeId)
      if (paletteKind) {
        const blockId = parseBlockDropDragId(overId)
        if (blockId) return

        const marker = parseDropMarkerDragId(overId)
        const sessionId = marker?.sessionId ?? findSessionIdForTimelineItem(document, overId)
        if (!sessionId || !openSessionIds[sessionId]) return
        const index = marker?.index ?? resolveInsertIndex(sessionId, overId)
        if (index == null) return
        insertBlockAt(sessionId, index, paletteKind)
        return
      }

      const libraryExerciseId = parseLibraryExerciseDragId(activeId)
      if (libraryExerciseId) {
        let blockId = parseBlockDropDragId(overId)
        if (!blockId && expandedBlockId) {
          const timelineItem = document.entities.timelineItems[overId]
          if (timelineItem?.kind === 'block' && timelineItem.sessionBlockId === expandedBlockId) {
            blockId = expandedBlockId
          }
          const blockExercise = document.entities.blockExercises[overId]
          if (blockExercise?.blockId === expandedBlockId) {
            blockId = expandedBlockId
          }
        }
        if (blockId) {
          const fromCatalog = libraryExercises.find((e) => e.id === libraryExerciseId)?.name
          const exerciseName = fromCatalog ?? libraryExerciseName(libraryExerciseId) ?? undefined
          addExerciseToBlock(blockId, libraryExerciseId, exerciseName)
          return
        }

        const marker =
          parseDropMarkerDragId(overId) ?? parseDropMarkerDragId(markerAtRelease ?? '')
        if (marker && openSessionIds[marker.sessionId]) {
          insertExerciseAt(marker.sessionId, marker.index, libraryExerciseId)
          return
        }

        const sessionId = findSessionIdForTimelineItem(document, overId)
        if (!sessionId || !openSessionIds[sessionId]) return
        const index = resolveInsertIndex(sessionId, overId)
        if (index == null) return
        insertExerciseAt(sessionId, index, libraryExerciseId)
        return
      }

      if (activeId === overId) return

      const blockExercise = document.entities.blockExercises[activeId]
      if (blockExercise) {
        const overBlockExercise = document.entities.blockExercises[overId]
        if (!overBlockExercise || overBlockExercise.blockId !== blockExercise.blockId) return
        const block = document.entities.sessionBlocks[blockExercise.blockId]
        if (!block) return
        const ids = block.blockExerciseIds
        const oldIndex = ids.indexOf(activeId)
        const newIndex = ids.indexOf(overId)
        if (oldIndex < 0 || newIndex < 0) return
        applyCommand({
          type: 'blockExercise.reorder',
          blockId: block.id,
          blockExerciseIds: arrayMove(ids, oldIndex, newIndex),
        })
        return
      }

      const activeWeekIndex = document.weeks.findIndex((w) => w.id === activeId)
      const overWeekIndex = document.weeks.findIndex((w) => w.id === overId)
      if (activeWeekIndex >= 0 && overWeekIndex >= 0 && activeWeekIndex !== overWeekIndex) {
        applyCommand({
          type: 'week.reorder',
          weekIds: arrayMove(
            document.weeks.map((w) => w.id),
            activeWeekIndex,
            overWeekIndex
          ),
        })
        return
      }

      const activeSession = document.entities.sessions[activeId]
      const overSession = document.entities.sessions[overId]
      if (activeSession && overSession && activeSession.weekId === overSession.weekId) {
        const week = document.weeks.find((w) => w.id === activeSession.weekId)
        if (!week) return
        const oldIndex = week.sessionIds.indexOf(activeId)
        const newIndex = week.sessionIds.indexOf(overId)
        if (oldIndex < 0 || newIndex < 0) return
        applyCommand({
          type: 'week.sessions.reorder',
          weekId: week.id,
          sessionIds: arrayMove(week.sessionIds, oldIndex, newIndex),
        })
        return
      }

      const activeTimelineSession = findSessionIdForTimelineItem(document, activeId)
      const overTimelineSession = findSessionIdForTimelineItem(document, overId)
      if (!activeTimelineSession || activeTimelineSession !== overTimelineSession) return

      const session = document.entities.sessions[activeTimelineSession]
      if (!session) return
      const oldIndex = session.timelineItemIds.indexOf(activeId)
      const newIndex = session.timelineItemIds.indexOf(overId)
      if (oldIndex < 0 || newIndex < 0) return

      applyCommand({
        type: 'timeline.reorder',
        sessionId: session.id,
        timelineItemIds: arrayMove(session.timelineItemIds, oldIndex, newIndex),
      })
    },
    [
      addExerciseToBlock,
      applyCommand,
      insertBlockAt,
      insertExerciseAt,
      lastOverId,
      setActiveDrag,
      setActiveDropMarkerId,
    ]
  )

  const onDragCancel = useCallback(() => {
    setActiveDragId(null)
    activeDropMarkerRef.current = null
    setActiveDropMarkerId(null)
    setLastOverId(null)
    setActiveDrag(null)
  }, [setActiveDrag, setActiveDropMarkerId])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={editorCollisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      <DragOverlay
        dropAnimation={null}
        modifiers={isExternalDrag ? [snapCenterToCursor] : undefined}
      >
        {overlayLabel ? (
          <TimelineDragPreview label={overlayLabel.label} meta={overlayLabel.meta} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function findSessionIdForTimelineItem(document: MinimalProgramDocument, timelineItemId: string): string | null {
  const item = document.entities.timelineItems[timelineItemId]
  return item?.sessionId ?? null
}

export default memo(ProgramEditorDndProviderInner)
