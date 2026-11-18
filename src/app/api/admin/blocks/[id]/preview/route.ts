import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import {
  formatBlockTimerSummary,
  formatFilledPrescriptionLines,
  loadSessionBlockDetail,
} from '@/src/lib/sessions/blockDetail'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const [{ detail, error }, unitsRes] = await Promise.all([
    loadSessionBlockDetail(supabase, id),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])

  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!detail) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })

  const unitById = new Map(
    ((unitsRes.data ?? []) as {
      id: string
      key: string
      label: string
      short_label: string | null
    }[]).map((u) => [u.id, u]),
  )

  let sportLabel: string | null = null
  if (detail.sport_id) {
    const { data: sport } = await supabase
      .from('sports' as never)
      .select('label')
      .eq('id' as never, detail.sport_id as never)
      .maybeSingle()
    sportLabel = (sport as { label?: string } | null)?.label?.trim() || null
  }

  return NextResponse.json({
    preview: {
      id: detail.id,
      name: detail.name,
      status: detail.status,
      notes: detail.notes,
      timerSummary: formatBlockTimerSummary(detail.timer_note),
      expectedResultLabel: detail.expected_result_label,
      sportLabel,
      exercises: detail.exercises.map((ex) => ({
        id: ex.exercise_id,
        name: ex.name,
        rxLines: formatFilledPrescriptionLines(
          (ex.prescriptions ?? []).filter(
            (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
          ),
          unitById,
        ),
      })),
    },
  })
}
