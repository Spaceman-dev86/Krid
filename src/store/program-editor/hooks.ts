'use client'

import { useShallow } from 'zustand/react/shallow'

import type {
  BlockExerciseNode,
  ProgramExerciseNode,
  ProgramMetaNode,
  SessionBlockNode,
  SessionNode,
  TimelineItemNode,
  WeekNode,
} from '../../domain/program-editor'
import type { CommandError, CommandResult } from './commandResult'
import { useProgramDocumentStore } from './documentStore'

export function useHydrated(): boolean {
  return useProgramDocumentStore((s) => s.document !== null)
}

export function useApplyCommand() {
  return useProgramDocumentStore((s) => s.applyCommand)
}

export function useTryApplyCommand() {
  return useProgramDocumentStore((s) => s.tryApplyCommand)
}

export function useCommandError(): CommandError | null {
  return useProgramDocumentStore((s) => s.lastCommandError)
}

export function useClearCommandError() {
  return useProgramDocumentStore((s) => s.clearCommandError)
}

export function useUndo() {
  return useProgramDocumentStore((s) => s.undo)
}

export function useRedo() {
  return useProgramDocumentStore((s) => s.redo)
}

export function useCanUndo(): boolean {
  return useProgramDocumentStore((s) => s.undoStack.length > 0)
}

export function useCanRedo(): boolean {
  return useProgramDocumentStore((s) => s.redoStack.length > 0)
}

export function useDocumentIsDirty(): boolean {
  return useProgramDocumentStore((s) => s.isDirty)
}

export function useHydrationEpoch(): number {
  return useProgramDocumentStore((s) => s.hydrationEpoch)
}

export function useWeeks(): WeekNode[] {
  return useProgramDocumentStore(useShallow((s) => s.document?.weeks ?? []))
}

export function useProgramMeta(): ProgramMetaNode | null {
  return useProgramDocumentStore((s) => s.document?.program ?? null)
}

export function useSession(sessionId: string): SessionNode | null {
  return useProgramDocumentStore((s) => s.document?.entities.sessions[sessionId] ?? null)
}

export function useTimelineItemIds(sessionId: string): string[] {
  return useProgramDocumentStore(
    useShallow((s) => s.document?.entities.sessions[sessionId]?.timelineItemIds ?? [])
  )
}

export function useTimelineItem(itemId: string): TimelineItemNode | null {
  return useProgramDocumentStore((s) => s.document?.entities.timelineItems[itemId] ?? null)
}

export function useSessionBlock(blockId: string): SessionBlockNode | null {
  return useProgramDocumentStore((s) => s.document?.entities.sessionBlocks[blockId] ?? null)
}

export function useBlockExercise(blockExerciseId: string): BlockExerciseNode | null {
  return useProgramDocumentStore((s) => s.document?.entities.blockExercises[blockExerciseId] ?? null)
}

export function useBlockExerciseIds(blockId: string): string[] {
  return useProgramDocumentStore(
    useShallow((s) => s.document?.entities.sessionBlocks[blockId]?.blockExerciseIds ?? [])
  )
}

export function useProgramExercise(programExerciseId: string): ProgramExerciseNode | null {
  return useProgramDocumentStore(
    (s) => s.document?.entities.programExercises[programExerciseId] ?? null
  )
}

export type { CommandError, CommandResult }
