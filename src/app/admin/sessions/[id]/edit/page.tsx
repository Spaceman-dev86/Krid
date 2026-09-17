import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import {
  Button,
  ConfirmSubmitButton,
  DaBanner,
  PageTitle,
  Muted,
} from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import { loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import {
  restSecondsFromPrescriptions,
  type SessionPrescription,
  type SessionSlot,
} from '@/src/lib/sessions/constants'
import {
  deleteTrainlySessionAction,
  publishTrainlySessionAction,
  saveDraftTrainlySessionAction,
  updateTrainlySessionAction,
} from '../../sessionFicheActions'

export const dynamic = 'force-dynamic'

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

type Props = {
  params: Promise<{ id: string }>
  searchParams?:
    | Promise<{ error?: string; ok?: string; attachBlock?: string }>
    | { error?: string; ok?: string; attachBlock?: string }
}

export default async function EditAdminSessionPage({ params, searchParams }: Props) {
  const { id } = await params
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const { data: sessionRaw } = await supabase
    .from('session_library' as never)
    .select(
      'id, name, notes, status, allow_duplicate, objective_ressenti, objective_note, objective_difficulty, coach_id',
    )
    .eq('id' as never, id as never)
    .is('deleted_at' as never, null)
    .maybeSingle()

  const session = sessionRaw as {
    id: string
    name: string
    notes: string | null
    status: string
    allow_duplicate: boolean
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
    coach_id: string | null
  } | null

  if (!session || session.coach_id != null) notFound()

  const [
    { data: itemsRaw },
    { data: hiddenTypesRaw },
    { data: hiddenSportsRaw },
    { data: blocksRaw },
    { data: exosRaw },
    { data: unitsRaw },
    { data: typesRaw },
    { data: sportsRaw },
  ] = await Promise.all([
    supabase
      .from('session_library_items' as never)
      .select('item_kind, block_id, exercise_id, prescriptions, position')
      .eq('session_id' as never, id as never)
      .order('position' as never, { ascending: true }),
    supabase
      .from('session_library_hidden_types' as never)
      .select('exercise_type_id')
      .eq('session_id' as never, id as never),
    supabase
      .from('session_library_hidden_sports' as never)
      .select('sport_id')
      .eq('session_id' as never, id as never),
    supabase
      .from('block_library' as never)
      .select('id, name, status, sport_id')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('name' as never, { ascending: true })
      .limit(500),
    supabase
      .from('exercise_library')
      .select('id, name, exercise_type_id, sport_id, muscle_group')
      .is('coach_id', null)
      .is('deleted_at', null)
      .eq('status', 'published')
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('units' as never)
      .select('id, key, label, short_label, value_mode, dimension, list_options')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase.from('exercise_types' as never).select('id, label').is('deleted_at' as never, null),
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null),
  ])

  const typeLabel = new Map(
    ((typesRaw ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]),
  )
  const sportLabel = new Map(
    ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => [s.id, s.label]),
  )

  const blocks = ((blocksRaw ?? []) as {
    id: string
    name: string
    status: string
    sport_id: string | null
  }[]).map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    sport_id: b.sport_id,
    sport_label: b.sport_id ? sportLabel.get(b.sport_id) ?? null : null,
  }))

  // Blocs soft-deleted encore liés à la séance → conservés pour l’édition
  const linkedBlockIds = [
    ...new Set(
      ((itemsRaw ?? []) as { item_kind?: string; block_id?: string | null }[])
        .filter((r) => r.item_kind === 'block' && r.block_id)
        .map((r) => r.block_id as string),
    ),
  ]
  const missingLinked = linkedBlockIds.filter((id) => !blocks.some((b) => b.id === id))
  if (missingLinked.length) {
    const { data: ghostRaw } = await supabase
      .from('block_library' as never)
      .select('id, name, status, sport_id')
      .in('id' as never, missingLinked as never)
    for (const b of (ghostRaw ?? []) as {
      id: string
      name: string
      status: string
      sport_id: string | null
    }[]) {
      blocks.push({
        id: b.id,
        name: `${b.name} (corbeille)`,
        status: b.status,
        sport_id: b.sport_id,
        sport_label: b.sport_id ? sportLabel.get(b.sport_id) ?? null : null,
      })
    }
  }

  const initialBlockDetails = await loadSessionBlockDetails(supabase, linkedBlockIds)

  const exercises = ((exosRaw ?? []) as {
    id: string
    name: string
    exercise_type_id: string | null
    sport_id: string | null
    muscle_group: string | null
  }[]).map((e) => ({
    id: e.id,
    name: e.name,
    exercise_type_id: e.exercise_type_id,
    exercise_type_label: e.exercise_type_id ? typeLabel.get(e.exercise_type_id) ?? null : null,
    sport_id: e.sport_id,
    sport_label: e.sport_id ? sportLabel.get(e.sport_id) ?? null : null,
    muscle_group: e.muscle_group,
  }))

  const catalogSports = ((sportsRaw ?? []) as { id: string; label: string }[]).map((s) => ({
    id: s.id,
    label: s.label,
  }))

  const units = ((unitsRaw ?? []) as {
    id: string
    key: string
    label: string
    short_label?: string | null
    value_mode?: string | null
    dimension?: string | null
    list_options?: unknown
  }[]).map((u) => ({
    id: u.id,
    key: u.key,
    label: u.label,
    short_label: u.short_label ?? null,
    value_mode: u.value_mode,
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const blockUnits: UnitRow[] = ((unitsRaw ?? []) as {
    id: string
    key: string
    label: string
    short_label?: string | null
    value_mode?: string | null
    dimension?: string | null
    list_options?: unknown
  }[]).map((u) => ({
    id: u.id,
    key: u.key,
    label: u.label,
    short_label: u.short_label ?? null,
    dimension: u.dimension ?? null,
    value_mode: asUnitValueMode(u.value_mode),
    list_options: Array.isArray(u.list_options) ? (u.list_options as string[]) : null,
  }))

  const slots: SessionSlot[] = (
    (itemsRaw ?? []) as {
      item_kind: string
      block_id: string | null
      exercise_id: string | null
      prescriptions?: SessionPrescription[] | null
      position: number
    }[]
  ).map((r, i) => {
    if (r.item_kind === 'block') {
      return {
        key: `b-${r.block_id}-${i}`,
        kind: 'block' as const,
        blockId: r.block_id ?? undefined,
        prescriptions: [],
      }
    }
    if (r.item_kind === 'rest') {
      return {
        key: `r-${i}`,
        kind: 'rest' as const,
        restSeconds: restSecondsFromPrescriptions(r.prescriptions),
        prescriptions: [],
      }
    }
    return {
      key: `e-${r.exercise_id}-${i}`,
      kind: 'exercise' as const,
      exerciseId: r.exercise_id ?? undefined,
      prescriptions: Array.isArray(r.prescriptions) ? r.prescriptions : [],
    }
  })

  const attachBlock = typeof q.attachBlock === 'string' ? q.attachBlock.trim() : ''
  if (attachBlock && blocks.some((b) => b.id === attachBlock) && !slots.some((s) => s.blockId === attachBlock)) {
    slots.push({
      key: `attach-${attachBlock}`,
      kind: 'block',
      blockId: attachBlock,
      prescriptions: [],
    })
  }

  const returnTo = `/admin/sessions/${id}/edit`

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-sm text-[color:var(--muted)]">
          <Link
            href="/admin/programs?kind=sessions"
            className="font-semibold text-[var(--brand)] hover:underline"
          >
            ← Séances
          </Link>
        </p>
        <PageTitle className="mt-2">Éditer la séance</PageTitle>
        <Muted className="mt-1">{session.name}</Muted>
      </div>

      {q.error ? <DaBanner tone="danger" className="mb-4">{q.error}</DaBanner> : null}
      {q.ok === 'saved' ? (
        <DaBanner tone="success" className="mb-4">
          Enregistré.
        </DaBanner>
      ) : null}
      {attachBlock ? (
        <DaBanner tone="success" className="mb-4">
          Bloc rattaché — à la publication, les blocs brouillon liés seront publiés automatiquement.
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        <input type="hidden" name="id" value={session.id} />
        <input type="hidden" name="current_status" value={session.status ?? 'draft'} />
        <SessionFicheEditor
          blocks={blocks}
          exercises={exercises}
          units={units}
          blockCatalog={{
            candidates: exercises,
            sports: catalogSports,
            units: blockUnits,
          }}
          initialBlockDetails={initialBlockDetails}
          sessionPublished={session.status === 'published'}
          returnToForNewBlock={returnTo}
          initial={{
            name: session.name,
            notes: session.notes ?? '',
            allow_duplicate: session.allow_duplicate !== false,
            objective_ressenti: session.objective_ressenti !== false,
            objective_note: session.objective_note !== false,
            objective_difficulty: session.objective_difficulty !== false,
            slots,
            hidden_type_ids: (
              (hiddenTypesRaw ?? []) as { exercise_type_id: string }[]
            ).map((r) => r.exercise_type_id),
            hidden_sport_ids: ((hiddenSportsRaw ?? []) as { sport_id: string }[]).map(
              (r) => r.sport_id,
            ),
          }}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          {session.status === 'published' ? (
            <>
              <Button type="submit" formAction={updateTrainlySessionAction}>
                Enregistrer
              </Button>
              <Button type="submit" formAction={saveDraftTrainlySessionAction} variant="secondary">
                Repasser brouillon
              </Button>
            </>
          ) : (
            <>
              <ConfirmSubmitButton
                confirmMessage="Publier cette séance ? Les blocs brouillon liés seront publiés aussi."
                formAction={publishTrainlySessionAction}
              >
                Publier
              </ConfirmSubmitButton>
              <Button type="submit" formAction={saveDraftTrainlySessionAction} variant="secondary">
                Sauvegarder brouillon
              </Button>
            </>
          )}
        </div>
      </form>

      <form action={deleteTrainlySessionAction} className="mt-6">
        <input type="hidden" name="id" value={id} />
        <ConfirmSubmitButton
          confirmMessage="Mettre cette séance Trainly à la corbeille ?"
          variant="secondary"
        >
          Supprimer
        </ConfirmSubmitButton>
      </form>
    </main>
  )
}
