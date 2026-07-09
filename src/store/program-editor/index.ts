export {
  getProgramDocument,
  useProgramDocumentStore,
  type ProgramDocumentStoreState,
} from './documentStore'

export {
  selectBlockExercises,
  selectBlockExercisesForBlock,
  selectSessions,
  selectTimelineBySession,
} from './selectors'

export {
  useApplyCommand,
  useBlockExercise,
  useBlockExerciseIds,
  useCanRedo,
  useCanUndo,
  useClearCommandError,
  useCommandError,
  useDocumentIsDirty,
  useHydrated,
  useHydrationEpoch,
  useProgramExercise,
  useProgramMeta,
  useRedo,
  useSession,
  useSessionBlock,
  useTimelineItem,
  useTimelineItemIds,
  useTryApplyCommand,
  useUndo,
  useWeeks,
  type CommandError,
  type CommandResult,
} from './hooks'

export { canApplyHydrate, type HydrateMode, type HydrateResult } from './hydrationContract'

export {
  useIsBlockExpanded,
  useIsSessionOpen,
  useIsWeekOpen,
  useProgramEditorUiStore,
  useSelectedTimelineItemId,
} from './uiStore'
