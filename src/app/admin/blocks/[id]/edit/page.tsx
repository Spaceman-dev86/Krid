import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BlockFicheEditor, type BlockExerciseCandidate } from '@/src/components/admin/BlockFicheEditor'
import {
  Button,
  ConfirmSubmitButton,
  DaBanner,
  PageTitle,
  Muted,
} from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import type {
  ExercisePrescription,
  UnitRow,
  UnitValueMode,
} from '@/src/lib/blocks/constants'
import {
  deleteTrainlyBlockAction,
  publishTrainlyBlockAction,
  saveDraftTrainlyBlockAction,
  updateTrainlyBlockAction,
} from '../../blockFicheActions'

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ error?: string; ok?: string }> | { error?: string; ok?: string }
}

type BlockRow = {
  id: string
  name: string
  notes: string | null
  timer_note: string | null
  sport_id: string | null
  expected_result_unit_id: string | null
  status: string | null
  allow_duplicate: boolean | null
  coach_id: string | null
}

export default async function EditAdminBlockPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const { data: blockRaw, error } = await supabase
    .from('block_library' as never)
    .select(
      'id,name,notes,timer_note,sport_id,expected_result_unit_id,status,allow_duplicate,coach_id',
    )
    .eq('id' as never, id as never)
    .is('deleted_at' as never, null)
    .maybeSingle()

  if (error || !blockRaw) notFound()
  const block = blockRaw as BlockRow
  if (block.coach_id != null) notFound()

  const [
    { data: sportsRaw },
    { data: unitsRaw },
    { data: exosRaw },
    { data: typesRaw },
    { data: linkedRaw },
    { data: hiddenRaw },
  ] = await Promise.all([
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('units' as never)
      .select('id, label, key, short_label, value_mode, dimension, list_options')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('exercise_library')
      .select('id, name, exercise_type_id, sport_id, muscle_group' as never)
      .is('coach_id', null)
      .is('deleted_at', null)
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(500),
    supabase.from('exercise_types' as never).select('id, label').is('deleted_at' as never, null),
    supabase
      .from('block_library_exercises' as never)
      .select('exercise_id, position, prescriptions')
      .eq('block_id' as never, id as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('block_library_hidden_types' as never)
      .select('exercise_type_id')
      .eq('block_id' as never, id as never),
  ])

  const sports = (sportsRaw ?? []) as { id: string; label: string }[]
  const units: UnitRow[] = ((unitsRaw ?? []) as {
    id: string
    label: string
    key: string
    value_mode?: string | null
    dimension?: string | null
    list_options?: unknown
  }[]).map((u) => ({
    ...u,
    value_mode: asUnitValueMode(u.value_mode),
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))
  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )
  const sportLabel = new Map(sports.map((s) => [s.id, s.label]))

  const candidates: BlockExerciseCandidate[] = (
    (exosRaw ?? []) as unknown as {
      id: string
      name: string
      exercise_type_id: string | null
      sport_id: string | null
      muscle_group: string | null
    }[]
  ).map((e) => ({
    id: e.id,
    name: e.name,
    exercise_type_id: e.exercise_type_id,
    exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
    sport_id: e.sport_id,
    sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
    muscle_group: e.muscle_group,
  }))

  const linked = (linkedRaw ?? []) as {
    exercise_id: string
    position: number
    prescriptions?: {
      unit_id: string
      value: string
      varies?: boolean
      input_mode?: string | null
    }[] | null
  }[]
  const exerciseIds = linked.map((r) => r.exercise_id)
  const exercisePrescriptions: ExercisePrescription[][] = linked.map((r) =>
    (Array.isArray(r.prescriptions) ? r.prescriptions : []).map((p) => ({
      unit_id: p.unit_id,
      value: p.value,
      varies: p.varies,
      input_mode: asUnitValueMode(p.input_mode),
    })),
  )

  const { data: sessionLinksRaw } = await supabase
    .from('session_library_items' as never)
    .select('session_id')
    .eq('block_id' as never, id as never)
    .eq('item_kind' as never, 'block' as never)

  const linkedSessionIds = [
    ...new Set(
      ((sessionLinksRaw ?? []) as { session_id: string }[])
        .map((r) => r.session_id)
        .filter(Boolean),
    ),
  ]

  let linkedSessions: { id: string; name: string; status: string }[] = []
  if (linkedSessionIds.length) {
    const { data: sessionsRaw } = await supabase
      .from('session_library' as never)
      .select('id, name, status')
      .in('id' as never, linkedSessionIds as never)
      .is('deleted_at' as never, null)
      .order('name' as never, { ascending: true })
    linkedSessions = ((sessionsRaw ?? []) as { id: string; name: string; status: string }[]).map(
      (s) => ({
        id: s.id,
        name: s.name,
        status: s.status || 'draft',
      }),
    )
  }

  const deleteConfirmMessage =
    block.status === 'published'
      ? linkedSessions.length
        ? [
            `Supprimer le bloc publié « ${block.name} » ?`,
            '',
            `Utilisé dans ${linkedSessions.length} séance${linkedSessions.length > 1 ? 's' : ''} :`,
            ...linkedSessions.map(
              (s) =>
                `• ${s.name}${s.status === 'published' ? ' (publiée)' : ' (brouillon)'}`,
            ),
            '',
            'Le lien reste visible en édition séance (corbeille). Continuer ?',
          ].join('\n')
        : `Supprimer le bloc publié « ${block.name} » ?\nAucune séance catalogue ne l’utilise actuellement.`
      : `Mettre le brouillon « ${block.name} » à la corbeille ?`

  const missingLinked = exerciseIds.filter((eid) => !candidates.some((c) => c.id === eid))
  if (missingLinked.length) {
    const { data: orphanRaw } = await supabase
      .from('exercise_library')
      .select('id, name, exercise_type_id, sport_id, muscle_group' as never)
      .in('id', missingLinked)
    for (const e of (orphanRaw ?? []) as unknown as {
      id: string
      name: string
      exercise_type_id: string | null
      sport_id: string | null
      muscle_group: string | null
    }[]) {
      candidates.push({
        id: e.id,
        name: `${e.name} (non publié)`,
        exercise_type_id: e.exercise_type_id,
        exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
        sport_id: e.sport_id,
        sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
        muscle_group: e.muscle_group,
      })
    }
  }

  const hiddenTypeIds = (
    (hiddenRaw ?? []) as { exercise_type_id: string }[]
  ).map((r) => r.exercise_type_id)

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/admin/exercises?kind=blocks"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Blocs
          </Link>
        </p>
        <PageTitle className="mt-2">Éditer le bloc</PageTitle>
        <Muted className="mt-1">{block.name}</Muted>
      </div>

      {q.error ? <DaBanner tone="danger" className="mb-4">{q.error}</DaBanner> : null}
      {q.ok === 'saved' || q.ok === 'draft' ? (
        <DaBanner tone="success" className="mb-4">
          {q.ok === 'draft' ? 'Brouillon enregistré.' : 'Enregistré.'}
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <input type="hidden" name="id" value={block.id} />
        <input type="hidden" name="current_status" value={block.status ?? 'draft'} />
        <BlockFicheEditor
          candidates={candidates}
          sports={sports}
          units={units}
          initial={{
            name: block.name,
            notes: block.notes ?? '',
            timer_note: block.timer_note ?? '',
            sport_id: block.sport_id ?? '',
            expected_result_unit_id: block.expected_result_unit_id ?? '',
            allow_duplicate: block.allow_duplicate !== false,
            exercise_ids: exerciseIds,
            exercise_prescriptions: exercisePrescriptions,
            hidden_type_ids: hiddenTypeIds,
          }}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {block.status === 'published' ? (
            <>
              <Button type="submit" formAction={updateTrainlyBlockAction}>
                Enregistrer
              </Button>
              <Button type="submit" formAction={saveDraftTrainlyBlockAction} variant="secondary">
                Repasser brouillon
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" formAction={publishTrainlyBlockAction}>
                Publier
              </Button>
              <Button type="submit" formAction={saveDraftTrainlyBlockAction} variant="secondary">
                Sauvegarder brouillon
              </Button>
            </>
          )}
        </div>
      </form>

      <form action={deleteTrainlyBlockAction} className="mt-6">
        <input type="hidden" name="id" value={block.id} />
        <ConfirmSubmitButton confirmMessage={deleteConfirmMessage} variant="secondary">
          Supprimer
        </ConfirmSubmitButton>
      </form>
    </main>
  )
}
