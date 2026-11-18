import { NextResponse } from 'next/server'

import { canAccessCoachApp } from '@/src/lib/auth/roles'
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
  status?: 'draft' | 'published' | string
  hub_visible?: boolean
  exercise_ids?: string[]
  exercise_prescriptions?: unknown[]
  hidden_type_ids?: string[]
}

type Props = { params: Promise<{ id: string }> }

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, userId: null as string | null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) {
    return { supabase, userId: null, error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  }
  return { supabase, userId: user.id, error: null as null }
}

/** Détail bloc Ma biblio / brouillon coach ou catalogue Krid (published plateforme). */
export async function GET(_req: Request, { params }: Props) {
  const { id } = await params
  const { supabase, userId, error: authErr } = await requireCoach()
  if (authErr || !userId) return authErr!

  const { data: meta, error: metaErr } = await supabase
    .from('block_library' as never)
    .select('id, coach_id, status, deleted_at')
    .eq('id' as never, id as never)
    .maybeSingle()

  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 400 })
  const row = meta as {
    id: string
    coach_id: string | null
    status: string
    deleted_at: string | null
  } | null
  if (!row || row.deleted_at) {
    return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  }
  const isMine = row.coach_id === userId
  const isKridPublished = row.coach_id == null && row.status === 'published'
  if (!isMine && !isKridPublished) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { detail, error } = await loadSessionBlockDetail(supabase, id)
  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!detail) return NextResponse.json({ error: 'Bloc introuvable' }, { status: 404 })
  return NextResponse.json({ block: detail })
}

export async function PATCH(req: Request, { params }: Props) {
  const { id } = await params
  const { supabase, userId, error: authErr } = await requireCoach()
  if (authErr || !userId) return authErr!

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

  const status = body.status === 'published' ? 'published' : body.status === 'draft' ? 'draft' : undefined
  const hubVisible =
    typeof body.hub_visible === 'boolean' ? body.hub_visible : undefined

  const { error: updErr } = await supabase
    .from('block_library' as never)
    .update({
      name,
      notes,
      timer_note: timerNote,
      sport_id: sportId,
      expected_result_unit_id: expectedResultUnitId,
      allow_duplicate: body.allow_duplicate !== false,
      ...(status ? { status } : {}),
      ...(hubVisible !== undefined ? { hub_visible: hubVisible } : {}),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id' as never, id as never)
    .eq('coach_id' as never, userId as never)
    .is('deleted_at' as never, null)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  await supabase.from('block_library_exercises' as never).delete().eq('block_id' as never, id as never)
  const rows = exerciseIds.map((exercise_id, position) => ({
    block_id: id,
    exercise_id,
    position,
    prescriptions: Array.isArray(prescriptions[position]) ? prescriptions[position] : [],
  }))
  const { error: linkErr } = await supabase.from('block_library_exercises' as never).insert(rows as never)
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 400 })

  await supabase.from('block_library_hidden_types' as never).delete().eq('block_id' as never, id as never)
  if (hiddenTypeIds.length) {
    await supabase.from('block_library_hidden_types' as never).insert(
      hiddenTypeIds.map((exercise_type_id) => ({ block_id: id, exercise_type_id })) as never,
    )
  }

  const { detail, error } = await loadSessionBlockDetail(supabase, id)
  if (error || !detail) return NextResponse.json({ error: error ?? 'Bloc introuvable' }, { status: 400 })
  return NextResponse.json({ block: detail })
}
