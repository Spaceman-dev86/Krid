import type { MinimalProgramDocument } from './minimalDocument'
import { assertValidMinimalDocument } from './validators'

export function createDevFixtureDocument(): MinimalProgramDocument {
  const doc: MinimalProgramDocument = {
    programId: 'prog-dev',
    program: {
      title: 'Remise en forme — Maison',
      description: 'Programme progressif pour reprendre l’entraînement à domicile.',
      goal: 'Retrouver endurance et force fonctionnelle',
      level: 'Intermédiaire',
      duration: '8 semaines',
      isPublished: false,
      imageUrl: null,
    },
    weeks: [
      {
        id: 'week-1',
        title: 'Semaine 1 — Remise en forme',
        notes: 'Focus mobilité et cardio léger.',
        sessionIds: ['session-1', 'session-2'],
      },
      {
        id: 'week-2',
        title: 'Semaine 2 — Renforcement',
        notes: null,
        sessionIds: ['session-3'],
      },
    ],
    entities: {
      sessions: {
        'session-1': {
          id: 'session-1',
          weekId: 'week-1',
          title: 'Full body A',
          description: 'Échauffement 8 min puis enchaînement principal.',
          timelineItemIds: ['item-block-1', 'item-exercise-1'],
        },
        'session-2': {
          id: 'session-2',
          weekId: 'week-1',
          title: 'Cardio & core',
          description: null,
          timelineItemIds: ['item-exercise-2'],
        },
        'session-3': {
          id: 'session-3',
          weekId: 'week-2',
          title: 'Force bas du corps',
          description: 'Squats et fentes — progresser sur les charges.',
          timelineItemIds: ['item-block-2'],
        },
      },
      timelineItems: {
        'item-block-1': {
          id: 'item-block-1',
          sessionId: 'session-1',
          kind: 'block',
          programExerciseId: null,
          sessionBlockId: 'block-1',
        },
        'item-exercise-1': {
          id: 'item-exercise-1',
          sessionId: 'session-1',
          kind: 'exercise',
          programExerciseId: 'pe-squat',
          sessionBlockId: null,
        },
        'item-exercise-2': {
          id: 'item-exercise-2',
          sessionId: 'session-2',
          kind: 'exercise',
          programExerciseId: 'pe-row',
          sessionBlockId: null,
        },
        'item-block-2': {
          id: 'item-block-2',
          sessionId: 'session-3',
          kind: 'block',
          programExerciseId: null,
          sessionBlockId: 'block-2',
        },
      },
      sessionBlocks: {
        'block-1': {
          id: 'block-1',
          sessionId: 'session-1',
          blockKind: 'crossfit',
          title: 'CrossFit',
          notes: '3 tours · repos 90 s entre les tours.',
          blockExerciseIds: ['be-1', 'be-2', 'be-3'],
        },
        'block-2': {
          id: 'block-2',
          sessionId: 'session-3',
          blockKind: 'superset',
          title: 'Superset jambes',
          notes: null,
          blockExerciseIds: ['be-4', 'be-5'],
        },
      },
      blockExercises: {
        'be-1': { id: 'be-1', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Burpees', notes: '10 reps' },
        'be-2': { id: 'be-2', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Row', notes: '250 m' },
        'be-3': { id: 'be-3', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Air squat', notes: '15 reps' },
        'be-4': { id: 'be-4', blockId: 'block-2', libraryExerciseId: null, exerciseName: 'Goblet squat', notes: '4×12' },
        'be-5': { id: 'be-5', blockId: 'block-2', libraryExerciseId: null, exerciseName: 'Fentes marchées', notes: '3×10 / jambe' },
      },
      programExercises: {
        'pe-squat': {
          id: 'pe-squat',
          libraryExerciseId: 'lib-squat',
          sets: 4,
          reps: 10,
          restTime: '01:30',
          rpe: 8,
          tempo: null,
          load: '40kg',
          notes: null,
          subtitle: null,
        },
        'pe-row': {
          id: 'pe-row',
          libraryExerciseId: 'lib-row',
          sets: 3,
          reps: 12,
          restTime: '01:00',
          rpe: null,
          tempo: '3010',
          load: null,
          notes: null,
          subtitle: 'Focus scapula',
        },
      },
    },
  }

  assertValidMinimalDocument(doc)
  return doc
}
