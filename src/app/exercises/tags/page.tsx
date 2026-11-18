import { Suspense } from 'react'

import {
  archiveCoachSportAction,
  archiveCoachTypeAction,
  archiveCoachUnitAction,
  createCoachSportAction,
  createCoachTypeAction,
  createCoachUnitAction,
  renameCoachSportAction,
  renameCoachTypeAction,
  updateCoachUnitAction,
} from '@/src/app/tags/actions'
import { CoachQueryFlash } from '@/src/components/coach/CoachQueryFlash'
import { ExercisesHubHeader } from '@/src/components/exercises/ExercisesHubHeader'
import { ExercisesZoneBar } from '@/src/components/exercises/ExercisesZoneBar'
import { TagsLabelRow } from '@/src/components/tags/TagsLabelRow'
import { TagsUnitForm } from '@/src/components/tags/TagsUnitForm'
import { Button, ConfirmSubmitButton, Muted, daFieldClass } from '@/src/components/ui'
import { requireCoachAppUser } from '@/src/lib/auth/requireCoachAppUser'
import { formatUnitLabel } from '@/src/lib/tags/formatUnitLabel'
import { seedCoachTags } from '@/src/lib/tags/seedCoachTags'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ tab?: string; saved?: string; deleted?: string; error?: string }>
    | { tab?: string; saved?: string; deleted?: string; error?: string }
}

function parseTab(raw: string | undefined): 'sports' | 'types' | 'units' {
  if (raw === 'types' || raw === 'units') return raw
  return 'sports'
}

function modeLabel(mode: string | null | undefined) {
  if (mode === 'time') return 'Temps'
  if (mode === 'text') return 'Texte'
  if (mode === 'list') return 'Liste'
  return 'Nombre'
}

