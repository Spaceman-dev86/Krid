import Link from 'next/link'

import {
  PageTitle,
  Muted,
  Button,
  ConfirmSubmitButton,
  IconPlus,
  daFieldClass,
  DaBanner,
} from '@/src/components/ui'
import { CatalogBackLink } from '@/src/components/admin/CatalogScopeToggle'
import { CatalogLiveSearch } from '@/src/components/admin/CatalogLiveSearch'
import { AddCatalogUnitSection } from '@/src/components/admin/AddCatalogUnitSection'
import { coachDisplayName, type CoachProfileEmbed } from '../../../lib/catalog/coachScope'
import { listCatalogCoachOwners } from '../../../lib/catalog/coachOwners'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import {
  CATALOG_STATUS_LABEL,
  parseCatalogStatus,
  type CatalogStatus,
} from '../../../lib/catalog/workflow'
import {
  catalogListHref,
  parseCatalogKind,
  sanitizeSearch,
  type CatalogKind,
} from '../../../lib/catalog/search'
import {
  setExerciseCatalogStatusAction,
  updateExerciseCatalogRightsAction,
} from './catalogActions'
import {
  createTrainlyExerciseTypeAction,
  deleteTrainlyExerciseAction,
  deleteTrainlyExerciseTypeAction,
} from './exerciseFicheActions'
import {
  createTrainlySportAction,
  deleteTrainlyBlockAction,
  deleteTrainlySportAction,
  deleteTrainlyUnitAction,
  setBlockCatalogStatusAction,
} from '../blocks/blockFicheActions'

export const dynamic = 'force-dynamic'

type ExerciseRow = {
  id: string
  name: string
  coach_id: string | null
  muscle_group: string | null
  difficulty: string | null
  status: string | null
  allow_duplicate?: boolean | null
  allow_download?: boolean | null
  profiles?: CoachProfileEmbed | null
}

type BlockRow = {
  id: string
  name: string
  coach_id: string | null
  status: string | null
  allow_duplicate?: boolean | null
  sport_label?: string | null
  profiles?: CoachProfileEmbed | null
}

function statusBadgeClass(status: CatalogStatus) {
  if (status === 'published') {
    return 'border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]'
  }
  return 'bg-[var(--accent)] text-[color:var(--muted)] ring-1 ring-[var(--border)]'
}

type Props = {
  searchParams?:
    | Promise<{
        kind?: string
        mode?: string
        view?: string
        q?: string
        coach?: string
        ok?: string
        error?: string
      }>
    | {
        kind?: string
        mode?: string
        view?: string
        q?: string
        coach?: string
        ok?: string
        error?: string
      }
}

