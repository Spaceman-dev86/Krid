import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'

import { loadProgramSessionBoardSnapshot } from '@/src/app/admin/programs/programSessionActions'
import {
  CoachQueryFlash,
  PROGRAMS_OMIT_SUCCESS_FLASH,
} from '@/src/components/coach/CoachQueryFlash'
import { CoachProgramSessionEditClient } from '@/src/components/programs/CoachProgramSessionEditClient'
import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import { assertCanEditProgramSession } from '@/src/lib/programs/assertCanEditProgramSession'
import { loadProgramSessionBlockDetails } from '@/src/lib/sessions/programSessionBlock'
import type { SessionSlot } from '@/src/lib/sessions/constants'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string; sessionId: string }> | { id: string; sessionId: string }
  searchParams?: Promise<{ returnTo?: string }> | { returnTo?: string }
}

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

function safeReturnTo(raw: string | undefined, planFallback: string): string {
  const v = String(raw ?? '').trim()
  if (!v.startsWith('/') || v.startsWith('//')) return planFallback
  try {
    const u = new URL(v, 'http://local.invalid')
    if (u.pathname.startsWith('/programs/plans/')) {
      const out = new URLSearchParams()
      const w = u.searchParams.get('w')
      const sid = u.searchParams.get('sid')
      if (w && /^\d+$/.test(w)) out.set('w', w)
      if (sid && /^[0-9a-f-]{36}$/i.test(sid)) out.set('sid', sid)
      const q = out.toString()
      return q ? `${u.pathname}?${q}` : u.pathname
    }
    if (u.pathname.startsWith('/programs/')) return u.pathname
  } catch {
    return planFallback
  }
  return planFallback
}

export default async function CoachProgramSessionEditPage({ params, searchParams }: Props) {
  const { id: programId, sessionId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null
  if (!canAccessCoachApp(role) && !isPlatformAdmin(role)) redirect('/login')

  const access = await assertCanEditProgramSession(supabase, sessionId, user.id, role)
  if (!access.ok) {
    if (access.status === 404) notFound()
    redirect('/programs')
  }
  if (access.programId !== programId) {
    redirect(`/programs/${access.programId}/sessions/${sessionId}/edit`)
  }

  const { data: sessionMeta } = await supabase
    .from('sessions')
    .select('title, notes, objective_ressenti, objective_note, objective_difficulty')
    .eq('id', sessionId)
    .maybeSingle()

  const snap = await loadProgramSessionBoardSnapshot(supabase, sessionId)
  const orphanIds = snap.compositionSlots
    .map((s) => s.orphanSessionBlockId)
    .filter((oid): oid is string => Boolean(oid))
  const initialBlockDetails = await loadProgramSessionBlockDetails(supabase, orphanIds)

  const [{ data: blocksRaw }, { data: exosRaw }, { data: unitsRaw }, { data: sportsRaw }, { data: typesRaw }] =
    await Promise.all([
      supabase
        .from('block_library' as never)
        .select('id, name, sport_id, status')
        .is('deleted_at' as never, null)
        .eq('status' as never, 'published')
        .or(`coach_id.is.null,and(coach_id.eq.${user.id},hub_visible.eq.true)`)
        .order('name' as never, { ascending: true })
        .limit(400),
      supabase
        .from('exercise_library')
        .select('id, name, sport_id, exercise_type_id, muscle_group')
        .is('deleted_at', null)
        .eq('status', 'published')
        .or(`coach_id.is.null,coach_id.eq.${user.id}`)
        .order('name', { ascending: true })
        .limit(600),
      supabase
        .from('units' as never)
        .select('id, key, label, short_label, value_mode, list_options')
        .is('deleted_at' as never, null)
        .or(`coach_id.is.null,coach_id.eq.${user.id}`)
        .order('label' as never, { ascending: true }),
      supabase
        .from('sports' as never)
        .select('id, label')
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('exercise_types' as never)
        .select('id, label')
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
    ])

  const sports = ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => ({
    id: s.id,
    label: s.label,
  }))
  const sportLabel = new Map(sports.map((s) => [s.id, s.label]))
  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )

  const blocks = ((blocksRaw ?? []) as {
    id: string
    name: string | null
    sport_id: string | null
    status: string
  }[])
    .map((b) => ({
      id: b.id,
      name: b.name?.trim() || 'Bloc',
      status: b.status,
      sport_id: b.sport_id,
      sport_label: b.sport_id ? sportLabel.get(b.sport_id) ?? null : null,
    }))

  const exercises = ((exosRaw ?? []) as {
    id: string
    name: string | null
    sport_id: string | null
    exercise_type_id: string | null
    muscle_group: string | null
  }[]).map((e) => ({
    id: e.id,
    name: e.name?.trim() || 'Exercice',
    exercise_type_id: e.exercise_type_id,
    exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
    sport_id: e.sport_id,
    sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
    muscle_group: e.muscle_group,
  }))

  const units: UnitRow[] = ((unitsRaw ?? []) as {
    id: string
    key: string
    label: string
    short_label?: string | null
    value_mode?: string | null
    list_options?: unknown
  }[]).map((u) => ({
    id: u.id,
    key: u.key,
    label: u.label,
    short_label: u.short_label ?? null,
    value_mode: asUnitValueMode(u.value_mode),
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const initialSlots: SessionSlot[] = snap.compositionSlots.map((s) => ({
    key: s.key,
    kind: s.kind,
    blockId: s.blockId,
    orphanSessionBlockId: s.orphanSessionBlockId,
    exerciseId: s.exerciseId,
    restSeconds: s.restSeconds,
    prescriptions: (s.prescriptions ?? []) as SessionSlot['prescriptions'],
  }))

  const returnTo = safeReturnTo(q.returnTo, `/programs/${programId}`)

  return (
    <>
      <Suspense fallback={null}>
        <CoachQueryFlash omitKeys={PROGRAMS_OMIT_SUCCESS_FLASH} />
      </Suspense>
      <CoachProgramSessionEditClient
        programId={programId}
        weekId={access.weekId}
        sessionId={sessionId}
        sessionTitle={access.title}
        compositionVersion={snap.composition_version ?? access.composition_version}
        returnTo={returnTo}
        blocks={blocks}
        exercises={exercises}
        units={units}
        sports={sports}
        initialSlots={initialSlots}
        initialBlockDetails={initialBlockDetails}
        initialMeta={{
          name: sessionMeta?.title?.trim() || access.title,
          notes: sessionMeta?.notes ?? '',
          objective_ressenti: sessionMeta?.objective_ressenti !== false,
          objective_note: sessionMeta?.objective_note !== false,
          objective_difficulty: sessionMeta?.objective_difficulty !== false,
        }}
      />
    </>
  )
}
