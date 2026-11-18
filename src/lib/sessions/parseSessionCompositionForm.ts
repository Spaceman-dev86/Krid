import {
  restSecondsFromPrescriptions,
  restPrescriptionsPayload,
  type SessionPrescription,
} from '@/src/lib/sessions/constants'

export type CompositionSlotInput = {
  kind: 'block' | 'exercise' | 'rest'
  blockId?: string
  orphanSessionBlockId?: string
  exerciseId?: string
  restSeconds?: number
  prescriptions: SessionPrescription[]
}

/** Convertit les slots React → contrat write (évite FormData DOM périmé). */
export function compositionSlotsFromSessionSlots(
  slots: Array<{
    kind: 'block' | 'exercise' | 'rest'
    blockId?: string
    orphanSessionBlockId?: string
    exerciseId?: string
    restSeconds?: number
    prescriptions?: SessionPrescription[]
  }>,
): CompositionSlotInput[] {
  const out: CompositionSlotInput[] = []
  for (const s of slots) {
    if (s.kind === 'block') {
      if (!s.blockId && !s.orphanSessionBlockId) continue
      out.push({
        kind: 'block',
        blockId: s.blockId,
        orphanSessionBlockId: s.orphanSessionBlockId,
        prescriptions: [],
      })
      continue
    }
    if (s.kind === 'rest') {
      out.push({
        kind: 'rest',
        restSeconds: s.restSeconds ?? 60,
        prescriptions: [],
      })
      continue
    }
    if (!s.exerciseId) continue
    out.push({
      kind: 'exercise',
      exerciseId: s.exerciseId,
      prescriptions: (s.prescriptions ?? []).filter((p) => p && p.unit_id),
    })
  }
  return out
}

/** Même contrat FormData que SessionFicheEditor (`item_*`). Préfère `slots_json` si présent. */
export function parseSessionCompositionFormData(formData: FormData): CompositionSlotInput[] {
  const rawJson = String(formData.get('slots_json') ?? '').trim()
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as unknown
      if (Array.isArray(parsed)) {
        return compositionSlotsFromSessionSlots(
          parsed as Parameters<typeof compositionSlotsFromSessionSlots>[0],
        )
      }
    } catch {
      // fallback hidden fields
    }
  }

  const kinds = formData.getAll('item_kind').map((v) => String(v ?? '').trim())
  const blockIds = formData.getAll('item_block_id').map((v) => String(v ?? '').trim())
  const orphanIds = formData.getAll('item_orphan_session_block_id').map((v) => String(v ?? '').trim())
  const exerciseIds = formData.getAll('item_exercise_id').map((v) => String(v ?? '').trim())
  const rawRx = formData.getAll('item_prescriptions').map((v) => String(v ?? '').trim())
  const len = Math.max(kinds.length, blockIds.length, exerciseIds.length, orphanIds.length)
  const out: CompositionSlotInput[] = []
  for (let i = 0; i < len; i++) {
    const kindRaw = kinds[i]
    const kind =
      kindRaw === 'block' || kindRaw === 'exercise' || kindRaw === 'rest' ? kindRaw : null
    if (!kind) continue
    let prescriptions: SessionPrescription[] = []
    let parsedRaw: unknown = []
    try {
      parsedRaw = JSON.parse(rawRx[i] || '[]')
      if (Array.isArray(parsedRaw)) {
        prescriptions = (parsedRaw as SessionPrescription[]).filter((p) => p && p.unit_id)
      }
    } catch {
      prescriptions = []
      parsedRaw = []
    }
    if (kind === 'block') {
      const blockId = blockIds[i]
      const orphanSessionBlockId = orphanIds[i] || undefined
      if (!blockId && !orphanSessionBlockId) continue
      out.push({
        kind,
        blockId: blockId || undefined,
        orphanSessionBlockId,
        prescriptions: [],
      })
    } else if (kind === 'rest') {
      out.push({
        kind: 'rest',
        restSeconds: restSecondsFromPrescriptions(parsedRaw),
        prescriptions: [],
      })
    } else {
      const exerciseId = exerciseIds[i]
      if (!exerciseId) continue
      out.push({ kind, exerciseId, prescriptions })
    }
  }
  return out
}

export function restPrescriptionsJson(seconds: number): unknown {
  return restPrescriptionsPayload(seconds)
}
