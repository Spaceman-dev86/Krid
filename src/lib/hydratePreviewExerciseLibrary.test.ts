import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildExerciseLibraryLookups,
  hydrateBlockExerciseLibrary,
  hydrateProgramExerciseLibrary,
  normalizeExerciseNameKey,
  resolveExerciseLibrarySlice,
} from './hydratePreviewExerciseLibrary'

const catalog = buildExerciseLibraryLookups([
  { id: 'lib-squat', name: 'Squat', demo_media_path: 'squat.gif' },
  { id: 'lib-leg-curl', name: 'Leg curl', demo_media_path: 'leg_curl.gif' },
])

describe('normalizeExerciseNameKey', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeExerciseNameKey('  Leg Curl '), 'leg curl')
  })
})

describe('resolveExerciseLibrarySlice', () => {
  it('resolves media by exercise_id', () => {
    const slice = resolveExerciseLibrarySlice(catalog, 'lib-squat', null, null)
    assert.deepEqual(slice, { name: 'Squat', demo_media_path: 'squat.gif' })
  })

  it('resolves media by exercise_name when id is null', () => {
    const slice = resolveExerciseLibrarySlice(catalog, null, 'Leg curl', null)
    assert.deepEqual(slice, { name: 'Leg curl', demo_media_path: 'leg_curl.gif' })
  })

  it('returns null demo when no match', () => {
    const slice = resolveExerciseLibrarySlice(catalog, null, 'Unknown move', null)
    assert.deepEqual(slice, { name: 'Unknown move', demo_media_path: null })
  })

  it('prefers join demo_media_path when present', () => {
    const slice = resolveExerciseLibrarySlice(catalog, null, 'Leg curl', {
      name: 'Leg curl',
      demo_media_path: 'from_join.gif',
    })
    assert.equal(slice?.demo_media_path, 'from_join.gif')
  })
})

describe('hydrateBlockExerciseLibrary', () => {
  it('hydrates block row without join', () => {
    const row = hydrateBlockExerciseLibrary(
      {
        id: 'be-1',
        exercise_id: null,
        exercise_name: 'Squat',
        exercise_library: null,
      },
      catalog
    )
    assert.equal(row.exercise_library?.demo_media_path, 'squat.gif')
  })
})

describe('hydrateProgramExerciseLibrary', () => {
  it('hydrates program exercise by id', () => {
    const row = hydrateProgramExerciseLibrary(
      {
        id: 'pe-1',
        exercise_id: 'lib-leg-curl',
        name: null,
        exercise_library: null,
      },
      catalog
    )
    assert.equal(row.exercise_library?.name, 'Leg curl')
    assert.equal(row.exercise_library?.demo_media_path, 'leg_curl.gif')
  })
})
