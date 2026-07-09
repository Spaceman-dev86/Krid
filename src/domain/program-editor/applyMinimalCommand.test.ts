import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { applyMinimalCommand } from './applyMinimalCommand'
import {
  clearExerciseLibraryCatalog,
  registerExerciseLibraryCatalog,
  resolveBlockExerciseDisplayName,
  resolveBlockExerciseLabel,
} from './devExerciseLibrary'
import { DomainError } from './errors'
import type { MinimalProgramDocument } from './minimalDocument'
import { assertValidMinimalDocument, validateMinimalDocument } from './validators'

function buildFixtureDoc(): MinimalProgramDocument {
  const doc: MinimalProgramDocument = {
    programId: 'prog-1',
    program: {
      title: 'Programme test',
      description: null,
      goal: null,
      level: null,
      duration: null,
      isPublished: false,
      imageUrl: null,
    },
    weeks: [{ id: 'week-1', title: 'Semaine 1', notes: null, sessionIds: ['session-1'] }],
    entities: {
      sessions: {
        'session-1': {
          id: 'session-1',
          weekId: 'week-1',
          title: 'Séance A',
          description: null,
          timelineItemIds: ['item-block-1', 'item-exercise-1'],
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
          programExerciseId: 'pe-1',
          sessionBlockId: null,
        },
      },
      sessionBlocks: {
        'block-1': {
          id: 'block-1',
          sessionId: 'session-1',
          blockKind: 'crossfit',
          title: 'Crossfit',
          notes: null,
          blockExerciseIds: ['be-1', 'be-2'],
        },
      },
      blockExercises: {
        'be-1': { id: 'be-1', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Burpees', notes: '10 reps' },
        'be-2': { id: 'be-2', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Row', notes: null },
      },
      programExercises: {
        'pe-1': {
          id: 'pe-1',
          libraryExerciseId: 'lib-squat',
          sets: 3,
          reps: 10,
          restTime: '01:00',
          rpe: 7,
          tempo: null,
          load: null,
          notes: null,
          subtitle: null,
        },
      },
    },
  }
  assertValidMinimalDocument(doc)
  return doc
}

describe('validateMinimalDocument', () => {
  it('accepts a well-formed fixture', () => {
    const issues = validateMinimalDocument(buildFixtureDoc())
    assert.equal(issues.length, 0)
  })

  it('detects orphan session', () => {
    const doc = buildFixtureDoc()
    doc.weeks[0].sessionIds = []
    const issues = validateMinimalDocument(doc)
    assert.ok(issues.some((i) => i.code === 'session.orphan'))
  })

  it('detects timeline reorder mismatch via orphan timeline item', () => {
    const doc = buildFixtureDoc()
    doc.entities.sessions['session-1'].timelineItemIds = ['item-block-1']
    const issues = validateMinimalDocument(doc)
    assert.ok(issues.some((i) => i.code === 'timeline_item.orphan'))
  })
})

describe('session.add', () => {
  it('adds an empty session to a week', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'session.add',
      weekId: 'week-1',
      sessionId: 'session-2',
      title: 'Séance B',
    })

    assert.equal(next.weeks[0].sessionIds.length, 2)
    assert.equal(next.weeks[0].sessionIds[1], 'session-2')
    assert.deepEqual(next.entities.sessions['session-2'], {
      id: 'session-2',
      weekId: 'week-1',
      title: 'Séance B',
      description: null,
      timelineItemIds: [],
    })
  })

  it('rejects duplicate session id', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () =>
        applyMinimalCommand(doc, {
          type: 'session.add',
          weekId: 'week-1',
          sessionId: 'session-1',
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'session.already_exists'
    )
  })

  it('rejects unknown week', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () =>
        applyMinimalCommand(doc, {
          type: 'session.add',
          weekId: 'week-missing',
          sessionId: 'session-x',
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'week.not_found'
    )
  })
})

