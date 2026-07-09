import type { MinimalCommand } from '../../domain/program-editor'
import type { DuplicateContext } from '../buildDuplicateContext'
import type { PersistBatchResult, PersistedCommandEnvelope, PersistenceAdapter } from '../core/types'

type Payload = {
  programId: string
  clientRevision: number
  commands: MinimalCommand[]
  duplicateContexts?: (DuplicateContext | null)[]
}

type ResponseBody =
  | { ok: true; idRemap?: Record<string, string> }
  | { ok: false; error: { code: string; message: string } }

export function createNextApiAdapter(): PersistenceAdapter {
  return {
    async persistBatch(batch: PersistedCommandEnvelope[]): Promise<PersistBatchResult> {
      if (batch.length === 0) return { ok: true }
      const programId = batch[0].programId
      const clientRevision = batch[batch.length - 1].clientRevision
      const commands = batch.map((b) => b.command)

      const payload: Payload = {
        programId,
        clientRevision,
        commands,
        duplicateContexts: batch.map((b) => b.duplicateContext ?? null),
      }
      const res = await fetch(`/api/programs/${encodeURIComponent(programId)}/editor-v2/commands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const raw = await res.text()
      let json: ResponseBody
      try {
        json = JSON.parse(raw) as ResponseBody
      } catch {
        const snippet = raw.trim().slice(0, 80)
        return {
          ok: false,
          error: {
            code: 'persistence.invalid_response',
            message:
              res.status === 404
                ? 'Route API introuvable (404). Rechargez la page après mise à jour.'
                : `Réponse serveur invalide (HTTP ${res.status})${snippet ? `: ${snippet}` : ''}`,
          },
        }
      }

      if (!res.ok || !json.ok) {
        return {
          ok: false,
          error: json.ok ? { code: 'persistence.http', message: `HTTP ${res.status}` } : json.error,
        }
      }
      return { ok: true, idRemap: json.idRemap }
    },
  }
}

