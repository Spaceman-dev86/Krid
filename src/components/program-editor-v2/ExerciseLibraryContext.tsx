'use client'

import { createContext, useContext, type ReactNode } from 'react'

import { registerExerciseLibraryCatalog } from '../../domain/program-editor/devExerciseLibrary'
import type { ExerciseLibraryCatalog, ExerciseLibraryEntry } from '../../lib/fetchExerciseLibrary'

const ExerciseLibraryContext = createContext<ExerciseLibraryCatalog | null>(null)

export function ExerciseLibraryProvider({
  catalog,
  children,
}: {
  catalog: ExerciseLibraryCatalog
  children: ReactNode
}) {
  registerExerciseLibraryCatalog(catalog.exercises)

  return <ExerciseLibraryContext.Provider value={catalog}>{children}</ExerciseLibraryContext.Provider>
}

export function useExerciseLibraryCatalog(): ExerciseLibraryCatalog {
  const ctx = useContext(ExerciseLibraryContext)
  if (!ctx) {
    return { exercises: [], muscleGroups: [] }
  }
  return ctx
}

export function useExerciseLibraryEntries(): ExerciseLibraryEntry[] {
  return useExerciseLibraryCatalog().exercises
}

export function useExerciseLibraryMuscleGroups(): string[] {
  return useExerciseLibraryCatalog().muscleGroups
}
