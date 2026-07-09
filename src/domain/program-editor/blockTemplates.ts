import type { BlockKind } from './minimalCommands'
import { libraryExerciseIdByName } from './devExerciseLibrary'

export type BlockTemplate = {
  notes: string
  libraryExerciseNames: string[]
}

export const BLOCK_TEMPLATES: Record<BlockKind, BlockTemplate> = {
  warmup: {
    notes: 'enchaine les exercices suivent pendant 10min',
    libraryExerciseNames: ['Assault bike', 'Rameur'],
  },
  superset: {
    notes: 'enchaine les 2 exercices sans pause puis prends 1min',
    libraryExerciseNames: ['Curl biceps haltères', 'Extension triceps'],
  },
  crossfit: {
    notes: '4 tours For Time',
    libraryExerciseNames: ['Burpees box jump', 'DB snatch', 'ski_erg'],
  },
  neutral: {
    notes: '',
    libraryExerciseNames: [],
  },
}

export function resolveBlockTemplateLibraryIds(kind: BlockKind): string[] {
  const template = BLOCK_TEMPLATES[kind]
  return template.libraryExerciseNames
    .map((name) => libraryExerciseIdByName(name))
    .filter((id): id is string => Boolean(id))
}
