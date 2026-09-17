import Link from 'next/link'

import { CatalogBackLink } from '@/src/components/admin/CatalogScopeToggle'
import { CatalogLiveSearch } from '@/src/components/admin/CatalogLiveSearch'
import {
  PageTitle,
  Muted,
  Button,
  ConfirmSubmitButton,
  DaBanner,
  IconPlus,
} from '@/src/components/ui'
import { coachDisplayName, type CoachProfileEmbed } from '@/src/lib/catalog/coachScope'
import { catalogListHref, sanitizeSearch } from '@/src/lib/catalog/search'
import { CATALOG_STATUS_LABEL, parseCatalogStatus } from '@/src/lib/catalog/workflow'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import { setSessionCatalogStatusAction, deleteTrainlySessionAction } from '../sessions/sessionFicheActions'

type SessionRow = {
  id: string
  name: string
  coach_id: string | null
  status: string | null
  allow_duplicate?: boolean | null
  profiles?: CoachProfileEmbed | null
  sport_ids?: string[]
  type_ids?: string[]
  sport_labels?: string[]
}

function statusBadgeClass(status: 'draft' | 'published' | 'review') {
  if (status === 'published') {
    return 'border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]'
  }
  return 'bg-[var(--accent)] text-[color:var(--muted)] ring-1 ring-[var(--border)]'
}

