import type { MinimalProgramDocument } from '../../domain/program-editor'

/**
 * Hydration modes for Phase 4 server load.
 *
 * - `initial`: first load only (no document yet, or not dirty)
 * - `force-replace`: replace local document (explicit reload; may discard local edits)
 */
export type HydrateMode = 'initial' | 'force-replace'

export type HydrateRejectReason = 'dirty-document' | 'invalid-document'

export type HydrateResult =
  | { applied: true }
  | { applied: false; reason: HydrateRejectReason }

export type HydrateGuardState = {
  document: MinimalProgramDocument | null
  isDirty: boolean
}

export function canApplyHydrate(
  state: HydrateGuardState,
  mode: HydrateMode = 'initial'
): boolean {
  if (mode === 'force-replace') return true
  if (!state.document) return true
  return !state.isDirty
}