describe('session.delete', () => {
  it('removes session and cascades timeline, blocks, and block exercises', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, { type: 'session.delete', sessionId: 'session-1' })

    assert.equal(next.weeks[0].sessionIds.length, 0)
    assert.equal(next.entities.sessions['session-1'], undefined)
    assert.equal(next.entities.timelineItems['item-block-1'], undefined)
    assert.equal(next.entities.timelineItems['item-exercise-1'], undefined)
    assert.equal(next.entities.sessionBlocks['block-1'], undefined)
    assert.equal(next.entities.blockExercises['be-1'], undefined)
    assert.equal(next.entities.blockExercises['be-2'], undefined)
    assertValidMinimalDocument(next)
  })

  it('rejects deleting unknown session', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () => applyMinimalCommand(doc, { type: 'session.delete', sessionId: 'nope' }),
      (err: unknown) => err instanceof DomainError && err.code === 'session.not_found'
    )
  })
})

describe('timeline.reorder', () => {
  it('reorders timeline items for a session', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'timeline.reorder',
      sessionId: 'session-1',
      timelineItemIds: ['item-exercise-1', 'item-block-1'],
    })

    assert.deepEqual(next.entities.sessions['session-1'].timelineItemIds, ['item-exercise-1', 'item-block-1'])
  })

  it('rejects permutation mismatch', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () =>
        applyMinimalCommand(doc, {
          type: 'timeline.reorder',
          sessionId: 'session-1',
          timelineItemIds: ['item-block-1'],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'timeline.reorder_mismatch'
    )
  })

  it('rejects duplicate ids in reorder payload', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () =>
        applyMinimalCommand(doc, {
          type: 'timeline.reorder',
          sessionId: 'session-1',
          timelineItemIds: ['item-block-1', 'item-block-1'],
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'timeline.duplicate_ids'
    )
  })

  it('is idempotent when applying the same order again', () => {
    const doc = buildFixtureDoc()
    const once = applyMinimalCommand(doc, {
      type: 'timeline.reorder',
      sessionId: 'session-1',
      timelineItemIds: ['item-exercise-1', 'item-block-1'],
    })
    const twice = applyMinimalCommand(once, {
      type: 'timeline.reorder',
      sessionId: 'session-1',
      timelineItemIds: ['item-exercise-1', 'item-block-1'],
    })
    assert.deepEqual(twice.entities.sessions['session-1'].timelineItemIds, ['item-exercise-1', 'item-block-1'])
  })
})

describe('program.update', () => {
  it('updates program meta fields', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'program.update',
      patch: {
        title: 'Nouveau titre',
        description: 'Desc',
        goal: 'Force',
        level: 'Confirmé',
        duration: '12 semaines',
      },
    })
    assert.equal(next.program.title, 'Nouveau titre')
    assert.equal(next.program.description, 'Desc')
    assert.equal(next.program.goal, 'Force')
    assert.equal(next.program.level, 'Confirmé')
    assert.equal(next.program.duration, '12 semaines')
  })
})

describe('session.duplicate', () => {
  it('duplicates session with timeline, blocks, and block exercises', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'session.duplicate',
      sourceSessionId: 'session-1',
      newSessionId: 'session-copy',
    })

    const copy = next.entities.sessions['session-copy']
    assert.ok(copy)
    assert.equal(copy.title, 'Séance A (copie)')
    assert.equal(copy.timelineItemIds.length, 2)
    assert.equal(next.entities.timelineItems[copy.timelineItemIds[0]].sessionId, 'session-copy')

    const blockItem = copy.timelineItemIds
      .map((id) => next.entities.timelineItems[id])
      .find((it) => it.kind === 'block')
    assert.ok(blockItem?.sessionBlockId)
    const block = next.entities.sessionBlocks[blockItem.sessionBlockId]
    assert.equal(block.sessionId, 'session-copy')
    assert.equal(block.blockExerciseIds.length, 2)
    assert.equal(next.weeks[0].sessionIds.includes('session-copy'), true)
    assertValidMinimalDocument(next)
  })
})

describe('week.duplicate', () => {
  it('duplicates week with all sessions and content', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'week.duplicate',
      sourceWeekId: 'week-1',
      newWeekId: 'week-copy',
    })

    assert.equal(next.weeks.length, 2)
    assert.equal(next.weeks[1].id, 'week-copy')
    assert.equal(next.weeks[1].title, 'Semaine 1 (copie)')
    assert.equal(next.weeks[1].sessionIds.length, 1)
    const sessionCopy = next.entities.sessions[next.weeks[1].sessionIds[0]]
    assert.equal(sessionCopy.title, 'Séance A')
    assert.equal(sessionCopy.timelineItemIds.length, 2)
    assertValidMinimalDocument(next)
  })
})

