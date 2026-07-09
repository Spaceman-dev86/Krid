'use client'

import { useMemo } from 'react'

import type { BlockExerciseNode } from '../../domain/program-editor'
import { resolveBlockExerciseDisplayName } from '../../domain/program-editor/devExerciseLibrary'
import { useExerciseLibraryCatalog } from './ExerciseLibraryContext'

export function useBlockExerciseDisplayName(row: BlockExerciseNode | null): string {
  const { exercises } = useExerciseLibraryCatalog()
  return useMemo(
    () => resolveBlockExerciseDisplayName(row, exercises),
    [row, exercises]
  )
}

export default useBlockExerciseDisplayName
