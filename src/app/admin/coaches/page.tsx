import Link from 'next/link'

import { PageTitle, Muted, Button } from '@/src/components/ui'
import { formatBytes } from '../../../lib/drive/drive'
import { listAdminCoaches, statusLabel, type AdminCoachFilter } from '../../../lib/admin/listAdminCoaches'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?: Promise<{ filter?: string; q?: string }> | { filter?: string; q?: string }
}

const FILTERS: { id: AdminCoachFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'trial', label: 'Essai' },
  { id: 'payant', label: 'Payant' },
  { id: 'past_due', label: 'Past due' },
  { id: 'expired', label: 'Essai expiré' },
  { id: 'suspended', label: 'Suspendus' },
]

function parseFilter(raw?: string): AdminCoachFilter {
  if (raw && FILTERS.some((f) => f.id === raw)) return raw as AdminCoachFilter
  return 'all'
}

export default async function AdminCoachesPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()
  const filter = parseFilter(q.filter)
  const query = String(q.q ?? '')

  const { rows, error } = await listAdminCoaches(supabase as never, { filter, q: query })

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Coaches</PageTitle>
        <Muted className="mt-1">
          {rows.length} compte{rows.length === 1 ? '' : 's'}
          {filter !== 'all' ? ` · filtre ${filter}` : ''}
        </Muted>
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={query}
          placeholder="Recherche nom, email, slug…"
          className="min-w-[14rem] flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none ring-[var(--brand)] focus:ring-2"
        />
        <Button type="submit" size="sm">
          Filtrer
        </Button>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.id
          const href =
            f.id === 'all'
              ? query
                ? `/admin/coaches?q=${encodeURIComponent(query)}`
                : '/admin/coaches'
              : `/admin/coaches?filter=${f.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`
          return (
            <Link
              key={f.id}
              href={href}
              className={
                active
                  ? 'rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-[var(--brand-fg)]'
                  : 'rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
              }
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
          <p className="mt-1 text-xs">
            Si colonnes manquantes : exécute <code>34_admin_coaches_ops.sql</code> +{' '}
          <code>38_coach_workspace_repair.sql</code>.
          </p>
        </div>
      ) : null}

      {!rows.length && !error ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          Aucun coach pour ce filtre.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-[var(--border)] last:border-b-0">
              <Link
                href={`/admin/coaches/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--accent)]"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--brand)]">
                    {r.full_name || r.email || r.id.slice(0, 8)}
                    {r.is_staff_coach ? (
                      <span className="ml-2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                        Admin + coach
                      </span>
                    ) : null}
                    {r.suspended_at ? (
                      <span className="ml-2 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--danger)] ring-1 ring-[var(--danger-border)]">
                        Suspendu
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-[color:var(--muted)]">
                    {r.email}
                    {r.slug ? ` · /c/${r.slug}` : ''}
                    {r.created_at ? ` · inscrit ${new Date(r.created_at).toLocaleDateString('fr-FR')}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-2.5 py-1 text-[var(--brand)]">
                    {statusLabel(r.status)}
                    {r.plan_tier ? ` · ${r.plan_tier}` : ''}
                  </span>
                  <span
                    className={
                      r.environment === 'sandbox'
                        ? 'rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[var(--warning)] ring-1 ring-[var(--warning-border)]'
                        : r.environment === 'prod'
                          ? 'rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[var(--success)] ring-1 ring-[var(--success-border)]'
                          : 'text-[color:var(--muted)]'
                    }
                  >
                    {r.environment === 'sandbox' ? 'Sandbox' : r.environment === 'prod' ? 'Prod' : '—'}
                  </span>
                  <span className="text-[color:var(--muted)]">{r.client_count} client(s)</span>
                  <span
                    className={r.storage_pct >= 80 ? 'text-[var(--warning)]' : 'text-[color:var(--muted)]'}
                    title={`${formatBytes(r.storage_used_bytes)} / ${r.storage_quota_go} Go`}
                  >
                    Stockage {r.storage_pct}%
                  </span>
                  {r.open_tickets > 0 ? (
                    <span className="rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[var(--warning)] ring-1 ring-[var(--warning-border)]">
                      {r.open_tickets} SAV
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
