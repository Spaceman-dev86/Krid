import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
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
  /** Si true / 'published' → crée déjà publié (séance publiée). */
  status?: 'draft' | 'published' | string
  exercise_ids?: string[]
  exercise_prescriptions?: unknown[]
  hidden_type_ids?: string[]
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  if (!isPlatformAdmin(profile?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

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
  const status = body.status === 'published' ? 'published' : 'draft'
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
    if (exerciseIds.some((id) => !ok.has(id))) {
      return NextResponse.json({ error: 'Exercices publiés uniquement' }, { status: 400 })
    }
  }

  const { data: created, error } = await supabase
    .from('block_library' as never)
    .insert({
      coach_id: null,
      name,
      notes,
      timer_note: timerNote,
      sport_id: sportId,
      format_id: null,
      expected_result_unit_id: expectedResultUnitId,
      free_constraints: [],
      status,
      allow_duplicate: body.allow_duplicate !== false,
      allow_download: false,
    } as never)
    .select('id, name, status, sport_id')
    .maybeSingle()

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? 'Création impossible' },
      { status: 400 },
    )
  }

  const block = created as {
    id: string
    name: string
    status: string
    sport_id: string | null
  }

  if (exerciseIds.length) {
    const rows = exerciseIds.map((exercise_id, position) => ({
      block_id: block.id,
      exercise_id,
      position,
      prescriptions: Array.isArray(prescriptions[position]) ? prescriptions[position] : [],
    }))
    const { error: linkErr } = await supabase
      .from('block_library_exercises' as never)
      .insert(rows as never)
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 400 })
    }
  }

  if (hiddenTypeIds.length) {
    const { error: hideErr } = await supabase.from('block_library_hidden_types' as never).insert(
      hiddenTypeIds.map((exercise_type_id) => ({
        block_id: block.id,
        exercise_type_id,
      })) as never,
    )
    if (hideErr) {
      return NextResponse.json({ error: hideErr.message }, { status: 400 })
    }
  }

  const { detail, error: detailErr } = await loadSessionBlockDetail(supabase, block.id)
  if (detailErr || !detail) {
    return NextResponse.json({
      block: {
        id: block.id,
        name: block.name,
        status: block.status || 'draft',
        sport_id: block.sport_id,
        sport_label: null as string | null,
        notes: notes,
        timer_note: timerNote,
        expected_result_unit_id: expectedResultUnitId,
        expected_result_label: null,
        allow_duplicate: body.allow_duplicate !== false,
        exercise_ids: exerciseIds,
        exercise_prescriptions: prescriptions,
        hidden_type_ids: hiddenTypeIds,
        exercises: [],
      },
    })
  }
  return NextResponse.json({ block: detail })
}
