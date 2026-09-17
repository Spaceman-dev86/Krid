import Link from 'next/link'

import { BlockFicheEditor, type BlockExerciseCandidate } from '@/src/components/admin/BlockFicheEditor'
import { Button, DaBanner, PageTitle, Muted } from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import type { UnitRow, UnitValueMode } from '@/src/lib/blocks/constants'
import {
  createTrainlyBlockDraftAction,
  createTrainlyBlockPublishedAction,
} from '../blockFicheActions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ error?: string; returnTo?: string; popup?: string }>
    | { error?: string; returnTo?: string; popup?: string }
}

type Sport = { id: string; label: string }

function asUnitValueMode(v: string | null | undefined): UnitValueMode | null {
  if (v === 'number' || v === 'time' || v === 'text' || v === 'list') return v
  return null
}

export default async function NewAdminBlockPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const returnTo =
    typeof params.returnTo === 'string' && params.returnTo.startsWith('/admin/sessions')
      ? params.returnTo
      : null
  const asPopup = params.popup === '1' || params.popup === 'true'
  const { supabase } = await requirePlatformAdmin()

  const [{ data: sportsRaw }, { data: unitsRaw }, { data: exosRaw }, { data: typesRaw }] =
    await Promise.all([
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
      supabase
        .from('exercise_types' as never)
        .select('id, label')
        .is('deleted_at' as never, null),
    ])

  const sports = (sportsRaw ?? []) as Sport[]
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

  return (
    <main className={`mx-auto max-w-2xl px-4 py-8 md:px-6 ${asPopup ? 'py-4' : ''}`}>
      <div className="mb-6">
        {asPopup ? null : (
          <p className="text-sm text-[color:var(--muted)]">
            <Link
              href="/admin/exercises?kind=blocks"
              className="font-semibold text-[var(--brand)] hover:underline"
            >
              ← Blocs
            </Link>
          </p>
        )}
        <PageTitle className={asPopup ? undefined : 'mt-2'}>Nouveau bloc</PageTitle>
        <Muted className="mt-1">
          {returnTo
            ? 'Créé en brouillon puis rattaché à la séance (pas publié automatiquement).'
            : 'Exos au centre · minuteur libre · sans format imposé.'}
        </Muted>
      </div>

      {params.error ? <DaBanner tone="danger" className="mb-4">{params.error}</DaBanner> : null}

      {!sports.length || !units.length ? (
        <DaBanner tone="warning" className="mb-4">
          Applique les migrations 42–48 (sports, units, Note, blocs libres) avant de créer un bloc.
        </DaBanner>
      ) : null}

      <form className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5">
        {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
        {asPopup ? <input type="hidden" name="popup" value="1" /> : null}
        <BlockFicheEditor candidates={candidates} sports={sports} units={units} initial={{}} />
        <div className="mt-5 flex flex-wrap gap-2">
          {returnTo ? (
            <Button type="submit" formAction={createTrainlyBlockDraftAction}>
              Enregistrer brouillon → séance
            </Button>
          ) : (
            <>
              <Button type="submit" formAction={createTrainlyBlockPublishedAction}>
                Créer
              </Button>
              <Button type="submit" formAction={createTrainlyBlockDraftAction} variant="secondary">
                Brouillon
              </Button>
            </>
          )}
        </div>
      </form>
    </main>
  )
}
