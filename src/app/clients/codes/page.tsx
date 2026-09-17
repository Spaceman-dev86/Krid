import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { ClientsSubnav } from '../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { CopyCodeButton } from '../../../components/coach/CopyCodeButton'
import { CreateAccessCodeForm } from '../../../components/coach/CreateAccessCodeForm'
import { CreatePromoCodeForm } from '../../../components/coach/CreatePromoCodeForm'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { formatPriceCents } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { revokeCodeAction } from './actions'

export const dynamic = 'force-dynamic'

function formatWhen(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: string, expiresAt: string | null, used: number, maxUses: number | null) {
  if (status === 'revoked') return 'Révoqué'
  if (status === 'exhausted') return 'Épuisé'
  if (status === 'expired') return 'Expiré'
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return 'Expiré'
  if (maxUses != null && used >= maxUses) return 'Épuisé'
  return 'Actif'
}

export default async function ClientsCodesPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; created?: string; revoked?: string }>
    | { error?: string; created?: string; revoked?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const [{ data: prestations }, { data: clients }, { data: groups }, { data: codes, error: codesError }] =
    await Promise.all([
      supabase
        .from('prestations')
        .select('id, name, price_cents, pricing_type, status')
        .eq('coach_id', user.id)
        .is('deleted_at', null)
        .neq('status', 'archived')
        .order('name'),
      supabase
        .from('clients')
        .select('id, email, first_name, last_name')
        .eq('coach_id', user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_groups')
        .select('id, name')
        .eq('coach_id', user.id)
        .eq('type', 'manual')
        .order('name'),
      supabase
        .from('coach_codes')
        .select(
          'id, type, code, prestation_id, amount_cents, percent_off, prestation_ids, audience, expires_at, max_uses, used_count, status, created_at'
        )
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  const prestaName = new Map((prestations ?? []).map((p) => [p.id, p.name]))
  const clientOpts = (clients ?? []).map((c) => {
    const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
    return { id: c.id, label: n || c.email }
  })

  const tableMissing =
    codesError && /relation|does not exist|coach_codes/i.test(codesError.message)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Codes" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Clients</PageTitle>
            <Muted className="mt-1">Codes d’accès cash (24 h) et codes promo showroom</Muted>
          </div>
          <ClientsSubnav />
        </div>

        {tableMissing ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Table <code className="font-mono">coach_codes</code> absente — exécute la tranche SQL{' '}
            <code className="font-mono">29_coach_codes.sql</code> puis recharge.
          </div>
        ) : null}

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error}
          </div>
        ) : null}
        {params.created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Code créé : <strong className="font-mono">{params.created}</strong>
            <span className="ml-2 inline-block align-middle">
              <CopyCodeButton code={params.created} />
            </span>
          </div>
        ) : null}
        {params.revoked ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Code révoqué.
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Code d’accès (cash)
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            1 usage · 24 h · 1 presta · saisie au checkout showroom
          </p>
          <div className="mt-4">
            <CreateAccessCodeForm
              prestations={(prestations ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                price_cents: p.price_cents,
                pricing_type: p.pricing_type,
              }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
            Code promo
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Remise % · audience · durée et/ou max uses
          </p>
          <CreatePromoCodeForm
            prestations={(prestations ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              price_cents: p.price_cents,
            }))}
            clients={clientOpts}
            groups={(groups ?? []).map((g) => ({ id: g.id, name: g.name }))}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
              Liste récente
            </h2>
          </div>
          {!codes?.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucun code pour l’instant.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {codes.map((row) => {
                const label = statusLabel(row.status, row.expires_at, row.used_count, row.max_uses)
                const active = label === 'Actif'
                const prestaLabel =
                  row.type === 'access'
                    ? prestaName.get(row.prestation_id ?? '') ?? 'Presta'
                    : (row.prestation_ids ?? [])
                        .map((id: string) => prestaName.get(id) ?? id.slice(0, 6))
                        .join(', ')

                return (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[color:var(--brand)]">{row.code}</span>
                        <CopyCodeButton code={row.code} />
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                          {row.type === 'access' ? 'Accès' : 'Promo'}
                        </span>
                        <span
                          className={
                            active
                              ? 'text-xs font-semibold text-emerald-700'
                              : 'text-xs font-semibold text-[color:var(--muted)]'
                          }
                        >
                          {label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">
                        {row.type === 'access' ? (
                          <>
                            {prestaLabel} · {formatPriceCents(row.amount_cents ?? 0)} reçu
                          </>
                        ) : (
                          <>
                            −{row.percent_off}% · {prestaLabel || '—'} · audience {row.audience}
                          </>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted)]">
                        Créé {formatWhen(row.created_at)}
                        {row.expires_at ? ` · expire ${formatWhen(row.expires_at)}` : null}
                        {row.max_uses != null
                          ? ` · ${row.used_count}/${row.max_uses} uses`
                          : row.used_count
                            ? ` · ${row.used_count} use(s)`
                            : null}
                      </p>
                    </div>
                    {active ? (
                      <form action={revokeCodeAction}>
                        <input type="hidden" name="code_id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)]"
                        >
                          Révoquer
                        </button>
                      </form>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