export default async function AdminExercisesPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const kind: CatalogKind = parseCatalogKind(params.kind)
  // Legacy mode=coach → view=coach
  const viewRaw = params.view ?? (params.mode === 'coach' ? 'coach' : 'all')
  const view =
    viewRaw === 'published' ||
    viewRaw === 'draft' ||
    viewRaw === 'types' ||
    viewRaw === 'sports' ||
    viewRaw === 'units' ||
    viewRaw === 'coach'
      ? viewRaw
      : 'all'
  const isCoachScope = view === 'coach'
  const search = sanitizeSearch(params.q)
  const coachQ = sanitizeSearch(params.coach)
  const { supabase } = await requirePlatformAdmin()

  let exercises: ExerciseRow[] = []
  let blocks: BlockRow[] = []
  let error: { message: string } | null = null
  let types: { id: string; label: string }[] = []
  let sports: { id: string; label: string }[] = []
  let catalogUnits: {
    id: string
    label: string
    key: string
    short_label: string | null
    value_mode: string | null
  }[] = []

  if (view === 'types' && kind === 'exercises') {
    const { data: typesRaw, error: typesErr } = await supabase
      .from('exercise_types' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true })
    error = typesErr
    types = (typesRaw ?? []) as { id: string; label: string }[]
  } else if (view === 'sports') {
    const { data: sportsRaw, error: sportsErr } = await supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true })
    error = sportsErr
    sports = (sportsRaw ?? []) as { id: string; label: string }[]
  } else if (view === 'units') {
    const { data: unitsRaw, error: unitsErr } = await supabase
      .from('units' as never)
      .select('id, label, key, short_label, value_mode')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true })
    error = unitsErr
    catalogUnits = (unitsRaw ?? []) as {
      id: string
      label: string
      key: string
      short_label: string | null
      value_mode: string | null
    }[]
  } else if (isCoachScope) {
    const { owners, error: ownersError } = await listCatalogCoachOwners(supabase, coachQ)
    error = ownersError ? { message: ownersError } : null
    const byId = new Map(owners.map((p) => [p.id, p]))
    const ownerIds = owners.map((p) => p.id)

    if (!ownersError && ownerIds.length) {
      if (kind === 'blocks') {
        let bq = supabase
          .from('block_library' as never)
          .select('id,name,coach_id,status,allow_duplicate,created_at')
          .in('coach_id' as never, ownerIds as never)
          .is('deleted_at' as never, null)
          .order('created_at' as never, { ascending: false })
          .limit(200)
        if (search) bq = bq.ilike('name' as never, `%${search}%` as never)
        const res = await bq
        error = res.error
        blocks = ((res.data ?? []) as unknown as BlockRow[]).map((row) => ({
          ...row,
          profiles: row.coach_id ? (byId.get(row.coach_id) as CoachProfileEmbed) ?? null : null,
        }))
      } else {
        let exoQuery = supabase
          .from('exercise_library')
          .select('id,name,coach_id,muscle_group,difficulty,status,allow_duplicate,allow_download,created_at')
          .in('coach_id', ownerIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200)
        if (search) exoQuery = exoQuery.ilike('name', `%${search}%`)
        const res = await exoQuery
        error = res.error
        exercises = ((res.data ?? []) as unknown as ExerciseRow[]).map((row) => ({
          ...row,
          profiles: row.coach_id ? (byId.get(row.coach_id) as CoachProfileEmbed) ?? null : null,
        }))
      }
    }
  } else if (kind === 'blocks') {
    let query = supabase
      .from('block_library' as never)
      .select('id,name,coach_id,status,allow_duplicate,created_at,sport_id')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('created_at' as never, { ascending: false })
      .limit(200)
    if (view === 'published' || view === 'draft') {
      query = query.eq('status' as never, view as never)
    }
    if (search) query = query.ilike('name' as never, `%${search}%` as never)
    const res = await query
    error = res.error
    const rawBlocks = (res.data ?? []) as unknown as Array<
      BlockRow & { sport_id?: string | null }
    >
    const sportIds = [...new Set(rawBlocks.map((b) => b.sport_id).filter(Boolean))] as string[]
    const sportMap = new Map<string, string>()
    if (sportIds.length) {
      const { data: sRows } = await supabase
        .from('sports' as never)
        .select('id, label')
        .in('id' as never, sportIds as never)
      for (const s of (sRows ?? []) as { id: string; label: string }[]) {
        sportMap.set(s.id, s.label)
      }
    }
    blocks = rawBlocks.map((row) => ({
      ...row,
      sport_label: row.sport_id ? sportMap.get(row.sport_id) ?? null : null,
    }))
  } else {
    let query = supabase
      .from('exercise_library')
      .select('id,name,coach_id,muscle_group,difficulty,status,allow_duplicate,allow_download,created_at')
      .is('coach_id', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200)
    if (view === 'published' || view === 'draft') {
      query = query.eq('status', view)
    }
    if (search) query = query.ilike('name', `%${search}%`)
    const res = await query
    error = res.error
    exercises = (res.data ?? []) as unknown as ExerciseRow[]
  }

  const flash =
    params.error
      ? decodeURIComponent(String(params.error))
      : params.ok === 'published'
        ? kind === 'blocks'
          ? 'Bloc publié.'
          : 'Exercice publié — visible dans la palette Trainly coaches.'
        : params.ok === 'draft'
          ? 'Repassé en brouillon.'
          : params.ok === 'rights'
            ? 'Droits enregistrés.'
            : params.ok === 'type'
              ? 'Type ajouté.'
              : params.ok === 'type_deleted'
                ? 'Type supprimé.'
                : params.ok === 'sport'
                  ? 'Sport ajouté.'
                    : params.ok === 'sport_deleted'
                    ? 'Sport supprimé.'
                    : params.ok === 'unit'
                      ? 'Unité ajoutée.'
                      : params.ok === 'unit_deleted'
                        ? 'Unité supprimée.'
                        : params.ok === 'deleted'
                          ? 'Supprimé.'
                          : null

  const exerciseTabs = [
    { key: 'all', label: 'Tous' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'published', label: 'Publiés' },
    { key: 'types', label: 'Types' },
    { key: 'units', label: 'Unités' },
    { key: 'sports', label: 'Sport' },
    { key: 'coach', label: 'Coach' },
  ] as const

  const blockTabs = [
    { key: 'all', label: 'Tous' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'published', label: 'Publiés' },
    { key: 'units', label: 'Unités' },
    { key: 'sports', label: 'Sport' },
    { key: 'coach', label: 'Coach' },
  ] as const

  const tabs = kind === 'blocks' ? blockTabs : exerciseTabs

  const returnTo = catalogListHref('/admin/exercises', {
    kind,
    view: ['types', 'sports', 'units'].includes(view) ? 'all' : view,
    q: search,
    coach: coachQ,
  })
  const previewReturn = encodeURIComponent(returnTo)
  const createHref = kind === 'blocks' ? '/admin/blocks/new' : '/admin/exercises/new'
  const showCreate =
    !isCoachScope &&
    view !== 'types' &&
    view !== 'sports' &&
    view !== 'units'

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CatalogBackLink />
          <PageTitle className="mt-2">
            {kind === 'blocks' ? 'Blocs' : 'Exercices'}
          </PageTitle>
          <Muted className="mt-1">
            {isCoachScope
              ? 'Contenu coaches — lecture / preview.'
              : view === 'types'
                ? 'Types catalogue plateforme.'
                : view === 'sports'
                    ? 'Sports catalogue (exos + blocs).'
                    : view === 'units'
                      ? 'Unités communes (prescriptions bloc / résultat attendu).'
                      : 'Catalogue plateforme — Brouillon → Publié.'}
          </Muted>
        </div>
        {showCreate ? (
          <Link
            href={createHref}
            aria-label={kind === 'blocks' ? 'Créer un bloc' : 'Créer un exercice'}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] ring-1 ring-[var(--border)] hover:opacity-90"
          >
            <IconPlus size={20} />
          </Link>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          href={catalogListHref('/admin/exercises', { kind: 'exercises', view: 'all', q: search })}
          variant={kind === 'exercises' ? undefined : 'secondary'}
          size="sm"
        >
          Exercices
        </Button>
        <Button
          href={catalogListHref('/admin/exercises', { kind: 'blocks', view: 'all', q: search })}
          variant={kind === 'blocks' ? undefined : 'secondary'}
          size="sm"
        >
          Blocs
        </Button>
      </div>

      {flash ? (
        params.error ? (
          <DaBanner tone="danger" className="mb-4">
            {flash}
          </DaBanner>
        ) : (
          <DaBanner tone="success" className="mb-4">
            {flash}
          </DaBanner>
        )
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            href={catalogListHref('/admin/exercises', { kind, view: t.key, q: search })}
            variant={view === t.key ? undefined : 'secondary'}
            size="sm"
          >
            {t.label}
          </Button>
        ))}
      </div>

      {view === 'types' && kind === 'exercises' ? (
        <>
          <section className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Ajouter un type
            </p>
            <form action={createTrainlyExerciseTypeAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="return_to" value="/admin/exercises?view=types" />
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
          </section>
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
              {types.length} type{types.length === 1 ? '' : 's'}
            </p>
            {!types.length ? (
              <Muted>Aucun type.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {types.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm font-semibold text-[color:var(--fg)]">{t.label}</span>
                    <form action={deleteTrainlyExerciseTypeAction}>
                      <input type="hidden" name="id" value={t.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Supprimer le type « ${t.label} » ?`}
                        variant="secondary"
                        size="sm"
                      >
                        Supprimer
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : view === 'sports' ? (
        <>
          <section className="mb-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Ajouter un sport
            </p>
            <form action={createTrainlySportAction} className="mt-3 flex flex-wrap gap-2">
              <input
                type="hidden"
                name="return_to"
                value={catalogListHref('/admin/exercises', { kind, view: 'sports' })}
              />
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
            <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
              {sports.length} sport{sports.length === 1 ? '' : 's'}
            </p>
            {!sports.length ? (
              <Muted>Aucun sport — lance la migration 42.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {sports.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-sm font-semibold text-[color:var(--fg)]">{s.label}</span>
                    <form action={deleteTrainlySportAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <ConfirmSubmitButton
                        confirmMessage={`Supprimer le sport « ${s.label} » ?`}
                        variant="secondary"
                        size="sm"
                      >
                        Supprimer
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : view === 'units' ? (
        <>
          <AddCatalogUnitSection />
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
              {catalogUnits.length} unité{catalogUnits.length === 1 ? '' : 's'}
            </p>
            {!catalogUnits.length ? (
              <Muted>Aucune unité — lance la migration 42/46.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {catalogUnits.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <span className="text-sm font-semibold text-[color:var(--fg)]">
                        {u.label}
                        {u.short_label ? (
                          <span className="ml-1.5 font-normal text-[color:var(--muted)]">
                            ({u.short_label})
                          </span>
                        ) : null}
                      </span>
                      <p className="text-[11px] text-[color:var(--muted)]">
                        {u.key} ·{' '}
                        {u.value_mode === 'time'
                          ? 'temps'
                          : u.value_mode === 'text'
                            ? 'texte'
                            : u.value_mode === 'list'
                              ? 'liste'
                              : 'chiffre'}
                      </p>
                    </div>
                    <form action={deleteTrainlyUnitAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="kind" value={kind} />
                      <ConfirmSubmitButton
                        confirmMessage={`Supprimer l’unité « ${u.label} » ?`}
                        variant="secondary"
                        size="sm"
                      >
                        Supprimer
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : kind === 'blocks' ? (
        <>
          <CatalogLiveSearch
            basePath="/admin/exercises"
            kind="blocks"
            mode={isCoachScope ? 'coach' : 'trainly'}
            view={view}
            initialQ={search}
            initialCoach={coachQ}
            showCoachFilter={isCoachScope}
            titlePlaceholder="Rechercher un bloc…"
          />
          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
              {blocks.length} bloc{blocks.length === 1 ? '' : 's'}
            </p>
            {!blocks.length ? (
              <Muted>Aucun bloc dans ce filtre.</Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {blocks.map((b) => {
                  const status = parseCatalogStatus(b.status ?? 'draft')
                  const editHref = `/admin/blocks/${b.id}/edit`
                  return (
                    <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={editHref}
                              className="truncate text-sm font-bold text-[var(--brand)] hover:underline"
                            >
                              {b.name}
                            </Link>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(status)}`}
                            >
                              {status === 'published'
                                ? CATALOG_STATUS_LABEL.published
                                : CATALOG_STATUS_LABEL.draft}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                            {isCoachScope
                              ? coachDisplayName(b.profiles)
                              : b.sport_label || '—'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {!isCoachScope ? (
                            <>
                              <Button href={editHref} variant="secondary" size="sm">
                                Éditer
                              </Button>
                              {status === 'draft' ? (
                                <form action={setBlockCatalogStatusAction}>
                                  <input type="hidden" name="id" value={b.id} />
                                  <input type="hidden" name="status" value="published" />
                                  <input type="hidden" name="return_to" value={returnTo} />
                                  <ConfirmSubmitButton confirmMessage="Publier ce bloc ?">
                                    Publier
                                  </ConfirmSubmitButton>
                                </form>
                              ) : (
                                <form action={setBlockCatalogStatusAction}>
                                  <input type="hidden" name="id" value={b.id} />
                                  <input type="hidden" name="status" value="draft" />
                                  <input type="hidden" name="return_to" value={returnTo} />
                                  <ConfirmSubmitButton
                                    variant="secondary"
                                    confirmMessage="Dépublier ce bloc ?"
                                  >
                                    Dépublier
                                  </ConfirmSubmitButton>
                                </form>
                              )}
                              <form action={deleteTrainlyBlockAction}>
                                <input type="hidden" name="id" value={b.id} />
                                <input type="hidden" name="return_to" value={returnTo} />
                                <ConfirmSubmitButton
                                  variant="secondary"
                                  confirmMessage="Mettre ce bloc à la corbeille ?"
                                >
                                  Supprimer
                                </ConfirmSubmitButton>
                              </form>
                            </>
                          ) : (
                            <Button href={editHref} variant="secondary" size="sm">
                              Preview
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      ) : (
        <>
          <CatalogLiveSearch
            basePath="/admin/exercises"
            kind="exercises"
            mode={isCoachScope ? 'coach' : 'trainly'}
            view={view}
            initialQ={search}
            initialCoach={coachQ}
            showCoachFilter={isCoachScope}
            titlePlaceholder="Rechercher par nom…"
          />

          <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
            <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
              {exercises.length} exercice{exercises.length === 1 ? '' : 's'}
            </p>
            {!exercises.length ? (
              <Muted>
                {search || coachQ
                  ? 'Aucun exercice pour ces filtres.'
                  : isCoachScope
                    ? 'Aucun exercice coach.'
                    : 'Aucun exercice dans ce filtre.'}
              </Muted>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {exercises.map((e) => {
                  const status = parseCatalogStatus(e.status ?? 'draft')
                  const owner = e.profiles
                  const editHref = isCoachScope
                    ? `/admin/exercises/${e.id}?returnTo=${previewReturn}`
                    : `/admin/exercises/${e.id}/edit`
                  const detailHref = `/admin/exercises/${e.id}?returnTo=${previewReturn}`

                  return (
                    <li key={e.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={editHref}
                              className="truncate text-sm font-bold text-[var(--brand)] hover:underline"
                            >
                              {e.name}
                            </Link>
                            {!isCoachScope ? (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(status)}`}
                              >
                                {status === 'published'
                                  ? CATALOG_STATUS_LABEL.published
                                  : CATALOG_STATUS_LABEL.draft}
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                                {e.status === 'draft' ? 'Brouillon' : 'Publié'}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                            {isCoachScope ? (
                              <>
                                {coachDisplayName(owner)}
                                {owner?.email ? ` · ${owner.email}` : ''}
                              </>
                            ) : (
                              [e.muscle_group, e.difficulty].filter(Boolean).join(' · ') || '—'
                            )}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {!isCoachScope ? (
                            <Button href={editHref} variant="secondary" size="sm">
                              Éditer
                            </Button>
                          ) : (
                            <Button href={detailHref} variant="secondary" size="sm">
                              Preview
                            </Button>
                          )}
                          {!isCoachScope ? (
                            <>
                              {status === 'draft' || status === 'review' ? (
                                <form action={setExerciseCatalogStatusAction}>
                                  <input type="hidden" name="id" value={e.id} />
                                  <input type="hidden" name="status" value="published" />
                                  <input type="hidden" name="return_to" value={returnTo} />
                                  <ConfirmSubmitButton confirmMessage="Publier cet exercice dans la palette Trainly ?">
                                    Publier
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                              {status === 'published' ? (
                                <form action={setExerciseCatalogStatusAction}>
                                  <input type="hidden" name="id" value={e.id} />
                                  <input type="hidden" name="status" value="draft" />
                                  <input type="hidden" name="return_to" value={returnTo} />
                                  <ConfirmSubmitButton
                                    variant="secondary"
                                    confirmMessage="Dépublier ? Il disparaîtra de la palette coach."
                                  >
                                    Dépublier
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                              <form action={deleteTrainlyExerciseAction}>
                                <input type="hidden" name="id" value={e.id} />
                                <input type="hidden" name="return_to" value={returnTo} />
                                <ConfirmSubmitButton
                                  variant="secondary"
                                  confirmMessage="Mettre cet exercice à la corbeille ?"
                                >
                                  Supprimer
                                </ConfirmSubmitButton>
                              </form>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {!isCoachScope ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer text-[11px] font-semibold text-[var(--brand)]">
                            Droit duplicable
                          </summary>
                          <form
                            action={updateExerciseCatalogRightsAction}
                            className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]"
                          >
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--fg)]">
                              <input
                                name="allow_duplicate"
                                type="checkbox"
                                defaultChecked={e.allow_duplicate !== false}
                                className="accent-[var(--brand)]"
                              />
                              Duplicable
                            </label>
                            <Button type="submit" variant="secondary" size="sm">
                              Enregistrer
                            </Button>
                          </form>
                        </details>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
