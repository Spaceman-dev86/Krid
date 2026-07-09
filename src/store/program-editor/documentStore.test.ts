import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'

import { assertValidMinimalDocument, DomainError, type MinimalProgramDocument } from '../../domain/program-editor'
import { useProgramDocumentStore } from './documentStore'
import { selectBlockExercises, selectSessions, selectTimelineBySession } from './selectors'

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
          blockExerciseIds: ['be-1'],
        },
      },
      blockExercises: {
        'be-1': { id: 'be-1', blockId: 'block-1', libraryExerciseId: null, exerciseName: 'Burpees', notes: '10' },
      },
      programExercises: {
        'pe-1': {
          id: 'pe-1',
          libraryExerciseId: null,
          sets: null,
          reps: null,
          restTime: null,
          rpe: null,
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

beforeEach(() => {
  useProgramDocumentStore.setState({
    document: null,
    isDirty: false,
    hydrationEpoch: 0,
    revision: 0,
    lastSyncedRevision: 0,
    lastCommandError: null,
    undoStack: [],
    redoStack: [],
  })
})

describe('useProgramDocumentStore', () => {
  it('starts without a document', () => {
    assert.equal(useProgramDocumentStore.getState().document, null)
  })

  it('hydrates a valid document', () => {
    const fixture = buildFixtureDoc()
    const result = useProgramDocumentStore.getState().hydrate(fixture)
    assert.equal(result.applied, true)
    assert.deepEqual(useProgramDocumentStore.getState().document, fixture)
    assert.equal(useProgramDocumentStore.getState().isDirty, false)
  })

  it('rejects applyCommand when not hydrated', () => {
    assert.throws(
      () =>
        useProgramDocumentStore.getState().applyCommand({
          type: 'session.add',
          weekId: 'week-1',
          sessionId: 'session-2',
        }),
      (err: unknown) => err instanceof DomainError && err.code === 'store.not_hydrated'
    )
  })

  it('applyCommand updates document via domain kernel', () => {
    useProgramDocumentStore.getState().hydrate(buildFixtureDoc())
    const result = useProgramDocumentStore.getState().applyCommand({
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: '20' },
    })

    assert.equal(result.ok, true)
    const doc = useProgramDocumentStore.getState().document
    assert.ok(doc)
    assert.equal(doc.entities.blockExercises['be-1'].notes, '20')
    assert.equal(useProgramDocumentStore.getState().isDirty, true)
    assertValidMinimalDocument(doc)
  })

  it('replaces document on force-replace hydrate', () => {
    useProgramDocumentStore.getState().hydrate(buildFixtureDoc())
    useProgramDocumentStore.getState().applyCommand({
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: '20' },
    })
    const replacement = buildFixtureDoc()
    replacement.programId = 'prog-2'
    const result = useProgramDocumentStore.getState().hydrate(replacement, { mode: 'force-replace' })
    assert.equal(result.applied, true)
    assert.equal(useProgramDocumentStore.getState().document?.programId, 'prog-2')
    assert.equal(useProgramDocumentStore.getState().isDirty, false)
  })

  it('rejects hydrate when local document is dirty', () => {
    const fixture = buildFixtureDoc()
    useProgramDocumentStore.getState().hydrate(fixture)
    useProgramDocumentStore.getState().applyCommand({
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: '20' },
    })
    const replacement = buildFixtureDoc()
    replacement.programId = 'prog-2'
    const result = useProgramDocumentStore.getState().hydrate(replacement, { mode: 'initial' })
    assert.equal(result.applied, false)
    if (!result.applied) assert.equal(result.reason, 'dirty-document')
    assert.equal(useProgramDocumentStore.getState().document?.programId, 'prog-1')
  })

  it('stores command errors without throwing', () => {
    useProgramDocumentStore.getState().hydrate(buildFixtureDoc())
    const result = useProgramDocumentStore.getState().tryApplyCommand({
      type: 'week.delete',
      weekId: 'missing-week',
    })
    assert.equal(result.ok, false)
    if (!result.ok) assert.ok(result.error.code)
    assert.ok(useProgramDocumentStore.getState().lastCommandError)
  })

  it('undo restores the previous document state', () => {
    useProgramDocumentStore.getState().hydrate(buildFixtureDoc())
    useProgramDocumentStore.getState().applyCommand({
      type: 'blockExercise.update',
      blockExerciseId: 'be-1',
      patch: { notes: '20' },
    })
    assert.equal(useProgramDocumentStore.getState().document?.entities.blockExercises['be-1'].notes, '20')
    assert.equal(useProgramDocumentStore.getState().canUndo(), true)

    const undone = useProgramDocumentStore.getState().undo()
    assert.equal(undone, true)
    assert.equal(useProgramDocumentStore.getState().document?.entities.blockExercises['be-1'].notes, '10')
    assert.equal(useProgramDocumentStore.getState().canRedo(), true)

    const redone = useProgramDocumentStore.getState().redo()
    assert.equal(redone, true)
    assert.equal(useProgramDocumentStore.getState().document?.entities.blockExercises['be-1'].notes, '20')
  })
})

describe('selectors', () => {
  it('selectSessions returns sessions in week order', () => {
    const doc = buildFixtureDoc()
    doc.weeks[0].sessionIds.push('session-2')
    doc.entities.sessions['session-2'] = {
      id: 'session-2',
      weekId: 'week-1',
      title: 'Séance B',
      description: null,
      timelineItemIds: [],
    }

    const sessions = selectSessions(doc)
    assert.equal(sessions.length, 2)
    assert.equal(sessions[0].id, 'session-1')
    assert.equal(sessions[1].id, 'session-2')
  })

  it('selectTimelineBySession preserves timeline order', () => {
    const doc = buildFixtureDoc()
    const items = selectTimelineBySession(doc, 'session-1')
    assert.deepEqual(
      items.map((i) => i.id),
      ['item-block-1', 'item-exercise-1']
    )
  })

  it('selectTimelineBySession returns empty for unknown session', () => {
    const doc = buildFixtureDoc()
    assert.deepEqual(selectTimelineBySession(doc, 'missing'), [])
  })

  it('selectBlockExercises returns all block exercises', () => {
    const doc = buildFixtureDoc()
    const exercises = selectBlockExercises(doc)
    assert.equal(exercises.length, 1)
    assert.equal(exercises[0].id, 'be-1')
  })
})

describe('store + selectors integration', () => {
  it('reflects timeline reorder in selectors', () => {
    useProgramDocumentStore.getState().hydrate(buildFixtureDoc())
    useProgramDocumentStore.getState().applyCommand({
      type: 'timeline.reorder',
      sessionId: 'session-1',
      timelineItemIds: ['item-exercise-1', 'item-block-1'],
    })

    const doc = useProgramDocumentStore.getState().document
    assert.ok(doc)
    const items = selectTimelineBySession(doc, 'session-1')
    assert.deepEqual(
      items.map((i) => i.id),
      ['item-exercise-1', 'item-block-1']
    )
  })
})