export default async function ExercisesTagsPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const tab = parseTab(params.tab)
  const { supabase, userId } = await requireCoachAppUser()

  await seedCoachTags(supabase, userId)

  const [{ data: sports }, { data: types }, { data: units }, { data: exos }, { data: blocks }] =
    await Promise.all([
      supabase
        .from('sports' as never)
        .select('id, label')
        .eq('coach_id' as never, userId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('exercise_types' as never)
        .select('id, label')
        .eq('coach_id' as never, userId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('units' as never)
        .select('id, label, short_label, value_mode, list_options')
        .eq('coach_id' as never, userId as never)
        .is('deleted_at' as never, null)
        .order('label' as never, { ascending: true }),
      supabase
        .from('exercise_library')
        .select('sport_id, exercise_type_id')
        .eq('coach_id', userId)
        .is('deleted_at', null),
      supabase
        .from('block_library' as never)
        .select('id, sport_id, expected_result_unit_id')
        .eq('coach_id' as never, userId as never)
        .is('deleted_at' as never, null),
    ])

  const sportUsage = new Map<string, number>()
  const typeUsage = new Map<string, number>()
  for (const e of (exos ?? []) as { sport_id: string | null; exercise_type_id: string | null }[]) {
    if (e.sport_id) sportUsage.set(e.sport_id, (sportUsage.get(e.sport_id) ?? 0) + 1)
    if (e.exercise_type_id) {
      typeUsage.set(e.exercise_type_id, (typeUsage.get(e.exercise_type_id) ?? 0) + 1)
    }
  }
  const unitUsage = new Map<string, number>()
  const blockIds: string[] = []
  for (const b of (blocks ?? []) as {
    id: string
    sport_id: string | null
    expected_result_unit_id: string | null
  }[]) {
    blockIds.push(b.id)
    if (b.sport_id) sportUsage.set(b.sport_id, (sportUsage.get(b.sport_id) ?? 0) + 1)
    if (b.expected_result_unit_id) {
      unitUsage.set(b.expected_result_unit_id, (unitUsage.get(b.expected_result_unit_id) ?? 0) + 1)
    }
  }
  if (blockIds.length) {
    const { data: slots } = await supabase
      .from('block_library_exercises' as never)
      .select('prescriptions')
      .in('block_id' as never, blockIds as never)
    for (const slot of (slots ?? []) as { prescriptions?: { unit_id?: string }[] | null }[]) {
      const seen = new Set<string>()
      for (const p of Array.isArray(slot.prescriptions) ? slot.prescriptions : []) {
        if (p.unit_id && !seen.has(p.unit_id)) {
          seen.add(p.unit_id)
          unitUsage.set(p.unit_id, (unitUsage.get(p.unit_id) ?? 0) + 1)
        }
      }
    }
  }

  const countLabel =
    tab === 'sports'
      ? `${(sports ?? []).length} sport${(sports ?? []).length === 1 ? '' : 's'}`
      : tab === 'types'
        ? `${(types ?? []).length} type${(types ?? []).length === 1 ? '' : 's'}`
        : `${(units ?? []).length} unité${(units ?? []).length === 1 ? '' : 's'}`

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
      <Suspense fallback={null}>
        <CoachQueryFlash
          overrides={{
            saved: { tone: 'success', message: 'Enregistré' },
            deleted: { tone: 'success', message: 'Archivé' },
          }}
        />
      </Suspense>

      <ExercisesHubHeader
        title="Tags"
        subtitle={<>{countLabel} · copies perso du catalogue Krid</>}
      />

      <ExercisesZoneBar kind="tags" basePath="/exercises/tags" />

      {tab === 'sports' ? (
        <>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Ajouter un sport
            </p>
            <form action={createCoachSportAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="tab" value="sports" />
              <input
                name="label"
                required
                placeholder="ex. Hyrox"
                className={`${daFieldClass} min-w-[12rem] flex-1`}
              />
              <Button type="submit" size="sm">
                + Sport
              </Button>
            </form>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            {!(sports as { id: string }[] | null)?.length ? (
              <Muted>Aucun sport.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {((sports ?? []) as { id: string; label: string }[]).map((s) => {
                  const n = sportUsage.get(s.id) ?? 0
                  return (
                    <TagsLabelRow
                      key={s.id}
                      id={s.id}
                      label={s.label}
                      usageLabel={n ? `· ${n} fiche(s)` : undefined}
                      renameAction={renameCoachSportAction}
                      archiveAction={archiveCoachSportAction}
                      tab="sports"
                    />
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {tab === 'types' ? (
        <>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Ajouter un type
            </p>
            <form action={createCoachTypeAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="tab" value="types" />
              <input
                name="label"
                required
                placeholder="ex. Isolation"
                className={`${daFieldClass} min-w-[12rem] flex-1`}
              />
              <Button type="submit" size="sm">
                + Type
              </Button>
            </form>
            <p className="mt-2 text-[11px] text-[color:var(--muted)]">
              Les types d’un bloc viennent des exercices.
            </p>
          </section>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            {!(types as { id: string }[] | null)?.length ? (
              <Muted>Aucun type.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {((types ?? []) as { id: string; label: string }[]).map((t) => {
                  const n = typeUsage.get(t.id) ?? 0
                  return (
                    <TagsLabelRow
                      key={t.id}
                      id={t.id}
                      label={t.label}
                      usageLabel={n ? `· ${n} exo(s)` : undefined}
                      renameAction={renameCoachTypeAction}
                      archiveAction={archiveCoachTypeAction}
                      tab="types"
                    />
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {tab === 'units' ? (
        <>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Ajouter une unité
            </p>
            <TagsUnitForm action={createCoachUnitAction} submitLabel="+ Unité" />
          </section>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            {!(units as { id: string }[] | null)?.length ? (
              <Muted>Aucune unité.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {(
                  (units ?? []) as {
                    id: string
                    label: string
                    short_label: string | null
                    value_mode: string | null
                    list_options: string[] | null
                  }[]
                ).map((u) => {
                  const n = unitUsage.get(u.id) ?? 0
                  const listOpts = Array.isArray(u.list_options) ? u.list_options : null
                  return (
                    <li key={u.id} className="grid gap-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--fg)]">
                            {formatUnitLabel(u.label, u.short_label)}
                          </p>
                          <p className="text-[11px] text-[color:var(--muted)]">
                            {modeLabel(u.value_mode)}
                            {n ? ` · ${n} usage(s)` : ''}
                          </p>
                        </div>
                        <form action={archiveCoachUnitAction}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="tab" value="units" />
                          <ConfirmSubmitButton
                            confirmMessage={`Archiver « ${u.label} » ?`}
                            variant="secondary"
                            size="sm"
                          >
                            Archiver
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                      <details className="rounded-[var(--radius-md)] border border-[var(--border)] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
                          Modifier
                        </summary>
                        <div className="mt-3">
                          <TagsUnitForm
                            action={updateCoachUnitAction}
                            hiddenId={u.id}
                            submitLabel="Enregistrer"
                            initial={{
                              label: u.label,
                              short_label: u.short_label,
                              value_mode: u.value_mode,
                              list_options: listOpts,
                            }}
                          />
                        </div>
                      </details>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
