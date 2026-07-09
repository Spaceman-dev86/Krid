'use client'

import { createTempId } from '../../../domain/program-editor'
import { BLOCK_TEMPLATES, resolveBlockTemplateLibraryIds } from '../../../domain/program-editor/blockTemplates'
import type { BlockKind } from '../../../domain/program-editor/minimalCommands'
import { useApplyCommand } from '../../../store/program-editor'
import { useProgramEditorUiStore } from '../../../store/program-editor/uiStore'

export function useEditorDndActions() {
  const applyCommand = useApplyCommand()
  const setBlockExpanded = useProgramEditorUiStore((s) => s.setBlockExpanded)
  const setEditingProgramExerciseId = useProgramEditorUiStore((s) => s.setEditingProgramExerciseId)

  function insertBlockAt(sessionId: string, insertIndex: number, blockKind: BlockKind, title?: string) {
    const blockId = createTempId('block')
    const timelineItemId = createTempId('item')
    const template = BLOCK_TEMPLATES[blockKind]
    const libraryIds = resolveBlockTemplateLibraryIds(blockKind)

    applyCommand({
      type: 'timeline.block.add',
      sessionId,
      timelineItemId,
      blockId,
      blockKind,
      title,
      notes: template.notes.trim() || null,
      insertIndex,
      initialBlockExercises: libraryIds.map((libraryExerciseId) => ({
        blockExerciseId: createTempId('be'),
        libraryExerciseId,
      })),
    })
    setBlockExpanded(blockId, true)
  }

  function insertExerciseAt(sessionId: string, insertIndex: number, libraryExerciseId: string) {
    const programExerciseId = createTempId('pe')
    applyCommand({
      type: 'timeline.exercise.add',
      sessionId,
      timelineItemId: createTempId('item'),
      programExerciseId,
      libraryExerciseId,
      insertIndex,
    })
    setEditingProgramExerciseId(programExerciseId)
  }

  function addExerciseToBlock(blockId: string, libraryExerciseId: string, exerciseName?: string) {
    applyCommand({
      type: 'blockExercise.add',
      blockId,
      blockExerciseId: createTempId('be'),
      libraryExerciseId,
      exerciseName: exerciseName ?? null,
    })
    setBlockExpanded(blockId, true)
  }

  return { insertBlockAt, insertExerciseAt, addExerciseToBlock }
}
