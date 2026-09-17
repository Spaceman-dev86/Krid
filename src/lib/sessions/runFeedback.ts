/**
 * Feedback fin de séance + résultats fin de bloc (côté run client).
 *
 * Admin configure :
 * - session_library.objective_* → quels champs feedback afficher
 * - block_library.expected_result_unit_id → score demandé en fin de bloc
 *
 * Client remplit sur session_runs :
 * - feedback_ressenti / feedback_note / feedback_difficulty
 * - realized.block_results[] pour chaque bloc avec résultat attendu
 */

export type SessionRunBlockResult = {
  /** Id bloc catalogue ou id bloc programme selon le snapshot. */
  block_id: string
  unit_id: string
  unit_key?: string | null
  value: string
}

export type SessionRunFeedback = {
  ressenti?: string | null
  note?: string | null
  /** 1..5 smileys */
  difficulty?: number | null
}

export function parseBlockResults(realized: unknown): SessionRunBlockResult[] {
  if (!realized || typeof realized !== 'object') return []
  const raw = (realized as { block_results?: unknown }).block_results
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const block_id = String(r.block_id ?? '').trim()
      const unit_id = String(r.unit_id ?? '').trim()
      const value = String(r.value ?? '').trim()
      if (!block_id || !unit_id || !value) return null
      return {
        block_id,
        unit_id,
        unit_key: r.unit_key != null ? String(r.unit_key) : null,
        value,
      } satisfies SessionRunBlockResult
    })
    .filter((x): x is SessionRunBlockResult => Boolean(x))
}
