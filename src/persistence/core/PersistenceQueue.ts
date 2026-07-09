import { remapMinimalCommandIds } from '../../domain/program-editor'

import type { PersistBatchResult, PersistedCommandEnvelope, PersistenceAdapter } from './types'

export type QueueState = {
  status: 'idle' | 'working' | 'error'
  lastError?: { code: string; message: string }
  pendingCount: number
}

type Options = {
  debounceMs: number
  maxBatchSize: number
}

/**
 * Framework-agnostic persistence queue.
 * - Enqueue fast, never blocks UI.
 * - Debounced flush with batch coalescing.
 * - Retry-ready: keeps queue on failure; caller may call `retryNow()`.
 */
export class PersistenceQueue {
  private readonly adapter: PersistenceAdapter
  private readonly opts: Options
  private readonly queue: PersistedCommandEnvelope[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private working = false
  private lastError: QueueState['lastError'] | undefined
  private readonly listeners = new Set<(state: QueueState) => void>()

  constructor(adapter: PersistenceAdapter, opts?: Partial<Options>) {
    this.adapter = adapter
    this.opts = {
      debounceMs: opts?.debounceMs ?? 650,
      maxBatchSize: opts?.maxBatchSize ?? 50,
    }
  }

  subscribe(listener: (state: QueueState) => void): () => void {
    this.listeners.add(listener)
    listener(this.getState())
    return () => this.listeners.delete(listener)
  }

  getState(): QueueState {
    return {
      status: this.working ? 'working' : this.lastError ? 'error' : 'idle',
      lastError: this.lastError,
      pendingCount: this.queue.length,
    }
  }

  enqueue(envelope: PersistedCommandEnvelope): void {
    this.queue.push(envelope)
    this.emit()
    this.scheduleFlush()
  }

  retryNow(): void {
    this.lastError = undefined
    this.emit()
    void this.flush()
  }

  flushSoon(): void {
    this.scheduleFlush()
  }

  private flushAgain = false

  /** Flush pending commands immediately (debounce bypass). */
  async flushNow(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
    if (this.flushAgain) {
      this.flushAgain = false
      await this.flush()
    }
  }

  /** Cancel pending flush and drop queued commands (editor teardown / program switch). */
  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.queue.length = 0
    this.working = false
    this.lastError = undefined
    this.emit()
  }

  /** Replace temp client ids in queued commands after a batch syncs to the server. */
  applyIdRemapToPending(remap: Record<string, string>): void {
    if (Object.keys(remap).length === 0 || this.queue.length === 0) return
    for (let i = 0; i < this.queue.length; i += 1) {
      const env = this.queue[i]
      this.queue[i] = {
        ...env,
        command: remapMinimalCommandIds(env.command, remap),
      }
    }
  }

  /** Retire les commandes en attente au-delà d'une révision (undo). */
  truncateAfterRevision(maxRevision: number): void {
    if (maxRevision < 0) return
    const next = this.queue.filter((env) => env.clientRevision <= maxRevision)
    if (next.length === this.queue.length) return
    this.queue.length = 0
    this.queue.push(...next)
    this.emit()
  }

  private emit() {
    const state = this.getState()
    for (const l of this.listeners) l(state)
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, this.opts.debounceMs)
  }

  private async flush(): Promise<void> {
    if (this.working) {
      this.flushAgain = true
      return
    }
    if (this.queue.length === 0) return
    this.working = true
    this.emit()

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, this.opts.maxBatchSize)
        const res = await this.adapter.persistBatch(batch)
        if (!res.ok) {
          this.lastError = res.error
          this.emit()
          return
        }
        // success: drop batch and continue
        this.queue.splice(0, batch.length)
        this.emit()
      }
      this.lastError = undefined
    } catch (err) {
      this.lastError = { code: 'persistence.network', message: err instanceof Error ? err.message : 'Erreur réseau.' }
    } finally {
      this.working = false
      this.emit()
    }
  }
}

