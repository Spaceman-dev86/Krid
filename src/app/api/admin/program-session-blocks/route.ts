import { NextResponse } from 'next/server'

import { requireProgramSessionEditor } from '@/src/lib/auth/requireProgramSessionEditor'
import {
  createProgramOwnedBlock,
  type ProgramBlockWriteInput,
} from '@/src/lib/sessions/programSessionBlock'
import type { ExercisePrescription } from '@/src/lib/blocks/constants'

export const dynamic = 'force-dynamic'

type Body = {
  program_session_id?: string
  name?: string
  notes?: string | null
  timer_note?: string | null
  sport_id?: string | null
  expected_result_label?: string | null
  expected_result_unit_id?: string | null
  exercise_ids?: string[]
  exercise_prescriptions?: unknown[]
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const programSessionId = String(body.program_session_id ?? '').trim()
  if (!programSessionId) {
    return NextResponse.json({ error: 'program_session_id requis' }, { status: 400 })
  }

  const auth = await requireProgramSessionEditor({ programSessionId })
  if ('error' in auth && auth.error) return auth.error

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
  }

  const result = await createProgramOwnedBlock(auth.supabase!, {
    programSessionId,
    input,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ block: result.detail })
}
