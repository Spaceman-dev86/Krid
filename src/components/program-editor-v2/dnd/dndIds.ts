export const DND = {
  paletteBlockPrefix: 'palette-block:',
  libraryExercisePrefix: 'library-exercise:',
  dropMarkerPrefix: 'drop-marker:',
  blockDropPrefix: 'block-drop:',
  paletteDropzone: 'palette-dropzone',
  libraryDropzone: 'library-dropzone',
} as const

export type BlockKindDrag = 'warmup' | 'crossfit' | 'superset' | 'neutral'

export function paletteBlockDragId(kind: BlockKindDrag): string {
  return `${DND.paletteBlockPrefix}${kind}`
}

export function libraryExerciseDragId(libraryExerciseId: string): string {
  return `${DND.libraryExercisePrefix}${libraryExerciseId}`
}

export function dropMarkerDragId(sessionId: string, index: number): string {
  return `${DND.dropMarkerPrefix}${sessionId}#${index}`
}

export function blockDropDragId(blockId: string): string {
  return `${DND.blockDropPrefix}${blockId}`
}

export function parsePaletteBlockDragId(id: string): BlockKindDrag | null {
  if (!id.startsWith(DND.paletteBlockPrefix)) return null
  const kind = id.slice(DND.paletteBlockPrefix.length)
  if (kind === 'warmup' || kind === 'crossfit' || kind === 'superset' || kind === 'neutral') return kind
  return null
}

export function parseLibraryExerciseDragId(id: string): string | null {
  if (!id.startsWith(DND.libraryExercisePrefix)) return null
  const exerciseId = id.slice(DND.libraryExercisePrefix.length)
  return exerciseId || null
}

export function parseDropMarkerDragId(id: string): { sessionId: string; index: number } | null {
  if (!id.startsWith(DND.dropMarkerPrefix)) return null
  const payload = id.slice(DND.dropMarkerPrefix.length)
  const hashIdx = payload.lastIndexOf('#')
  if (hashIdx < 0) return null
  const sessionId = payload.slice(0, hashIdx)
  const index = Number.parseInt(payload.slice(hashIdx + 1), 10)
  if (!sessionId || !Number.isFinite(index)) return null
  return { sessionId, index }
}

export function parseBlockDropDragId(id: string): string | null {
  if (!id.startsWith(DND.blockDropPrefix)) return null
  const blockId = id.slice(DND.blockDropPrefix.length)
  return blockId || null
}

export function isExternalPaletteOrLibraryDragId(id: string): boolean {
  return id.startsWith(DND.paletteBlockPrefix) || id.startsWith(DND.libraryExercisePrefix)
}

export function isPaletteBlockDragId(id: string): boolean {
  return id.startsWith(DND.paletteBlockPrefix)
}
