import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type ClientRect,
  type Collision,
  type CollisionDetection,
} from '@dnd-kit/core'

import { DND, isExternalPaletteOrLibraryDragId } from './dndIds'
import { getProgramDocument } from '../../../store/program-editor/documentStore'

function isDropMarker(id: string): boolean {
  return id.startsWith(DND.dropMarkerPrefix)
}

function isBlockDrop(id: string): boolean {
  return id.startsWith(DND.blockDropPrefix)
}

function distanceToRect(px: number, py: number, rect: ClientRect): number {
  const dx = px < rect.left ? rect.left - px : px > rect.right ? px - rect.right : 0
  const dy = py < rect.top ? rect.top - py : py > rect.bottom ? py - rect.bottom : 0
  return Math.hypot(dx, dy)
}

/** Marqueur le plus proche du curseur (insertion timeline). */
function nearestDropMarkerCollisions(
  args: Parameters<CollisionDetection>[0],
  maxDistancePx = 56
): Collision[] {
  const { pointerCoordinates, droppableContainers, droppableRects } = args
  if (!pointerCoordinates) return []

  let bestId: string | null = null
  let bestDist = maxDistancePx

  for (const container of droppableContainers) {
    const id = String(container.id)
    if (!isDropMarker(id)) continue
    const rect = droppableRects.get(container.id)
    if (!rect) continue

    const dist = distanceToRect(pointerCoordinates.x, pointerCoordinates.y, rect)
    if (dist < bestDist) {
      bestDist = dist
      bestId = id
    }
  }

  return bestId ? [{ id: bestId }] : []
}

function blockDropUnderPointer(args: Parameters<CollisionDetection>[0]): Collision[] {
  return pointerWithin(args).filter((c) => isBlockDrop(String(c.id)))
}

/** Glisser depuis la bibliothèque : bloc ouvert prioritaire si le curseur est dedans. */
function resolveLibraryExerciseCollisions(args: Parameters<CollisionDetection>[0]): Collision[] {
  const blockHits = blockDropUnderPointer(args)
  if (blockHits.length > 0) return blockHits

  return nearestDropMarkerCollisions(args)
}

function pickCollisions(collisions: Collision[], activeId: string | null): Collision[] {
  if (collisions.length === 0) return collisions

  const isExternal = Boolean(activeId && isExternalPaletteOrLibraryDragId(activeId))

  if (isExternal) {
    if (activeId?.startsWith(DND.libraryExercisePrefix)) {
      const blockHit = collisions.find((c) => isBlockDrop(String(c.id)))
      if (blockHit) return [blockHit]
    }

    const markerHit = collisions.find((c) => isDropMarker(String(c.id)))
    if (markerHit) return [markerHit]

    if (activeId?.startsWith(DND.paletteBlockPrefix)) {
      const blockHit = collisions.find((c) => isBlockDrop(String(c.id)))
      if (blockHit) return [blockHit]
    }
  }

  return collisions
}

function blockExerciseDragBlockId(activeId: string | null): string | null {
  if (!activeId || isExternalPaletteOrLibraryDragId(activeId)) return null
  if (isDropMarker(activeId) || isBlockDrop(activeId)) return null
  const doc = getProgramDocument()
  if (!doc) return null
  return doc.entities.blockExercises[activeId]?.blockId ?? null
}

/** Réordonnancement interne : uniquement les exercices du même bloc (pas de marqueurs timeline). */
function blockExerciseCollisions(
  args: Parameters<CollisionDetection>[0],
  blockId: string
): Collision[] {
  const doc = getProgramDocument()
  if (!doc) return []
  const allowed = new Set(doc.entities.sessionBlocks[blockId]?.blockExerciseIds ?? [])
  if (allowed.size === 0) return []

  const inScope = (c: Collision) => allowed.has(String(c.id))

  const pointerHits = pointerWithin(args).filter(inScope)
  if (pointerHits.length > 0) return pointerHits

  const rectHits = rectIntersection(args).filter(inScope)
  if (rectHits.length > 0) return rectHits

  const scopedContainers = args.droppableContainers.filter((c) => allowed.has(String(c.id)))
  if (scopedContainers.length === 0) return []

  return closestCenter({ ...args, droppableContainers: scopedContainers })
}

/** Favor drop targets under the pointer; insertions ciblent les marqueurs de séance. */
export const editorCollisionDetection: CollisionDetection = (args) => {
  const activeId = args.active?.id != null ? String(args.active.id) : null

  const blockExerciseBlockId = blockExerciseDragBlockId(activeId)
  if (blockExerciseBlockId) {
    return blockExerciseCollisions(args, blockExerciseBlockId)
  }

  if (activeId?.startsWith(DND.libraryExercisePrefix)) {
    const libraryHits = resolveLibraryExerciseCollisions(args)
    if (libraryHits.length > 0) return libraryHits
  }

  if (activeId?.startsWith(DND.paletteBlockPrefix)) {
    const markers = nearestDropMarkerCollisions(args)
    if (markers.length > 0) return markers
  }

  const pointerHits = pointerWithin(args)
  if (pointerHits.length > 0) return pickCollisions(pointerHits, activeId)

  const rectHits = rectIntersection(args)
  if (rectHits.length > 0) return pickCollisions(rectHits, activeId)

  if (activeId && isExternalPaletteOrLibraryDragId(activeId)) {
    const markers = nearestDropMarkerCollisions(args)
    if (markers.length > 0) return markers
  }

  return closestCenter(args)
}
