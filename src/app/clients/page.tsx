import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { ClientsSubnav } from '../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'
import { createClientAction } from './actions'

export const dynamic = 'force-dynamic'

function displayName(c: {
  first_name: string | null
  last_name: string | null
  email: string
}) {
  const n = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return n || c.email
}

function statusLabel(status: string) {
  switch (status) {
    case 'invited':
      return 'Invité'
    case 'active':
      return 'Actif'
    case 'archived':
      return 'Archivé'
    default:
      return status
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; archived?: string }> | { error?: string; archived?: string }
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

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, email, first_name, last_name, phone, status, is_demo, created_at')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Clients" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-4xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageTitle className="text-2xl">Clients</PageTitle>
            <Muted className="mt-1">CRM multi-tenant · {clients?.length ?? 0} client{(clients?.length ?? 0) > 1 ? 's' : ''}</Muted>
          </div>
          <ClientsSubnav />
        </div>

        {params.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {params.error === 'email' ? 'Email invalide.' : params.error}
          </div>
        ) : null}
        {params.archived ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Client archivé.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error.message}</div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Ajouter un client</h2>
          <form action={createClientAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Email *</span>
              <input
                name="email"
                type="email"
                required
                placeholder="client@email.com"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Prénom</span>
              <input name="first_name" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Nom</span>
              <input name="last_name" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Téléphone</span>
              <input name="phone" className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Créer</Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
          <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Liste</h2>
          </div>
          {!clients?.length ? (
            <p className="px-5 py-8 text-sm text-[color:var(--muted)]">Aucun client pour l’instant.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clients/${c.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[color:var(--brand)]">{displayName(c)}</p>
                      <p className="truncate text-xs text-[color:var(--muted)]">{c.email}</p>
                    </div>
                    <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                      {statusLabel(c.status)}
                      {c.is_demo ? ' · démo' : ''}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CoachAppShell>
  )
}
