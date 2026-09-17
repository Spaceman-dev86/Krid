import Link from 'next/link'

import { PageTitle, Muted, Button, daFieldClass } from '@/src/components/ui'
import { CatalogBackLink, CatalogScopeToggle } from '@/src/components/admin/CatalogScopeToggle'
import { CatalogLiveSearch } from '@/src/components/admin/CatalogLiveSearch'
import { coachDisplayName, type CoachProfileEmbed } from '../../../../lib/catalog/coachScope'
import { listCatalogCoachOwners } from '../../../../lib/catalog/coachOwners'
import { catalogListHref, parseCatalogMode, sanitizeSearch } from '../../../../lib/catalog/search'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ mode?: string; q?: string; coach?: string }>
    | { mode?: string; q?: string; coach?: string }
}

type SessionRow = {
  id: string
  title: string | null
  session_order: number
  program_id: string
  program_title: string | null
  week_title: string | null
  week_order: number
  coach_id: string
  owner?: CoachProfileEmbed | null
}

export default async function AdminCatalogSessionsPage({ searchParams }: Props) {
  const { supabase } = await requirePlatformAdmin()
  const params = await Promise.resolve(searchParams ?? {})
  const mode = parseCatalogMode(params.mode)
  const search = sanitizeSearch(params.q)
  const coachQ = sanitizeSearch(params.coach)

  let sessions: SessionRow[] = []
  let error: string | null = null

  // Séances = lignes dans programs (pas de table templates détachée V1)
  let owners: CoachProfileEmbed[] = []
  if (mode === 'coach') {
    const res = await listCatalogCoachOwners(supabase, coachQ)
    owners = res.owners as CoachProfileEmbed[]
    error = res.error
  } else {
    const { data: staff } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('role', ['admin', 'platform_admin'])
      .is('deleted_at', null)
    owners = (staff ?? []) as CoachProfileEmbed[]
  }

  const ownerIds = owners.map((o) => o.id)
  const byId = new Map(owners.map((o) => [o.id, o]))

  if (ownerIds.length) {
    let progQuery = supabase
      .from('programs')
      .select('id, title, coach_id, is_trainly_catalog')
      .in('coach_id', ownerIds)
      .is('deleted_at', null)
      .limit(100)

    if (mode === 'coach') {
      progQuery = progQuery.eq('is_trainly_catalog', false)
    } else {
      progQuery = progQuery.eq('is_trainly_catalog', true)
    }

    const { data: programs, error: progErr } = await progQuery
    if (progErr && /is_trainly_catalog/i.test(progErr.message)) {
      error = 'Exécute 37 + 38 pour filtrer séances Trainly / Coach.'
    } else if (progErr) {
      error = progErr.message
    } else {
      const programIds = (programs ?? []).map((p) => p.id)
      const progById = new Map(
        (programs ?? []).map((p) => [p.id, p as { id: string; title: string | null; coach_id: string }]),
      )

      if (programIds.length) {
        const { data: weeks } = await supabase
          .from('program_weeks')
          .select('id, program_id, title, week_order')
          .in('program_id', programIds)
          .order('week_order', { ascending: true })

        const weekIds = (weeks ?? []).map((w) => w.id)
        const weekById = new Map(
          (weeks ?? []).map((w) => [
            w.id,
            w as { id: string; program_id: string; title: string | null; week_order: number },
          ]),
        )

        if (weekIds.length) {
          let sessQuery = supabase
            .from('sessions')
            .select('id, title, session_order, week_id')
            .in('week_id', weekIds)
            .order('session_order', { ascending: true })
            .limit(200)

          if (search) sessQuery = sessQuery.ilike('title', `%${search}%`)

          const { data: sessRows, error: sessErr } = await sessQuery
          if (sessErr) error = sessErr.message
          else {
            sessions = ((sessRows ?? []) as { id: string; title: string | null; session_order: number; week_id: string }[])
              .map((s) => {
                const week = weekById.get(s.week_id)
                if (!week) return null
                const prog = progById.get(week.program_id)
                if (!prog) return null
                return {
                  id: s.id,
                  title: s.title,
                  session_order: s.session_order,
                  program_id: prog.id,
                  program_title: prog.title,
                  week_title: week.title,
                  week_order: week.week_order,
                  coach_id: prog.coach_id,
                  owner: byId.get(prog.coach_id) ?? null,
                } satisfies SessionRow
              })
              .filter(Boolean) as SessionRow[]
          }
        }
      }
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <CatalogBackLink />
        <PageTitle className="mt-2">Séances & blocs</PageTitle>
        <Muted className="mt-1">
          {mode === 'coach'
            ? 'Séances des programmes coaches — Preview ouvre le programme côté client.'
            : 'Séances des programmes catalogue Trainly — Preview client.'}
        </Muted>
      </div>

      <div className="mb-4">
        <CatalogScopeToggle base="/admin/catalog/sessions" mode={mode} q={search} coach={coachQ} />
      </div>

      {mode === 'coach' ? (
        <CatalogLiveSearch
          basePath="/admin/catalog/sessions"
          mode="coach"
          initialQ={search}
          initialCoach={coachQ}
          showCoachFilter
          titlePlaceholder="Rechercher une séance…"
        />
      ) : (
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={search}
            placeholder="Rechercher une séance…"
            className={`${daFieldClass} min-w-[12rem] flex-1`}
          />
          <Button type="submit" size="sm">
            Chercher
          </Button>
        </form>
      )}

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
        <p className="mb-3 text-[11px] font-semibold text-[color:var(--muted)]">
          {sessions.length} séance{sessions.length === 1 ? '' : 's'}
        </p>
        {!sessions.length ? (
          <Muted>
            {search || coachQ
              ? 'Aucune séance pour ces filtres.'
              : 'Aucune séance dans ce scope. Les séances vivent dans les programmes.'}
          </Muted>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[color:var(--fg)]">
                    {s.title || `Séance ${s.session_order + 1}`}
                  </p>
                  <p className="truncate text-[11px] text-[color:var(--muted)]">
                    {s.program_title || 'Programme'}
                    {s.week_title ? ` · ${s.week_title}` : ` · S${s.week_order + 1}`}
                    {mode === 'coach' ? ` · ${coachDisplayName(s.owner)}` : ''}
                  </p>
                </div>
                <Button
                  href={`/admin/preview/${s.program_id}?mode=${mode}`}
                  variant="secondary"
                  size="sm"
                >
                  Preview
                </Button>
                {mode === 'trainly' ? (
                  <Button href={`/admin/programs/${s.program_id}`} variant="secondary" size="sm">
                    Éditer
                  </Button>
                ) : (
                  <Link
                    href={`/admin/coaches/${s.coach_id}`}
                    className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                  >
                    Coach
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-[color:var(--muted)]">
        Astuce : la preview ouvre le <strong>programme parent</strong> en vue client (téléphone).
        {mode === 'trainly' ? (
          <>
            {' '}
            Création séances = via{' '}
            <Link href="/admin/programs" className="font-semibold text-[var(--brand)] underline">
              Programmes Trainly
            </Link>
            .
          </>
        ) : null}
      </p>
    </main>
  )
}
