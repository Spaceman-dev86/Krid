import type { PersistenceQueue } from './core/PersistenceQueue'

let activeQueue: PersistenceQueue | null = null

export function setActivePersistenceQueue(queue: PersistenceQueue | null): void {
  activeQueue = queue
}

export function truncatePersistenceAfterRevision(maxRevision: number): void {
  activeQueue?.truncateAfterRevision(maxRevision)
}
