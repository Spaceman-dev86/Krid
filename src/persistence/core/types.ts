import type { MinimalCommand } from '../../domain/program-editor'
import type { DuplicateContext } from '../buildDuplicateContext'

export type PersistenceStatus = 'pending' | 'synced' | 'error'

export type PersistedCommandEnvelope = {
  /** Program id. */
  programId: string
  /** Store revision at time of enqueue (monotonic client counter). */
  clientRevision: number
  /** The applied command. */
  command: MinimalCommand
  /** Timestamp when command was enqueued. */
  at: number
  /** Snapshot for compound duplicate commands (session/week/block). */
  duplicateContext?: DuplicateContext | null
}

export type PersistBatchResult = {
  ok: true
  /** Client tmp-* → server UUID mapping. */
  idRemap?: Record<string, string>
} | {
  ok: false
  error: { code: string; message: string }
}

export type PersistenceAdapter = {
  persistBatch: (batch: PersistedCommandEnvelope[]) => Promise<PersistBatchResult>
}