describe('week.reorder', () => {
  it('reorders weeks in the document', () => {
    let doc = buildFixtureDoc()
    doc = applyMinimalCommand(doc, {
      type: 'week.add',
      weekId: 'week-2',
      title: 'Semaine 2',
    })
    doc = applyMinimalCommand(doc, {
      type: 'week.reorder',
      weekIds: ['week-2', 'week-1'],
    })
    assert.deepEqual(
      doc.weeks.map((w) => w.id),
      ['week-2', 'week-1']
    )
  })
})

describe('week.sessions.reorder', () => {
  it('reorders sessions within a week', () => {
    let doc = buildFixtureDoc()
    doc = applyMinimalCommand(doc, {
      type: 'session.add',
      weekId: 'week-1',
      sessionId: 'session-2',
      title: 'Séance B',
    })
    doc = applyMinimalCommand(doc, {
      type: 'week.sessions.reorder',
      weekId: 'week-1',
      sessionIds: ['session-2', 'session-1'],
    })
    assert.deepEqual(doc.weeks[0].sessionIds, ['session-2', 'session-1'])
  })
})

describe('week.delete', () => {
  it('removes week and cascades all sessions', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, { type: 'week.delete', weekId: 'week-1' })
    assert.equal(next.weeks.length, 0)
    assert.equal(next.entities.sessions['session-1'], undefined)
    assertValidMinimalDocument(next)
  })
})

describe('blockExercise.reorder', () => {
  it('reorders exercises within a block', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'blockExercise.reorder',
      blockId: 'block-1',
      blockExerciseIds: ['be-2', 'be-1'],
    })
    assert.deepEqual(next.entities.sessionBlocks['block-1'].blockExerciseIds, ['be-2', 'be-1'])
  })
})

describe('week.update', () => {
  it('updates week title and notes', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'week.update',
      weekId: 'week-1',
      patch: { title: 'Semaine modifiée', notes: 'Note test' },
    })
    assert.equal(next.weeks[0].title, 'Semaine modifiée')
    assert.equal(next.weeks[0].notes, 'Note test')
  })
})

describe('session.update', () => {
  it('updates session title and description', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'session.update',
      sessionId: 'session-1',
      patch: { title: 'Séance modifiée', description: 'Desc' },
    })
    assert.equal(next.entities.sessions['session-1'].title, 'Séance modifiée')
    assert.equal(next.entities.sessions['session-1'].description, 'Desc')
  })
})

describe('block.update', () => {
  it('updates block title and notes', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'block.update',
      blockId: 'block-1',
      patch: { title: 'Bloc modifié', notes: 'Repos 60s' },
    })
    assert.equal(next.entities.sessionBlocks['block-1'].title, 'Bloc modifié')
    assert.equal(next.entities.sessionBlocks['block-1'].notes, 'Repos 60s')
  })
})

describe('blockExercise.update', () => {
  it('updates block exercise notes', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: '15 reps' },
    })

    assert.equal(next.entities.blockExercises['be-1'].notes, '15 reps')
    assert.equal(next.entities.blockExercises['be-1'].exerciseName, 'Burpees')
  })

  it('clears notes with null', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: null },
    })
    assert.equal(next.entities.blockExercises['be-1'].notes, null)
  })

  it('rejects unknown block exercise', () => {
    const doc = buildFixtureDoc()
    assert.throws(
      () =>
        applyMinimalCommand(doc, {
          type: 'blockExercise.update',
          blockExerciseId: 'be-missing',
          patch: { notes: 'x' },
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'block_exercise.not_found'
    )
  })
})

