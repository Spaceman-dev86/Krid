import { NextResponse } from 'next/server'

import { requireProgramSessionEditor } from '@/src/lib/auth/requireProgramSessionEditor'
import type { ExercisePrescription } from '@/src/lib/blocks/constants'
import {
  loadProgramSessionBlockDetail,
  updateProgramOwnedBlock,
  type ProgramBlockWriteInput,
} from '@/src/lib/sessions/programSessionBlock'

export const dynamic = 'force-dynamic'

type Body = {
  name?: string
  notes?: string | null
  timer_note?: string | null
  sport_id?: string | null
  expected_result_label?: string | null
  expected_result_unit_id?: string | null
  exercise_ids?: string[]
  exercise_prescriptions?: unknown[]
  source_block_library_id?: string | null
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const auth = await requireProgramSessionEditor({ sessionBlockId: id })
  if ('error' in auth && auth.error) return auth.error

  const { detail, error } = await loadProgramSessionBlockDetail(auth.supabase!, id)
  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!detail) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ block: detail })
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const auth = await requireProgramSessionEditor({ sessionBlockId: id })
  if ('error' in auth && auth.error) return auth.error

  const body = (await req.json().catch(() => ({}))) as Body

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const exerciseIds = Array.isArray(body.exercise_ids)
    ? body.exercise_ids.map((x) => String(x).trim()).filter(Boolean)
    : []
  if (!exerciseIds.length) {
    return NextResponse.json({ error: 'Au moins 1 exercice requis' }, { status: 400 })
  }

  const input: ProgramBlockWriteInput = {
    name,
    notes: String(body.notes ?? '').trim() || null,
    timer_note: String(body.timer_note ?? '').trim() || null,
    sport_id: String(body.sport_id ?? '').trim() || null,
    expected_result_unit_id: String(body.expected_result_unit_id ?? '').trim() || null,
    expected_result_label: String(body.expected_result_label ?? '').trim() || null,
    exercise_ids: exerciseIds,
    exercise_prescriptions: (Array.isArray(body.exercise_prescriptions)
      ? body.exercise_prescriptions
      : []) as ExercisePrescription[][],
    ...(body.source_block_library_id !== undefined
      ? { source_block_library_id: body.source_block_library_id }
      : {}),
  }

  const result = await updateProgramOwnedBlock(auth.supabase!, {
    sessionBlockId: id,
    input,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ block: result.detail })
}
