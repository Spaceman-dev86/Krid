import {
  restSecondsFromPrescriptions,
  restPrescriptionsPayload,
  type SessionPrescription,
} from '@/src/lib/sessions/constants'

export type CompositionSlotInput = {
  kind: 'block' | 'exercise' | 'rest'
  blockId?: string
  exerciseId?: string
  restSeconds?: number
  prescriptions: SessionPrescription[]
}

/** Même contrat FormData que SessionFicheEditor (`item_*`). */
export function parseSessionCompositionFormData(formData: FormData): CompositionSlotInput[] {
  const kinds = formData.getAll('item_kind').map((v) => String(v ?? '').trim())
  const blockIds = formData.getAll('item_block_id').map((v) => String(v ?? '').trim())
  const exerciseIds = formData.getAll('item_exercise_id').map((v) => String(v ?? '').trim())
  const rawRx = formData.getAll('item_prescriptions').map((v) => String(v ?? '').trim())
  const len = Math.max(kinds.length, blockIds.length, exerciseIds.length)
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
      if (!blockId) continue
      out.push({ kind, blockId, prescriptions: [] })
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
