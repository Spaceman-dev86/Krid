import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'

import type { MinimalProgramDocument } from '../domain/program-editor'
import { useProgramDocumentStore } from '../store/program-editor/documentStore'
import { startProgramEditorPersistence, stopProgramEditorPersistence } from './startProgramEditorPersistence'

function buildMinimalDoc(): MinimalProgramDocument {
  return {
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
    weeks: [],
    entities: {
      sessions: {},
      timelineItems: {},
      sessionBlocks: {},
      blockExercises: {},
      programExercises: {},
    },
  }
}

describe('startProgramEditorPersistence', () => {
  beforeEach(() => {
    stopProgramEditorPersistence()
    useProgramDocumentStore.getState().resetEditor()
    useProgramDocumentStore.getState().hydrate(buildMinimalDoc(), { mode: 'initial' })
  })

  afterEach(() => {
    stopProgramEditorPersistence()
    useProgramDocumentStore.getState().resetEditor()
  })

  it('only persists commands for the active program after switching editors', async () => {
    const seenProgramIds: string[] = []

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { programId: string }
      seenProgramIds.push(body.programId)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }

    try {
      startProgramEditorPersistence({ programId: 'program-a' })
      startProgramEditorPersistence({ programId: 'program-b' })

      useProgramDocumentStore.getState().applyCommand({
        type: 'program.update',
        patch: { title: 'Titre B' },
      })

      await new Promise((resolve) => setTimeout(resolve, 900))
      assert.deepEqual(seenProgramIds, ['program-b'])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
