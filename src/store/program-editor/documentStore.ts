import { create } from 'zustand'

import {
  applyMinimalCommand,
  assertValidMinimalDocument,
  DomainError,
  programEditorTempIdRegistry,
  remapMinimalDocumentIds,
  type MinimalCommand,
  type MinimalProgramDocument,
  type ProgramMetaNode,
} from '../../domain/program-editor'
import { type CommandError, type CommandResult, normalizeCommandError } from './commandResult'
import { canApplyHydrate, type HydrateMode, type HydrateResult } from './hydrationContract'
import { truncatePersistenceAfterRevision } from '../../persistence/activeQueueRef'
import { useProgramEditorUiStore } from './uiStore'

const MAX_UNDO_STACK = 50

type HistoryEntry = {
  document: MinimalProgramDocument
  revision: number
}

function cloneDocumentSnapshot(doc: MinimalProgramDocument): MinimalProgramDocument {
  return structuredClone(doc)
}

function pushUndoEntry(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...stack, entry]
  if (next.length > MAX_UNDO_STACK) next.shift()
  return next
}

export type CommandAppliedListener = (event: {
  command: MinimalCommand
  prev: MinimalProgramDocument
  next: MinimalProgramDocument
  revision: number
}) => void

export type ProgramDocumentStoreState = {
  document: MinimalProgramDocument | null
  /** True after local edits; cleared on successful hydrate. */
  isDirty: boolean
  /** Increments on each successful hydrate (for future UI remount keys). */
  hydrationEpoch: number
  /** Monotonic counter bumped on each successful command (future conflict detection). */
  revision: number
  /** Last store revision acknowledged by persistence (Phase 4.5). */
  lastSyncedRevision: number
  lastCommandError: CommandError | null
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]

  hydrate: (document: MinimalProgramDocument, options?: { mode?: HydrateMode }) => HydrateResult
  tryApplyCommand: (command: MinimalCommand) => CommandResult
  applyCommand: (command: MinimalCommand) => CommandResult
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
  clearCommandError: () => void

  /** Subscribe to successful command applications (persistence layer). */
  subscribeToCommands: (listener: CommandAppliedListener) => () => void

  /** Apply server id remap after persistence ack (Phase 4). */
  applyServerIdRemap: (remap: Record<string, string>) => void

  /** Record persistence ack for sync UI (Phase 4.5). */
  markSyncedRevision: (revision: number) => void

  /** Server-managed program meta (cover image, publish flags). Does not mark the editor dirty. */
  patchProgramMeta: (patch: Partial<ProgramMetaNode>) => void

  /** Clear client state when leaving the editor route (e.g. preview). */
  resetEditor: () => void
}

function requireDocument(document: MinimalProgramDocument | null): MinimalProgramDocument {
  if (!document) {
    throw new DomainError('store.not_hydrated', 'Program document store is not hydrated')
  }
  return document
}

