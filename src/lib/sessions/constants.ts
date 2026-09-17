/** Unités Rx par défaut sur un exo dans une séance (ordre UI).
 * Source unique : `src/lib/catalog/rxPresets.ts`
 * Comportement UI : `src/lib/catalog/prescriptionUi.ts`
 */
export {
  SESSION_EXERCISE_RX_KEYS,
  SESSION_EXERCISE_RX_SHORT,
  type SessionExerciseRxKey,
} from '@/src/lib/catalog/rxPresets'

export type SessionItemKind = 'block' | 'exercise' | 'rest'

export type SessionPrescription = {
  unit_id: string
  value: string
  input_mode?: 'number' | 'time' | 'text' | null
  varies?: boolean
  /** Groupe de séries (0 = premier). Consignes indépendantes par plage. */
  group?: number
}

export type SessionSlot = {
  key: string
  kind: SessionItemKind
  blockId?: string
  exerciseId?: string
  /** Durée de repos (secondes) — uniquement si kind === 'rest'. */
  restSeconds?: number
  prescriptions: SessionPrescription[]
}

export const DEFAULT_SESSION_REST_SECONDS = 60

/** Encode / décode la durée stockée dans `prescriptions` pour un item rest. */
export function restSecondsFromPrescriptions(raw: unknown): number {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_SESSION_REST_SECONDS
  const first = raw[0] as { rest_seconds?: unknown }
  const n = Number(first?.rest_seconds)
  if (Number.isFinite(n) && n >= 0) return Math.floor(n)
  return DEFAULT_SESSION_REST_SECONDS
}

export function restPrescriptionsPayload(seconds: number): { rest_seconds: number }[] {
  const n = Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds) : DEFAULT_SESSION_REST_SECONDS
  return [{ rest_seconds: n }]
}

/**
 * Contrat composition séance (catalogue → futur program_builder) :
 * - un seul `rest` entre deux items contenu (block|exercise)
 * - pas de rest en tête / queue
 * - rests adjacents → on garde le premier
 */
export function normalizeSessionCompositionSlots<T extends { kind: SessionItemKind }>(
  slots: T[],
): T[] {
  const out: T[] = []
  for (const slot of slots) {
    if (slot.kind === 'rest') {
      if (!out.length) continue
      if (out[out.length - 1]!.kind === 'rest') continue
      out.push(slot)
      continue
    }
    out.push(slot)
  }
  while (out.length && out[out.length - 1]!.kind === 'rest') out.pop()
  return out
}

export function sessionHasContentItem(slots: { kind: SessionItemKind }[]): boolean {
  return slots.some((s) => s.kind === 'block' || s.kind === 'exercise')
}

/** Regroupe les Rx par index de groupe (ordre croissant). */
export function groupSessionPrescriptions(
  prescriptions: SessionPrescription[],
): Array<{ group: number; rows: SessionPrescription[] }> {
  const map = new Map<number, SessionPrescription[]>()
  for (const p of prescriptions) {
    const g = typeof p.group === 'number' && p.group >= 0 ? p.group : 0
    const list = map.get(g) ?? []
    list.push(p)
    map.set(g, list)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([group, rows]) => ({ group, rows }))
}

export function nextSessionRxGroup(prescriptions: SessionPrescription[]): number {
  let max = -1
  for (const p of prescriptions) {
    const g = typeof p.group === 'number' && p.group >= 0 ? p.group : 0
    if (g > max) max = g
  }
  return max + 1
}