describe('blockExercise.add', () => {
  it('uses explicit exerciseName when catalog is empty', () => {
    clearExerciseLibraryCatalog()
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'blockExercise.add',
      blockId: 'block-1',
      blockExerciseId: 'be-new',
      libraryExerciseId: 'lib-unknown',
      exerciseName: 'Squat',
    })
    assert.equal(next.entities.blockExercises['be-new'].exerciseName, 'Squat')
    assert.equal(next.entities.blockExercises['be-new'].libraryExerciseId, 'lib-unknown')
    assert.deepEqual(next.entities.sessionBlocks['block-1'].blockExerciseIds, [
      'be-1',
      'be-2',
      'be-new',
    ])
  })

  it('resolves name from registered catalog when exerciseName is omitted', () => {
    registerExerciseLibraryCatalog([{ id: 'lib-squat', name: 'Squat' }])
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'blockExercise.add',
      blockId: 'block-1',
      blockExerciseId: 'be-new',
      libraryExerciseId: 'lib-squat',
    })
    assert.equal(next.entities.blockExercises['be-new'].exerciseName, 'Squat')
    assert.equal(next.entities.blockExercises['be-new'].libraryExerciseId, 'lib-squat')
  })
})

describe('resolveBlockExerciseLabel', () => {
  it('prefers library name over generic Exercice fallback', () => {
    registerExerciseLibraryCatalog([{ id: 'lib-squat', name: 'Squat' }])
    assert.equal(
      resolveBlockExerciseLabel({
        exerciseName: 'Exercice',
        libraryExerciseId: 'lib-squat',
      }),
      'Squat'
    )
  })
})

describe('resolveBlockExerciseDisplayName', () => {
  it('prefers React catalog over generic Exercice when global catalog is empty', () => {
    clearExerciseLibraryCatalog()
    assert.equal(
      resolveBlockExerciseDisplayName(
        { exerciseName: 'Exercice', libraryExerciseId: 'uuid-pullups' },
        [{ id: 'uuid-pullups', name: 'Tractions' }]
      ),
      'Tractions'
    )
  })

  it('keeps custom exerciseName when not the generic fallback', () => {
    assert.equal(
      resolveBlockExerciseDisplayName(
        { exerciseName: 'Mon exercice custom', libraryExerciseId: 'uuid-pullups' },
        [{ id: 'uuid-pullups', name: 'Tractions' }]
      ),
      'Mon exercice custom'
    )
  })
})

describe('week.add', () => {
  it('appends a new week', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, { type: 'week.add', weekId: 'week-2', title: 'Semaine 2' })
    assert.equal(next.weeks.length, 2)
    assert.equal(next.weeks[1].id, 'week-2')
    assert.equal(next.weeks[1].title, 'Semaine 2')
    assert.deepEqual(next.weeks[1].sessionIds, [])
    assertValidMinimalDocument(next)
  })
})

describe('timeline.item.delete', () => {
  it('removes exercise timeline item and program exercise', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, { type: 'timeline.item.delete', timelineItemId: 'item-exercise-1' })
    assert.equal(next.entities.timelineItems['item-exercise-1'], undefined)
    assert.equal(next.entities.programExercises['pe-1'], undefined)
    assert.equal(next.entities.sessions['session-1'].timelineItemIds.includes('item-exercise-1'), false)
    assertValidMinimalDocument(next)
  })
})

describe('programExercise.update', () => {
  it('updates exercise prescription fields', () => {
    const doc = buildFixtureDoc()
    const next = applyMinimalCommand(doc, {
      type: 'programExercise.update',
      programExerciseId: 'pe-1',
      patch: { sets: 4, reps: 8, restTime: '02:00', rpe: 9 },
    })
    assert.equal(next.entities.programExercises['pe-1'].sets, 4)
    assert.equal(next.entities.programExercises['pe-1'].reps, 8)
    assert.equal(next.entities.programExercises['pe-1'].restTime, '02:00')
    assert.equal(next.entities.programExercises['pe-1'].rpe, 9)
  })
})

describe('command sequences', () => {
  it('supports add session then delete without leaving orphans', () => {
    let doc = buildFixtureDoc()
    doc = applyMinimalCommand(doc, {
      type: 'session.add',
      weekId: 'week-1',
      sessionId: 'session-tmp',
    })
    doc = applyMinimalCommand(doc, { type: 'session.delete', sessionId: 'session-tmp' })
    assertValidMinimalDocument(doc)
    assert.equal(doc.entities.sessions['session-tmp'], undefined)
  })
})
