import Link from 'next/link'

import { PageTitle, Muted, Button, ConfirmSubmitButton, DaBanner } from '@/src/components/ui'
import { CatalogBackLink } from '@/src/components/admin/CatalogScopeToggle'
import { CatalogLiveSearch } from '@/src/components/admin/CatalogLiveSearch'
import { CreateProgramDialogTrigger } from '@/src/components/admin/CreateProgramDialog'
import {
  coachDisplayName,
  type CoachProfileEmbed,
} from '../../../lib/catalog/coachScope'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'
import {
  CATALOG_STATUS_LABEL,
  catalogStatusFromPublished,
  parseCatalogStatus,
  type CatalogStatus,
} from '../../../lib/catalog/workflow'
import {
  catalogListHref,
  parseFitnessKind,
  sanitizeSearch,
} from '../../../lib/catalog/search'
import { createClient } from '../../../lib/supabase/server'
import {
  setProgramCatalogStatusAction,
  updateProgramCatalogRightsAction,
  setProgramTrainlyFlagAction,
  deleteTrainlyProgramAction,
} from './catalogActions'
import { AdminSessionsCatalog } from './SessionsCatalog'

export const dynamic = 'force-dynamic'

type ProgramRow = {
  id: string
  title: string | null
  coach_id: string
  is_template: boolean | null
  is_published: boolean | null
  catalog_status?: string | null
  allow_duplicate?: boolean | null
  allow_download?: boolean | null
  is_trainly_catalog?: boolean | null
  profiles?: CoachProfileEmbed | null
}

function statusBadgeClass(status: CatalogStatus) {
  if (status === 'published') {
    return 'border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]'
  }
  if (status === 'review') {
    return 'border border-[var(--border)] bg-[var(--accent)] text-[color:var(--brand)]'
  }
  return 'bg-[var(--accent)] text-[color:var(--muted)] ring-1 ring-[var(--border)]'
}

