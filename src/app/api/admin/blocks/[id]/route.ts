import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import type { ExercisePrescription } from '@/src/lib/blocks/constants'
import { loadSessionBlockDetail } from '@/src/lib/sessions/blockDetail'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Body = {
  name?: string
  sport_id?: string | null
  notes?: string | null
  timer_note?: string | null
  expected_result_unit_id?: string | null
  allow_duplicate?: boolean
  exercise_ids?: string[]
  exercise_prescriptions?: unknown[]
  hidden_type_ids?: string[]
}

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!isPlatformAdmin(profile?.role)) {
    return { supabase, error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  }
  return { supabase, error: null as null }
}

type Props = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return authErr

  const { detail, error } = await loadSessionBlockDetail(supabase, id)
  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!detail) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  return NextResponse.json({ block: detail })
}

export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params
  const { supabase, error: authErr } = await requireAdmin()
  if (authErr) return authErr

  const body = (await req.json().catch(() => ({}))) as Body
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const sportId = body.sport_id ? String(body.sport_id).trim() : ''
  if (!sportId) return NextResponse.json({ error: 'Sport requis' }, { status: 400 })

  const notes = String(body.notes ?? '').trim() || null
  const timerNote = String(body.timer_note ?? '').trim() || null
  const expectedResultUnitId = body.expected_result_unit_id
    ? String(body.expected_result_unit_id).trim()
    : null
  if (!expectedResultUnitId) {
    return NextResponse.json({ error: 'Résultat attendu requis' }, { status: 400 })
  }
  const exerciseIds = Array.isArray(body.exercise_ids)
    ? body.exercise_ids.map((x) => String(x).trim()).filter(Boolean)
    : []
  if (!exerciseIds.length) {
    return NextResponse.json({ error: 'Au moins 1 exercice requis' }, { status: 400 })
  }
  const prescriptions = Array.isArray(body.exercise_prescriptions)
    ? body.exercise_prescriptions
    : []
  const hiddenTypeIds = Array.isArray(body.hidden_type_ids)
    ? [...new Set(body.hidden_type_ids.map((x) => String(x).trim()).filter(Boolean))]
    : []

  if (exerciseIds.length) {
    const { data: exos, error: exoErr } = await supabase
      .from('exercise_library')
      .select('id, status, deleted_at')
      .in('id', exerciseIds)
    if (exoErr) return NextResponse.json({ error: exoErr.message }, { status: 400 })
    const ok = new Set(
      ((exos ?? []) as { id: string; status?: string | null; deleted_at?: string | null }[])
        .filter((e) => !e.deleted_at && (!e.status || e.status === 'published'))
        .map((e) => e.id),
    )
    if (exerciseIds.some((eid) => !ok.has(eid))) {
      return NextResponse.json({ error: 'Exercices publiés uniquement' }, { status: 400 })
    }
  }

  const { error: updErr } = await supabase
    .from('block_library' as never)
    .update({
      name,
      notes,
      timer_note: timerNote,
      sport_id: sportId,
      format_id: null,
      expected_result_unit_id: expectedResultUnitId,
      free_constraints: [],
      allow_duplicate: body.allow_duplicate !== false,
      allow_download: false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, id as never)
    .is('coach_id' as never, null)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  const { error: delExoErr } = await supabase
    .from('block_library_exercises' as never)
    .delete()
    .eq('block_id' as never, id as never)
  if (delExoErr) return NextResponse.json({ error: delExoErr.message }, { status: 400 })

  if (exerciseIds.length) {
    const rows = exerciseIds.map((exercise_id, position) => ({
      block_id: id,
      exercise_id,
      position,
      prescriptions: (Array.isArray(prescriptions[position])
        ? prescriptions[position]
        : []) as ExercisePrescription[],
    }))
    const { error: linkErr } = await supabase
      .from('block_library_exercises' as never)
      .insert(rows as never)
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })
  }

  const { error: delHideErr } = await supabase
    .from('block_library_hidden_types' as never)
    .delete()
    .eq('block_id' as never, id as never)
  if (delHideErr) return NextResponse.json({ error: delHideErr.message }, { status: 400 })

  if (hiddenTypeIds.length) {
    const { error: hideErr } = await supabase.from('block_library_hidden_types' as never).insert(
      hiddenTypeIds.map((exercise_type_id) => ({
        block_id: id,
        exercise_type_id,
      })) as never,
    )
    if (hideErr) return NextResponse.json({ error: hideErr.message }, { status: 400 })
  }

  const { detail, error } = await loadSessionBlockDetail(supabase, id)
  if (error || !detail) {
    return NextResponse.json({ error: error || 'Bloc introuvable' }, { status: 400 })
  }
  return NextResponse.json({ block: detail })
}