export const useProgramDocumentStore = create<ProgramDocumentStoreState>((set, get) => ({
  document: null,
  isDirty: false,
  hydrationEpoch: 0,
  revision: 0,
  lastSyncedRevision: 0,
  lastCommandError: null,
  undoStack: [],
  redoStack: [],
  subscribeToCommands: (listener) => {
    commandListeners.add(listener)
    return () => commandListeners.delete(listener)
  },

  hydrate: (document, options) => {
    const mode = options?.mode ?? 'initial'
    const state = get()

    if (!canApplyHydrate({ document: state.document, isDirty: state.isDirty }, mode)) {
      return { applied: false, reason: 'dirty-document' }
    }

    try {
      assertValidMinimalDocument(document)
    } catch {
      return { applied: false, reason: 'invalid-document' }
    }

    programEditorTempIdRegistry.clear()
    set({
      document,
      isDirty: false,
      hydrationEpoch: state.hydrationEpoch + 1,
      revision: 0,
      lastSyncedRevision: 0,
      lastCommandError: null,
      undoStack: [],
      redoStack: [],
    })
    return { applied: true }
  },

  tryApplyCommand: (command) => {
    try {
      const current = requireDocument(get().document)
      const currentRevision = get().revision
      const next = applyMinimalCommand(current, command)
      const nextRevision = currentRevision + 1
      set({
        document: next,
        isDirty: true,
        revision: nextRevision,
        lastCommandError: null,
        undoStack: pushUndoEntry(get().undoStack, {
          document: cloneDocumentSnapshot(current),
          revision: currentRevision,
        }),
        redoStack: [],
      })
      for (const l of commandListeners) {
        try {
          l({ command, prev: current, next, revision: nextRevision })
        } catch {
          // Listener errors must never break editing
        }
      }
      return { ok: true }
    } catch (err) {
      if (err instanceof DomainError && err.code === 'store.not_hydrated') {
        throw err
      }
      const error = normalizeCommandError(err)
      set({ lastCommandError: error })
      return { ok: false, error }
    }
  },

  applyCommand: (command) => get().tryApplyCommand(command),

  undo: () => {
    const state = get()
    const entry = state.undoStack[state.undoStack.length - 1]
    if (!entry || !state.document) return false

    try {
      assertValidMinimalDocument(entry.document)
    } catch {
      return false
    }

    const redoStack = pushUndoEntry(state.redoStack, {
      document: cloneDocumentSnapshot(state.document),
      revision: state.revision,
    })

    set({
      document: cloneDocumentSnapshot(entry.document),
      revision: entry.revision,
      isDirty:
        entry.revision !== state.lastSyncedRevision || state.lastSyncedRevision > entry.revision,
      undoStack: state.undoStack.slice(0, -1),
      redoStack,
      lastCommandError: null,
    })
    truncatePersistenceAfterRevision(entry.revision)
    return true
  },

  redo: () => {
    const state = get()
    const entry = state.redoStack[state.redoStack.length - 1]
    if (!entry || !state.document) return false

    try {
      assertValidMinimalDocument(entry.document)
    } catch {
      return false
    }

    const undoStack = pushUndoEntry(state.undoStack, {
      document: cloneDocumentSnapshot(state.document),
      revision: state.revision,
    })

    set({
      document: cloneDocumentSnapshot(entry.document),
      revision: entry.revision,
      isDirty: entry.revision > state.lastSyncedRevision,
      undoStack,
      redoStack: state.redoStack.slice(0, -1),
      lastCommandError: null,
    })
    truncatePersistenceAfterRevision(entry.revision)
    return true
  },

  canUndo: () => get().undoStack.length > 0,

  canRedo: () => get().redoStack.length > 0,

  clearCommandError: () => set({ lastCommandError: null }),

  applyServerIdRemap: (remap) => {
    const current = get().document
    if (!current) return
    programEditorTempIdRegistry.applyRemap(remap)
    const next = remapMinimalDocumentIds(current, remap)
    set({ document: next })
    useProgramEditorUiStore.getState().remapUiStateIds(remap)
  },

  markSyncedRevision: (revision: number) => {
    const state = get()
    const lastSyncedRevision = Math.max(state.lastSyncedRevision, revision)
    set({
      lastSyncedRevision,
      isDirty: state.revision > lastSyncedRevision,
    })
  },

  patchProgramMeta: (patch) => {
    set((state) => {
      if (!state.document) return state
      return {
        document: {
          ...state.document,
          program: { ...state.document.program, ...patch },
        },
      }
    })
  },

  resetEditor: () => {
    programEditorTempIdRegistry.clear()
    set({
      document: null,
      isDirty: false,
      hydrationEpoch: 0,
      revision: 0,
      lastSyncedRevision: 0,
      lastCommandError: null,
      undoStack: [],
      redoStack: [],
    })
  },
}))

/** Imperative read for handlers that must not subscribe to the full document. */
export function getProgramDocument(): MinimalProgramDocument | null {
  return useProgramDocumentStore.getState().document
}

const commandListeners = new Set<CommandAppliedListener>()