export default async function AdminProgramsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    kind?: string | string[]
    mode?: string | string[]
    view?: string | string[]
    q?: string | string[]
    coach?: string | string[]
    sport?: string | string[]
    type?: string | string[]
    ok?: string
    error?: string
    create?: string
  }> | {
    kind?: string | string[]
    mode?: string | string[]
    view?: string | string[]
    q?: string | string[]
    coach?: string | string[]
    sport?: string | string[]
    type?: string | string[]
    ok?: string
    error?: string
    create?: string
  }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const fitnessKind = parseFitnessKind(Array.isArray(params.kind) ? params.kind[0] : params.kind)
  const autoCreate =
    (Array.isArray(params.create) ? params.create[0] : params.create) === '1'

  if (fitnessKind === 'sessions') {
    return (
      <AdminSessionsCatalog
        searchParams={{
          view: Array.isArray(params.view) ? params.view[0] : params.view,
          q: Array.isArray(params.q) ? params.q[0] : params.q,
          coach: Array.isArray(params.coach) ? params.coach[0] : params.coach,
          sport: Array.isArray(params.sport) ? params.sport[0] : params.sport,
          type: Array.isArray(params.type) ? params.type[0] : params.type,
          ok: params.ok,
          error: params.error,
        }}
      />
    )
  }

  await requirePlatformAdmin()
  const supabase = await createClient()

  const rawView = Array.isArray(params.view) ? params.view[0] : params.view
  const legacyMode = Array.isArray(params.mode) ? params.mode[0] : params.mode
  const view =
    rawView === 'published' ||
    rawView === 'review' ||
    rawView === 'draft' ||
    rawView === 'coach' ||
    rawView === 'templates' ||
    rawView === 'public' ||
    rawView === 'drafts'
      ? rawView
      : legacyMode === 'coach'
        ? 'coach'
        : 'all'
  const search = sanitizeSearch(Array.isArray(params.q) ? params.q[0] : params.q)
  const coachQ = sanitizeSearch(Array.isArray(params.coach) ? params.coach[0] : params.coach)
  const normalizedView =
    view === 'public' ? 'published' : view === 'drafts' ? 'draft' : view
  const isCoachScope = normalizedView === 'coach'

  // Coach = biblio perso (is_trainly_catalog false) · sinon catalogue plateforme
  let progQuery = supabase
    .from('programs')
    .select(
      'id,title,coach_id,is_published,is_template,created_at,catalog_status,allow_duplicate,allow_download,is_trainly_catalog',
    )
    .eq('is_trainly_catalog', !isCoachScope)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (!isCoachScope) {
    // Catalogue Trainly = moules (is_template true) en Brouillon / Publié.
    // Ne pas filtrer is_template:false (sinon les créations admin disparaissent des onglets).
    if (normalizedView === 'published') {
      progQuery = progQuery.eq('catalog_status', 'published')
    } else if (normalizedView === 'review') {
      progQuery = progQuery.eq('catalog_status', 'review')
    } else if (normalizedView === 'draft') {
      progQuery = progQuery.eq('catalog_status', 'draft')
    } else if (normalizedView === 'templates') {
      progQuery = progQuery.eq('is_template', true)
    }
  }

  if (search) progQuery = progQuery.ilike('title', `%${search}%`)

  let { data: progData, error } = await progQuery

  if (error && /is_trainly_catalog|catalog_status|allow_duplicate|allow_download/i.test(error.message)) {
    if (isCoachScope) {
      const { data: owners } = await supabase
        .from('profiles')
        .select('id')
        .or('role.eq.coach,coach_workspace.eq.true')
        .is('deleted_at', null)
      const ids = (owners ?? []).map((o) => o.id)
      if (!ids.length) {
        const { data: coachesOnly } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'coach')
          .is('deleted_at', null)
        const cids = (coachesOnly ?? []).map((o) => o.id)
        let legacy = supabase
          .from('programs')
          .select('id,title,coach_id,is_published,is_template,created_at')
          .in('coach_id', cids.length ? cids : ['00000000-0000-0000-0000-000000000000'])
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200)
        if (search) legacy = legacy.ilike('title', `%${search}%`)
        const res = await legacy
        progData = res.data
        error = res.error
          ? res.error
          : ({
              message: 'Exécute 38_coach_workspace_repair.sql pour séparer catalogue / Coach correctement.',
              details: '',
              hint: '',
              code: 'PGRST',
            } as NonNullable<typeof error>)
      } else {
        let legacy = supabase
          .from('programs')
          .select('id,title,coach_id,is_published,is_template,created_at')
          .in('coach_id', ids)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(200)
        if (search) legacy = legacy.ilike('title', `%${search}%`)
        const res = await legacy
        progData = res.data
        error = res.error
      }
    } else {
      let legacy = supabase
        .from('programs')
        .select('id,title,coach_id,is_published,is_template,created_at')
        .eq('is_template', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(200)
      if (search) legacy = legacy.ilike('title', `%${search}%`)
      const res = await legacy
      progData = res.data
      error = res.error
        ? res.error
        : ({
            message: 'Exécute 38_coach_workspace_repair.sql pour séparer catalogue / Coach correctement.',
            details: '',
            hint: '',
            code: 'PGRST',
          } as NonNullable<typeof error>)
    }
  }

  let programs = (progData ?? []) as ProgramRow[]

  const coachIds = [...new Set(programs.map((p) => p.coach_id))]
  const byId = new Map<string, CoachProfileEmbed>()
  if (coachIds.length) {
    const { data: allOwners } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', coachIds)
    for (const o of allOwners ?? []) byId.set(o.id, o as CoachProfileEmbed)

    if (isCoachScope && coachQ) {
      const q = coachQ.toLowerCase()
      programs = programs.filter((p) => {
        const o = byId.get(p.coach_id)
        if (!o) return false
        return (
          (o.full_name ?? '').toLowerCase().includes(q) ||
          (o.email ?? '').toLowerCase().includes(q)
        )
      })
    }
  }

  programs = programs.map((p) => ({ ...p, profiles: byId.get(p.coach_id) ?? null }))

  const flash =
    params.error
      ? decodeURIComponent(String(params.error))
      : params.ok === 'published'
        ? 'Programme publié — visible dans le catalogue coach.'
        : params.ok === 'review'
          ? 'Programme envoyé en review.'
          : params.ok === 'draft'
            ? 'Repassé en brouillon (retiré du catalogue coach).'
            : params.ok === 'rights'
              ? 'Droits enregistrés.'
              : params.ok === 'to_coach'
                ? 'Déplacé vers biblio coach.'
                : params.ok === 'to_trainly'
                  ? 'Déplacé vers le catalogue plateforme.'
                  : params.ok === 'deleted'
                    ? 'Programme mis à la corbeille.'
                    : null

  const tabs = [
    { key: 'all', label: 'Tous' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'published', label: 'Publiés' },
    { key: 'coach', label: 'Coach' },
  ] as const

  const returnTo = catalogListHref('/admin/programs', {
    view: normalizedView,
    q: search,
    coach: coachQ,
  })

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CatalogBackLink />
          <PageTitle className="mt-2">Programmes</PageTitle>
          <Muted className="mt-1">
            {isCoachScope
              ? 'Contenu coaches — lecture / preview.'
              : 'Catalogue plateforme — Brouillon → Publié.'}
          </Muted>
        </div>
        {!isCoachScope ? <CreateProgramDialogTrigger autoOpen={autoCreate} /> : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button href={catalogListHref('/admin/programs', { view: 'all', q: search })} size="sm">
          Programmes
        </Button>
        <Button
          href={catalogListHref('/admin/programs', { kind: 'sessions', view: 'all', q: search })}
          variant="secondary"
          size="sm"
        >
          Séances
        </Button>
      </div>

      {flash ? (
        <DaBanner tone={params.error ? 'danger' : 'success'} className="mb-4">
          {flash}
        </DaBanner>
      ) : null}

      {error ? <p className="mb-4 text-sm text-red-700">{error.message}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            href={catalogListHref('/admin/programs', {
              view: t.key,
              q: search,
              coach: coachQ,
            })}
            variant={normalizedView === t.key ? undefined : 'secondary'}
            size="sm"
          >
            {t.label}
          </Button>
        ))}
      </div>

      <CatalogLiveSearch
        basePath="/admin/programs"
        mode={isCoachScope ? 'coach' : 'trainly'}
        view={normalizedView}
        initialQ={search}
        initialCoach={coachQ}
        showCoachFilter={isCoachScope}
        titlePlaceholder="Rechercher par titre…"
      />

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
          {programs.length} programme{programs.length === 1 ? '' : 's'}
        </p>
        {!programs.length ? (
          <Muted>
            {search || coachQ
              ? 'Aucun programme pour ces filtres.'
              : isCoachScope
                ? 'Aucun programme coach.'
                : 'Aucun programme dans ce filtre.'}
          </Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {programs.map((p) => {
              const status = p.catalog_status
                ? parseCatalogStatus(p.catalog_status)
                : catalogStatusFromPublished(p.is_published)
              const owner = p.profiles

              return (
                <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!isCoachScope ? (
                          <Link
                            href={`/admin/programs/${p.id}`}
                            className="truncate text-sm font-bold text-[var(--brand)] hover:underline"
                          >
                            {p.title || 'Programme'}
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/preview/${p.id}?mode=coach`}
                            className="truncate text-sm font-bold text-[var(--brand)] hover:underline"
                          >
                            {p.title || 'Programme'}
                          </Link>
                        )}
                        {!isCoachScope ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(status)}`}
                          >
                            {p.is_template ? 'Template · ' : ''}
                            {CATALOG_STATUS_LABEL[status]}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                            {owner?.role === 'admin' || owner?.role === 'platform_admin'
                              ? 'Workspace admin'
                              : 'Coach'}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                        {coachDisplayName(owner)}
                        {owner?.email ? ` · ${owner.email}` : ''}
                        {isCoachScope ? (
                          <>
                            {' · '}
                            <Link
                              href={`/admin/coaches/${p.coach_id}`}
                              className="font-semibold text-[var(--brand)] hover:underline"
                            >
                              Fiche
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        href={`/admin/preview/${p.id}?mode=${isCoachScope ? 'coach' : 'trainly'}`}
                        variant="secondary"
                        size="sm"
                      >
                        Preview
                      </Button>
                      {!isCoachScope ? (
                        <>
                          {status === 'draft' || status === 'review' ? (
                            <form action={setProgramCatalogStatusAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="status" value="published" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <ConfirmSubmitButton confirmMessage="Publier dans le catalogue plateforme ?">
                                Publier
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                          {status === 'published' ? (
                            <form action={setProgramCatalogStatusAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="status" value="draft" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <ConfirmSubmitButton
                                variant="secondary"
                                confirmMessage="Dépublier du catalogue coaches ?"
                              >
                                Dépublier
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                          <form action={deleteTrainlyProgramAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <ConfirmSubmitButton
                              variant="secondary"
                              confirmMessage="Mettre ce programme à la corbeille ?"
                            >
                              Supprimer
                            </ConfirmSubmitButton>
                          </form>
                          {!p.is_template ? (
                            <form action={setProgramTrainlyFlagAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <input type="hidden" name="trainly" value="0" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <ConfirmSubmitButton
                                variant="secondary"
                                confirmMessage="Envoyer ce programme dans la biblio coach ?"
                              >
                                → Coach
                              </ConfirmSubmitButton>
                            </form>
                          ) : null}
                        </>
                      ) : (
                        <form action={setProgramTrainlyFlagAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="trainly" value="1" />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <ConfirmSubmitButton
                            variant="secondary"
                            confirmMessage="Déplacer vers le catalogue plateforme (édition / publish) ?"
                          >
                            → Catalogue
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </div>

                  {!isCoachScope && !p.is_template ? (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] font-semibold text-[var(--brand)]">
                        Droits duplicable / téléchargeable
                      </summary>
                      <form
                        action={updateProgramCatalogRightsAction}
                        className="mt-2 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--fg)]">
                          <input
                            name="allow_duplicate"
                            type="checkbox"
                            defaultChecked={p.allow_duplicate !== false}
                            className="accent-[var(--brand)]"
                          />
                          Duplicable
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--fg)]">
                          <input
                            name="allow_download"
                            type="checkbox"
                            defaultChecked={p.allow_download !== false}
                            className="accent-[var(--brand)]"
                          />
                          Téléchargeable
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
    </main>
  )
}
