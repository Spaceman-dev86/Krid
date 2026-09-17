import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { Button, PageTitle } from '@/src/components/ui'
import { ClientsSubnav } from '../../../components/coach/ClientsSubnav'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { GrantPrestationDialog } from '../../../components/coach/GrantPrestationDialog'
import { InviteLinkBox } from '../../../components/coach/InviteLinkBox'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { parseModules } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../lib/supabase/serviceRole'
import { endClientGrantAction } from '../../payments/actions'
import { createClientInviteAction, unlinkClientAuthAction } from '../invite-actions'
import { archiveClientAction, updateClientAction } from '../actions'
import { assignProgramToClientAction } from '../../programs/actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{
        error?: string
        saved?: string
        created?: string
        granted?: string
        ended?: string
        invited?: string
        token?: string
        unlinked?: string
        assigned?: string
      }>
    | {
        error?: string
        saved?: string
        created?: string
        granted?: string
        ended?: string
        invited?: string
        token?: string
        unlinked?: string
        assigned?: string
      }
}

export default async function ClientDetailPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) notFound()

  const title = [client.first_name, client.last_name].filter(Boolean).join(' ').trim() || client.email

  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || 'http'
  const origin = `${proto}://${host}`
  const inviteUrl = q.token ? `${origin}/invite/${q.token}` : null

  const showroomSlug = shell.branding?.slug ?? null

  let linkedAuthEmail: string | null = null
  if (client.user_id) {
    const admin = createServiceRoleClient()
    if (admin) {
      const { data: linkedProfile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', client.user_id)
        .maybeSingle()
      linkedAuthEmail = linkedProfile?.email ?? null
    }
  }

  const { data: grants } = await supabase
    .from('client_grants')
    .select('id, status, modules, starts_at, ends_at, prestation_id, prestations(name)')
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: endedGrants } = await supabase
    .from('client_grants')
    .select('id, status, modules, ends_at, prestations(name)')
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .eq('status', 'ended')
    .order('ends_at', { ascending: false })
    .limit(10)

  const { data: prestations } = await supabase
    .from('prestations')
    .select('id, name, status, pricing_type, price_cents')
    .eq('coach_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const { data: paidLedger } = await supabase
    .from('payment_ledger')
    .select('prestation_id, period_ym')
    .eq('coach_id', user.id)
    .eq('client_id', id)
    .eq('status', 'paid')

  const { data: fitnessPlans } = await supabase
    .from('client_fitness_plans')
    .select('id, status, start_date, created_at, source_program_id, programs(title)')
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  const { data: assignablePrograms } = await supabase
    .from('programs')
    .select('id, title, is_template')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Client" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-2xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/clients" className="text-xs font-semibold text-[color-mix(in_srgb,var(--brand)_70%,transparent)] hover:underline">
              ← Clients
            </Link>
            <PageTitle className="mt-2 text-2xl">{title}</PageTitle>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Fiche client · invitation / claim auth plus tard</p>
          </div>
          <ClientsSubnav />
        </div>

        {q.assigned ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Programme envoyé (statut En attente — le client démarre côté portail).
          </div>
        ) : null}
        {q.created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Client créé.
          </div>
        ) : null}
        {q.saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Enregistré.
          </div>
        ) : null}
        {q.granted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Accès accordé (ledger Payé + grant actif).
          </div>
        ) : null}
        {q.ended ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Grant terminé.
          </div>
        ) : null}
        {q.error === 'already_linked' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Ce client a déjà un compte lié.
          </div>
        ) : null}
        {q.error && q.error !== 'already_linked' && q.error !== 'email' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{q.error}</div>
        ) : null}
        {q.error === 'email' ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Email invalide.
          </div>
        ) : null}
        {inviteUrl ? <InviteLinkBox url={inviteUrl} /> : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Invitation</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Génère un lien (30 j). Le client ouvre ce lien, crée son mot de passe, puis est
            rattaché à ta fiche.
            {showroomSlug ? (
              <>
                {' '}
                Showroom :{' '}
                <Link href={`/c/${showroomSlug}/showroom`} className="font-semibold underline">
                  /c/{showroomSlug}/showroom
                </Link>
              </>
            ) : (
              <> Renseigne un slug branding sur /home pour le showroom.</>
            )}
          </p>
          {client.user_id ? (
            <div className="mt-3 grid gap-2">
              <p className="text-sm font-semibold text-emerald-800">
                Compte lié
                {linkedAuthEmail ? (
                  <>
                    {' '}
                    · auth : <strong>{linkedAuthEmail}</strong>
                    {linkedAuthEmail.toLowerCase() !== client.email.toLowerCase() ? (
                      <span className="text-amber-800"> (≠ email fiche {client.email})</span>
                    ) : null}
                  </>
                ) : null}
              </p>
              <form action={unlinkClientAuthAction}>
                <input type="hidden" name="client_id" value={client.id} />
                <button
                  type="submit"
                  className="text-sm font-semibold text-amber-800 underline"
                >
                  Délier le compte auth
                </button>
              </form>
            </div>
          ) : (
            <form action={createClientInviteAction} className="mt-3">
              <input type="hidden" name="client_id" value={client.id} />
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Générer un lien d’invitation</Button>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <form action={updateClientAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={client.id} />
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Email *</span>
              <input
                name="email"
                type="email"
                required
                defaultValue={client.email}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Prénom</span>
              <input
                name="first_name"
                defaultValue={client.first_name ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Nom</span>
              <input
                name="last_name"
                defaultValue={client.last_name ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Téléphone</span>
              <input
                name="phone"
                defaultValue={client.phone ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Sexe</span>
              <select
                name="sex"
                defaultValue={client.sex ?? ''}
                className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-10 text-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '12px 8px',
                }}
              >
                <option value="">—</option>
                <option value="F">Femme</option>
                <option value="M">Homme</option>
                <option value="X">Autre</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Date de naissance</span>
              <input
                type="date"
                name="birth_date"
                defaultValue={client.birth_date ?? ''}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-semibold">Statut</span>
              <select
                name="status"
                defaultValue={client.status}
                className="w-full appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-3 pr-10 text-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '12px 8px',
                }}
              >
                <option value="invited">Invité</option>
                <option value="active">Actif</option>
                <option value="archived">Archivé</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold">Enregistrer</Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Accès (grants)</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Accorder = ledger manuel Payé + grant. Achat ≠ démarrage programme.
          </p>

          {!grants?.length ? (
            <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun accès actif.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {grants.map((g) => {
                const presta = g.prestations as { name?: string } | { name?: string }[] | null
                const prestaName = Array.isArray(presta) ? presta[0]?.name : presta?.name
                const mods = parseModules(g.modules)
                return (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-semibold text-[color:var(--brand)]">{prestaName ?? 'Prestation'}</p>
                      <p className="text-xs text-[color:var(--muted)]">
                        Actif
                        {mods.length ? ` · ${mods.join(', ')}` : ''}
                      </p>
                    </div>
                    <form action={endClientGrantAction}>
                      <input type="hidden" name="grant_id" value={g.id} />
                      <input type="hidden" name="client_id" value={client.id} />
                      <button type="submit" className="text-xs font-semibold text-red-600 hover:underline">
                        Terminer
                      </button>
                    </form>
                  </li>
                )
              })}
            </ul>
          )}

          {endedGrants?.length ? (
            <details className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--accent)] px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-[color:var(--muted)]">
                Historique ({endedGrants.length} terminé{endedGrants.length > 1 ? 's' : ''})
              </summary>
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {endedGrants.map((g) => {
                  const presta = g.prestations as { name?: string } | { name?: string }[] | null
                  const prestaName = Array.isArray(presta) ? presta[0]?.name : presta?.name
                  return (
                    <li key={g.id} className="py-2 text-xs text-[color:var(--muted)]">
                      {prestaName ?? 'Prestation'}
                      {g.ends_at
                        ? ` · terminé le ${new Date(g.ends_at).toLocaleDateString('fr-FR')}`
                        : ' · terminé'}
                    </li>
                  )
                })}
              </ul>
            </details>
          ) : null}

          {(prestations ?? []).length ? (
            <GrantPrestationDialog
              clientId={client.id}
              clientLabel={title}
              returnTo={`/clients/${client.id}`}
              prestations={(prestations ?? []).map((p) => ({
                id: p.id,
                name: p.name,
                pricing_type: p.pricing_type ?? 'unique',
                price_cents: p.price_cents ?? 0,
              }))}
              alreadyPaid={(paidLedger ?? []).map((r) => ({
                prestation_id: r.prestation_id,
                period_ym: r.period_ym,
              }))}
            />
          ) : (
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Crée d’abord une prestation active dans{' '}
              <Link href="/payments/prestations" className="font-semibold underline">
                Comptabilités
              </Link>
              .
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Programme fitness</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Envoyer = plan en <strong>waiting</strong>. Achat ≠ démarrage (le client démarre plus tard).
          </p>

          {!fitnessPlans?.length ? (
            <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun plan envoyé.</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {fitnessPlans.map((plan) => {
                const prog = plan.programs as { title?: string } | { title?: string }[] | null
                const progTitle = Array.isArray(prog) ? prog[0]?.title : prog?.title
                return (
                  <li key={plan.id} className="py-2 text-sm">
                    <p className="font-semibold text-[color:var(--brand)]">{progTitle ?? 'Programme'}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {plan.status}
                      {plan.created_at
                        ? ` · ${new Date(plan.created_at).toLocaleDateString('fr-FR')}`
                        : ''}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}

          <form action={assignProgramToClientAction} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="client_id" value={client.id} />
            <input type="hidden" name="return_to" value={`/clients/${client.id}`} />
            <label className="grid min-w-[200px] flex-1 gap-1 text-sm">
              <span className="font-semibold">Envoyer un programme</span>
              <select name="program_id" required className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <option value="">Choisir…</option>
                {(assignablePrograms ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title?.trim() || 'Sans titre'}
                    {p.is_template ? ' · template' : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={!assignablePrograms?.length} className="!rounded-lg !px-4 !py-2 text-sm font-bold disabled:opacity-40">Envoyer</Button>
          </form>
          {!assignablePrograms?.length ? (
            <p className="mt-2 text-xs text-[color:var(--muted)]">
              Crée un programme dans{' '}
              <Link href="/programs" className="font-semibold underline">
                Programme
              </Link>
              .
            </p>
          ) : null}
        </section>

        <form action={archiveClientAction}>
          <input type="hidden" name="id" value={client.id} />
          <button
            type="submit"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Archiver le client
          </button>
        </form>
      </div>
    </CoachAppShell>
  )
}
