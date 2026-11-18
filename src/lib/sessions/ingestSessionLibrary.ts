import { restSecondsFromPrescriptions, type SessionPrescription } from '@/src/lib/sessions/constants'
import type { CompositionSlotInput } from '@/src/lib/sessions/parseSessionCompositionForm'
import { writeProgramSessionComposition } from '@/src/lib/sessions/writeProgramSessionComposition'
import type { createClient } from '@/src/lib/supabase/server'

type AdminSupabase = Awaited<ReturnType<typeof createClient>>

/**
 * Deep-copy figée : session_library_items → même materializer que save composition
 * (source_block_library_id, prescriptions jsonb, rest first-class).
 */
export async function ingestSessionLibraryComposition(
  supabase: AdminSupabase,
  args: { librarySessionId: string; programSessionId: string },
): Promise<
  | { ok: true; slots: CompositionSlotInput[]; version?: number }
  | { ok: false; error: string }
> {
  const { librarySessionId, programSessionId } = args

  const { data: itemsRaw } = await supabase
    .from('session_library_items' as never)
    .select('id, item_kind, block_id, exercise_id, prescriptions, position')
    .eq('session_id' as never, librarySessionId as never)
    .order('position' as never, { ascending: true })

  const items = (itemsRaw ?? []) as {
    id: string
    item_kind: string
    block_id: string | null
    exercise_id: string | null
    prescriptions: unknown
    position: number
  }[]

  if (!items.length) return { ok: true, slots: [], version: 0 }

  const slots: CompositionSlotInput[] = []
  for (const item of items) {
    if (item.item_kind === 'rest') {
      slots.push({
        kind: 'rest',
        restSeconds: restSecondsFromPrescriptions(item.prescriptions),
        prescriptions: [],
      })
      continue
    }
    if (item.item_kind === 'exercise' && item.exercise_id) {
      const prescriptions = Array.isArray(item.prescriptions)
        ? (item.prescriptions as SessionPrescription[]).filter((p) => p && p.unit_id)
        : []
      slots.push({
        kind: 'exercise',
        exerciseId: item.exercise_id,
        prescriptions,
      })
      continue
    }
    if (item.item_kind === 'block' && item.block_id) {
      slots.push({
        kind: 'block',
        blockId: item.block_id,
        prescriptions: [],
      })
    }
  }

  const result = await writeProgramSessionComposition(supabase, programSessionId, slots)
  if (!result.ok) return { ok: false, error: result.error }

  // Provenance pour compteur « Utilisé » séances (copie programme — safe).
  await supabase
    .from('sessions' as never)
    .update({ source_session_library_id: librarySessionId } as never)
    .eq('id' as never, programSessionId as never)

  return { ok: true, slots, version: result.version }
}
