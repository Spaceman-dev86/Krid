import { describe, expect, it } from 'vitest'

import { buildPreviewExerciseMetaLine } from './previewExerciseMeta'

describe('buildPreviewExerciseMetaLine', () => {
  it('formats standalone program exercise fields', () => {
    expect(
      buildPreviewExerciseMetaLine({
        sets: 4,
        reps: 8,
        restTime: '1',
        tempo: '3010',
        load: '45',
      })
    ).toBe('4 séries · 8 reps · repos 1 min · tempo 3010 · charge 45 Kg')
  })

  it('formats block exercise fields', () => {
    expect(
      buildPreviewExerciseMetaLine({
        sets: '3',
        reps: '12',
        restSeconds: 60,
        loadText: '20',
      })
    ).toBe('3 séries · 12 reps · repos 1 min · charge 20 Kg')
  })
})
