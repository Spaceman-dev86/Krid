import type { EntityId } from './minimalDocument'

/** Client-side entity id prefixes used before persistence assigns server ids. */
export type TempIdKind = 'week' | 'session' | 'block' | 'item' | 'pe' | 'be'

const TEMP_ID_PREFIX = 'tmp-'

export function createTempId(kind: TempIdKind): EntityId {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `${TEMP_ID_PREFIX}${kind}-${crypto.randomUUID()}`
      : `${TEMP_ID_PREFIX}${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  programEditorTempIdRegistry.register(id)
  return id
}

export function isTempEntityId(id: string | null | undefined): boolean {
  return Boolean(id && String(id).startsWith(TEMP_ID_PREFIX))
}

/**
 * Maps client tmp ids → persisted server ids after save (Phase 4).
 * Local-only today: register on create, resolve when building outbound payloads.
 */
export class TempIdRegistry {
  private readonly clientToServer = new Map<EntityId, EntityId>()
  private readonly tracked = new Set<EntityId>()

  register(clientId: EntityId, serverId?: EntityId): void {
    if (!isTempEntityId(clientId)) return
    this.tracked.add(clientId)
    if (serverId) this.clientToServer.set(clientId, serverId)
  }

  remap(clientId: EntityId, serverId: EntityId): void {
    this.clientToServer.set(clientId, serverId)
  }

  resolve(id: EntityId): EntityId {
    return this.clientToServer.get(id) ?? id
  }

  hasPending(clientId: EntityId): boolean {
    return isTempEntityId(clientId) && !this.clientToServer.has(clientId)
  }

  pendingClientIds(): EntityId[] {
    return [...this.tracked].filter((id) => this.hasPending(id))
  }

  clear(): void {
    this.clientToServer.clear()
    this.tracked.clear()
  }

  applyRemap(remap: Record<EntityId, EntityId>): void {
    for (const [clientId, serverId] of Object.entries(remap)) {
      if (isTempEntityId(clientId)) {
        this.remap(clientId, serverId)
      }
    }
  }
}

/** Shared registry for the program editor session (cleared on hydrate). */
export const programEditorTempIdRegistry = new TempIdRegistry()
