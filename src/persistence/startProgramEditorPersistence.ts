import { useProgramDocumentStore } from '../store/program-editor/documentStore'

import { useProgramEditorPersistenceStore } from '../store/program-editor/persistenceStore'

import { createNextApiAdapter } from './adapters/nextApiAdapter'

import { buildDuplicateContext } from './buildDuplicateContext'

import { PersistenceQueue } from './core/PersistenceQueue'
import { setActivePersistenceQueue } from './activeQueueRef'

import type { PersistedCommandEnvelope } from './core/types'

let activeQueue: PersistenceQueue | null = null
let unsubscribeCommands: (() => void) | null = null
let unsubscribeQueueUi: (() => void) | null = null
let removeWindowListeners: (() => void) | null = null

export function retryProgramEditorPersistence(): void {
  useProgramEditorPersistenceStore.getState().clearError()
  activeQueue?.retryNow()
}

export function hasPendingProgramEditorPersistence(): boolean {
  const queuePending = (activeQueue?.getState().pendingCount ?? 0) > 0
  const queueWorking = activeQueue?.getState().status === 'working'
  const { revision, lastSyncedRevision } = useProgramDocumentStore.getState()
  return queuePending || queueWorking || revision > lastSyncedRevision
}

/** Flush pending commands before navigation or publish. */
export async function flushProgramEditorPersistence(): Promise<void> {
  if (!activeQueue) return
  await activeQueue.flushNow()
}

/** Tear down persistence wiring (command subscription, queue, window listeners). */
export function stopProgramEditorPersistence(): void {
  unsubscribeCommands?.()
  unsubscribeCommands = null

  unsubscribeQueueUi?.()
  unsubscribeQueueUi = null

  removeWindowListeners?.()
  removeWindowListeners = null

  activeQueue?.dispose()
  activeQueue = null
  setActivePersistenceQueue(null)

  useProgramEditorPersistenceStore.getState().setFromQueue({
    working: false,
    pendingCount: 0,
    lastError: undefined,
  })
}

/**
 * Starts Phase 4 persistence wiring for the editor.
 * - Subscribes to successful command applications.
 * - Enqueues command envelopes to a debounced queue.
 * - Applies server id remaps back into the local document (no refresh).
 */
export function startProgramEditorPersistence({ programId }: { programId: string }) {
  stopProgramEditorPersistence()

  const adapter = createNextApiAdapter()
  const queue = new PersistenceQueue(adapter, { debounceMs: 700, maxBatchSize: 1 })

  activeQueue = queue
  setActivePersistenceQueue(queue)

  const syncQueueToUi = () => {
    const state = queue.getState()
    useProgramEditorPersistenceStore.getState().setFromQueue({
      working: state.status === 'working',
      pendingCount: state.pendingCount,
      lastError: state.lastError,
    })
  }

  unsubscribeQueueUi = queue.subscribe(syncQueueToUi)

  if (typeof window !== 'undefined') {
    const onOnline = () => {
      useProgramEditorPersistenceStore.getState().setOnline(true)
      queue.retryNow()
    }
    const onOffline = () => useProgramEditorPersistenceStore.getState().setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    useProgramEditorPersistenceStore.getState().setOnline(navigator.onLine)

    removeWindowListeners = () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }

  const originalPersistBatch = adapter.persistBatch.bind(adapter)

  adapter.persistBatch = async (batch) => {
    const res = await originalPersistBatch(batch)
    if (res.ok) {
      if (res.idRemap && Object.keys(res.idRemap).length > 0) {
        queue.applyIdRemapToPending(res.idRemap)
        useProgramDocumentStore.getState().applyServerIdRemap(res.idRemap)
      }

      const lastRevision = batch[batch.length - 1]?.clientRevision
      if (lastRevision != null) {
        useProgramDocumentStore.getState().markSyncedRevision(lastRevision)
      }
    }
    return res
  }

  unsubscribeCommands = useProgramDocumentStore.getState().subscribeToCommands((event) => {
    const env: PersistedCommandEnvelope = {
      programId,
      clientRevision: event.revision,
      command: event.command,
      at: Date.now(),
      duplicateContext: buildDuplicateContext(event),
    }
    queue.enqueue(env)
  })
}
