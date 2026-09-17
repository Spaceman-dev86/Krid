import Link from 'next/link'

import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import { Button, DaBanner, PageTitle, Muted, ConfirmSubmitButton } from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import { loadSessionBlockDetails } from '@/src/lib/sessions/blockDetail'
import type { SessionSlot } from '@/src/lib/sessions/constants'
import {
  createTrainlySessionDraftAction,
  createTrainlySessionPublishedAction,
} from '../sessionFicheActions'

export const dynamic = 'force-dynamic'

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

type Props = {
  searchParams?:
    | Promise<{ error?: string; attachBlock?: string }>
    | { error?: string; attachBlock?: string }
}

export default async function NewAdminSessionPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()

  const [{ data: blocksRaw }, { data: exosRaw }, { data: unitsRaw }, { data: typesRaw }, { data: sportsRaw }] =
    await Promise.all([
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

  const attachBlock = typeof params.attachBlock === 'string' ? params.attachBlock.trim() : ''
  const initialSlots: SessionSlot[] = []
  if (attachBlock && blocks.some((b) => b.id === attachBlock)) {
    initialSlots.push({
      key: `attach-${attachBlock}`,
      kind: 'block',
      blockId: attachBlock,
      prescriptions: [],
    })
  }
  const initialBlockDetails = attachBlock
    ? await loadSessionBlockDetails(supabase, [attachBlock])
    : []

  const returnTo = '/admin/sessions/new'

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
        <PageTitle className="mt-2">Nouvelle séance</PageTitle>
        <Muted className="mt-1">
          Blocs publiés + exos publiés · héritage types/sports · objectif client post-séance.
        </Muted>
      </div>

      {params.error ? <DaBanner tone="danger" className="mb-4">{params.error}</DaBanner> : null}
      {attachBlock ? (
        <DaBanner tone="success" className="mb-4">
          Bloc rattaché — à la publication de la séance, les blocs brouillon liés seront publiés
          automatiquement.
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
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
          returnToForNewBlock={returnTo}
          initial={{ slots: initialSlots }}
        />
        <div className="mt-5 flex flex-wrap gap-2">
          <ConfirmSubmitButton
            confirmMessage="Publier cette séance ? Les blocs brouillon liés seront publiés aussi."
            formAction={createTrainlySessionPublishedAction}
          >
            Publier
          </ConfirmSubmitButton>
          <Button type="submit" formAction={createTrainlySessionDraftAction} variant="secondary">
            Brouillon
          </Button>
        </div>
      </form>
    </main>
  )
}