export async function AdminSessionsCatalog({
  searchParams,
}: {
  searchParams: {
    view?: string
    q?: string
    coach?: string
    sport?: string
    type?: string
    ok?: string
    error?: string
  }
}) {
  const { supabase } = await requirePlatformAdmin()
  const viewRaw = searchParams.view
  const view =
    viewRaw === 'published' || viewRaw === 'draft' || viewRaw === 'coach' ? viewRaw : 'all'
  const isCoachScope = view === 'coach'
  const search = sanitizeSearch(searchParams.q)
  const coachQ = sanitizeSearch(searchParams.coach)
  const sportFilter = sanitizeSearch(searchParams.sport)
  const typeFilter = sanitizeSearch(searchParams.type)

  const [{ data: sportsRaw }, { data: typesRaw }] = await Promise.all([
    supabase
      .from('sports' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
    supabase
      .from('exercise_types' as never)
      .select('id, label')
      .is('coach_id' as never, null)
      .is('deleted_at' as never, null)
      .order('label' as never, { ascending: true }),
  ])

  let sessQuery = supabase
    .from('session_library' as never)
    .select('id, name, coach_id, status, allow_duplicate')
    .is('deleted_at' as never, null)
    .order('updated_at' as never, { ascending: false })
    .limit(200)

  if (isCoachScope) {
    sessQuery = sessQuery.not('coach_id' as never, 'is', null)
  } else {
    sessQuery = sessQuery.is('coach_id' as never, null)
    if (view === 'published') sessQuery = sessQuery.eq('status' as never, 'published')
    if (view === 'draft') sessQuery = sessQuery.eq('status' as never, 'draft')
  }
  if (search) sessQuery = sessQuery.ilike('name' as never, `%${search}%`)

  const { data: sessionsRaw, error: sessionsError } = await sessQuery

  const sports = (sportsRaw ?? []) as { id: string; label: string }[]
  const types = (typesRaw ?? []) as { id: string; label: string }[]
  let sessions = (sessionsRaw ?? []) as SessionRow[]

  if (sessionsError && /session_library|relation|schema cache/i.test(sessionsError.message)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
        <CatalogBackLink />
        <PageTitle className="mt-2">Programmes & séances</PageTitle>
        <DaBanner tone="warning" className="mt-4">
          Applique la migration <code>50_session_library_catalog.sql</code> puis dis « 50 OK ».
        </DaBanner>
      </main>
    )
  }

  const coachIds = [...new Set(sessions.map((s) => s.coach_id).filter(Boolean))] as string[]
  const byId = new Map<string, CoachProfileEmbed>()
  if (coachIds.length) {
    const { data: owners } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', coachIds)
    for (const o of owners ?? []) byId.set(o.id, o as CoachProfileEmbed)
  }

  if (isCoachScope && coachQ) {
    const qq = coachQ.toLowerCase()
    sessions = sessions.filter((s) => {
      const o = s.coach_id ? byId.get(s.coach_id) : null
      if (!o) return false
      return (
        (o.full_name ?? '').toLowerCase().includes(qq) ||
        (o.email ?? '').toLowerCase().includes(qq)
      )
    })
  }

  const sessionIds = sessions.map((s) => s.id)
  const metaBySession = new Map<
    string,
    { sportIds: Set<string>; typeIds: Set<string>; sportLabels: Set<string> }
  >()

  if (sessionIds.length) {
    const { data: items } = await supabase
      .from('session_library_items' as never)
      .select('session_id, item_kind, block_id, exercise_id')
      .in('session_id' as never, sessionIds as never)

    const blockIds = [
      ...new Set(
        ((items ?? []) as { block_id?: string | null }[])
          .map((i) => i.block_id)
          .filter(Boolean) as string[],
      ),
    ]
    const exoIds = [
      ...new Set(
        ((items ?? []) as { exercise_id?: string | null }[])
          .map((i) => i.exercise_id)
          .filter(Boolean) as string[],
      ),
    ]

    const blockSport = new Map<string, string | null>()
    const exoMeta = new Map<string, { sport_id: string | null; exercise_type_id: string | null }>()
    const nestedByBlock = new Map<string, string[]>()

    if (blockIds.length) {
      const { data } = await supabase
        .from('block_library' as never)
        .select('id, sport_id')
        .in('id' as never, blockIds as never)
      for (const b of (data ?? []) as { id: string; sport_id: string | null }[]) {
        blockSport.set(b.id, b.sport_id)
      }
      const { data: blockExos } = await supabase
        .from('block_library_exercises' as never)
        .select('block_id, exercise_id')
        .in('block_id' as never, blockIds as never)
      for (const r of (blockExos ?? []) as { block_id: string; exercise_id: string }[]) {
        if (!nestedByBlock.has(r.block_id)) nestedByBlock.set(r.block_id, [])
        nestedByBlock.get(r.block_id)!.push(r.exercise_id)
      }
      const nestedExoIds = [
        ...new Set(
          ((blockExos ?? []) as { exercise_id?: string }[])
            .map((r) => r.exercise_id)
            .filter(Boolean) as string[],
        ),
      ]
      if (nestedExoIds.length) {
        const { data: nested } = await supabase
          .from('exercise_library')
          .select('id, sport_id, exercise_type_id')
          .in('id', nestedExoIds)
        for (const e of (nested ?? []) as {
          id: string
          sport_id: string | null
          exercise_type_id: string | null
        }[]) {
          exoMeta.set(e.id, { sport_id: e.sport_id, exercise_type_id: e.exercise_type_id })
        }
      }
    }

    if (exoIds.length) {
      const { data } = await supabase
        .from('exercise_library')
        .select('id, sport_id, exercise_type_id')
        .in('id', exoIds)
      for (const e of (data ?? []) as {
        id: string
        sport_id: string | null
        exercise_type_id: string | null
      }[]) {
        exoMeta.set(e.id, { sport_id: e.sport_id, exercise_type_id: e.exercise_type_id })
      }
    }

    const sportName = new Map(sports.map((s) => [s.id, s.label]))

    for (const it of (items ?? []) as {
      session_id: string
      item_kind: string
      block_id?: string | null
      exercise_id?: string | null
    }[]) {
      if (!metaBySession.has(it.session_id)) {
        metaBySession.set(it.session_id, {
          sportIds: new Set(),
          typeIds: new Set(),
          sportLabels: new Set(),
        })
      }
      const meta = metaBySession.get(it.session_id)!
      if (it.item_kind === 'block' && it.block_id) {
        const sid = blockSport.get(it.block_id)
        if (sid) {
          meta.sportIds.add(sid)
          const label = sportName.get(sid)
          if (label) meta.sportLabels.add(label)
        }
        for (const eid of nestedByBlock.get(it.block_id) ?? []) {
          const em = exoMeta.get(eid)
          if (em?.sport_id) {
            meta.sportIds.add(em.sport_id)
            const label = sportName.get(em.sport_id)
            if (label) meta.sportLabels.add(label)
          }
          if (em?.exercise_type_id) meta.typeIds.add(em.exercise_type_id)
        }
      }
      if (it.item_kind === 'exercise' && it.exercise_id) {
        const em = exoMeta.get(it.exercise_id)
        if (em?.sport_id) {
          meta.sportIds.add(em.sport_id)
          const label = sportName.get(em.sport_id)
          if (label) meta.sportLabels.add(label)
        }
        if (em?.exercise_type_id) meta.typeIds.add(em.exercise_type_id)
      }
    }
  }

  sessions = sessions.map((s) => {
    const meta = metaBySession.get(s.id)
    return {
      ...s,
      profiles: s.coach_id ? byId.get(s.coach_id) ?? null : null,
      sport_ids: meta ? [...meta.sportIds] : [],
      type_ids: meta ? [...meta.typeIds] : [],
      sport_labels: meta ? [...meta.sportLabels].sort((a, b) => a.localeCompare(b, 'fr')) : [],
    }
  })

  if (sportFilter) {
    sessions = sessions.filter((s) => (s.sport_ids ?? []).includes(sportFilter))
  }
  if (typeFilter) {
    sessions = sessions.filter((s) => (s.type_ids ?? []).includes(typeFilter))
  }

  const tabs = [
    { key: 'all', label: 'Tous' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'published', label: 'Publiés' },
    { key: 'coach', label: 'Coach' },
  ] as const

  const returnTo = catalogListHref('/admin/programs', {
    kind: 'sessions',
    view,
    q: search,
    coach: coachQ,
    sport: sportFilter,
    type: typeFilter,
  })

  const flash = searchParams.error
    ? decodeURIComponent(String(searchParams.error))
    : searchParams.ok === 'published'
      ? 'Séance publiée.'
      : searchParams.ok === 'draft'
        ? 'Séance en brouillon.'
        : searchParams.ok === 'deleted'
          ? 'Séance mise à la corbeille.'
          : null

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CatalogBackLink />
          <PageTitle className="mt-2">Séances</PageTitle>
          <Muted className="mt-1">
            {isCoachScope
              ? 'Contenu coaches — lecture.'
              : 'Catalogue plateforme — Brouillon → Publié.'}
          </Muted>
        </div>
        {!isCoachScope ? (
          <Link
            href="/admin/sessions/new"
            aria-label="Créer une séance"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--brand)] text-[var(--brand-fg)] ring-1 ring-[var(--border)] hover:opacity-90"
          >
            <IconPlus size={20} />
          </Link>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          href={catalogListHref('/admin/programs', { view: 'all', q: search })}
          variant="secondary"
          size="sm"
        >
          Programmes
        </Button>
        <Button
          href={catalogListHref('/admin/programs', { kind: 'sessions', view: 'all', q: search })}
          size="sm"
        >
          Séances
        </Button>
      </div>

      {flash ? (
        <DaBanner tone={searchParams.error ? 'danger' : 'success'} className="mb-4">
          {flash}
        </DaBanner>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            href={catalogListHref('/admin/programs', {
              kind: 'sessions',
              view: t.key,
              q: search,
              coach: coachQ,
              sport: sportFilter,
              type: typeFilter,
            })}
            variant={view === t.key ? undefined : 'secondary'}
            size="sm"
          >
            {t.label}
          </Button>
        ))}
      </div>

      <CatalogLiveSearch
        basePath="/admin/programs"
        mode={isCoachScope ? 'coach' : 'trainly'}
        kind="sessions"
        view={view}
        initialQ={search}
        initialCoach={coachQ}
        initialSport={sportFilter}
        initialType={typeFilter}
        showCoachFilter={isCoachScope}
        sportOptions={sports}
        typeOptions={types}
        titlePlaceholder="Rechercher une séance…"
      />

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
          {sessions.length} séance{sessions.length === 1 ? '' : 's'}
        </p>
        {!sessions.length ? (
          <Muted>
            {search || coachQ || sportFilter || typeFilter
              ? 'Aucune séance pour ces filtres.'
              : isCoachScope
                ? 'Aucune séance coach.'
                : 'Aucune séance dans ce filtre.'}
          </Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((s) => {
              const status = parseCatalogStatus(s.status ?? 'draft')
              const editHref = `/admin/sessions/${s.id}/edit`
              return (
                <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={editHref}
                          className="truncate text-sm font-bold text-[var(--brand)] hover:underline"
                        >
                          {s.name}
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
                          ? coachDisplayName(s.profiles)
                          : (s.sport_labels ?? []).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!isCoachScope ? (
                        <>
                          <Button href={editHref} variant="secondary" size="sm">
                            Éditer
                          </Button>
                          {status === 'draft' ? (
                            <form action={setSessionCatalogStatusAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="status" value="published" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <ConfirmSubmitButton confirmMessage="Publier cette séance ?">
                                Publier
                              </ConfirmSubmitButton>
                            </form>
                          ) : (
                            <form action={setSessionCatalogStatusAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="status" value="draft" />
                              <input type="hidden" name="return_to" value={returnTo} />
                              <ConfirmSubmitButton
                                variant="secondary"
                                confirmMessage="Dépublier cette séance ?"
                              >
                                Dépublier
                              </ConfirmSubmitButton>
                            </form>
                          )}
                          <form action={deleteTrainlySessionAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="return_to" value={returnTo} />
                            <ConfirmSubmitButton
                              variant="secondary"
                              confirmMessage="Mettre cette séance à la corbeille ?"
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
    </main>
  )
}
