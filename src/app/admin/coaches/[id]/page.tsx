import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Button, PageTitle, Muted, SectionTitle, DaBanner } from '@/src/components/ui'
import { CATEGORY_LABEL, STATUS_LABEL } from '../../../../lib/admin/supportLabels'
import {
  environmentForStatus,
  quotaGoForPlan,
  statusLabel,
  type CoachSubStatus,
} from '../../../../lib/admin/listAdminCoaches'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'
import { chatDb } from '../../../../lib/chat/chat'
import { formatBytes } from '../../../../lib/drive/drive'
import { createServiceRoleClient } from '../../../../lib/supabase/serviceRole'
import {
  openAdminSupportTicketAction,
  saveCoachAdminNotesAction,
  sendCoachPasswordResetAction,
  setCoachSuspendedAction,
} from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?: Promise<{ ok?: string; error?: string }> | { ok?: string; error?: string }
}

export default async function AdminCoachDetailPage({ params, searchParams }: Props) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase } = await requirePlatformAdmin()
  const db = chatDb(supabase)

  const { data: coach } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, suspended_at, admin_notes, phone, role, coach_workspace')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!coach) notFound()
  const isCoachRow =
    coach.role === 'coach' || coach.coach_workspace === true || coach.role === 'admin' || coach.role === 'platform_admin'
  if (!isCoachRow) notFound()

  const [{ data: sub }, { data: branding }, { data: clients }, { data: tickets }, { data: driveFiles }, { data: grants }] =
    await Promise.all([
      supabase
        .from('coach_subscriptions')
        .select('*')
        .eq('coach_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('coach_branding').select('slug, app_name, primary_color').eq('coach_id', id).maybeSingle(),
      supabase
        .from('clients')
        .select('id, first_name, last_name, email, status, created_at, is_demo, user_id')
        .eq('coach_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('support_tickets')
        .select('id, subject, status, category, created_at, opened_by')
        .eq('coach_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
      db.from('drive_files').select('size_bytes').eq('coach_id', id).is('deleted_at', null).limit(5000),
      supabase
        .from('client_grants')
        .select('client_id, status, prestations:prestation_id(name)')
        .eq('coach_id', id)
        .limit(500),
    ])

  let usedBytes = 0
  for (const f of driveFiles ?? []) usedBytes += Number(f.size_bytes ?? 0)
  const status = (sub?.status as CoachSubStatus) ?? 'none'
  const env = environmentForStatus(status)
  const quotaGo = quotaGoForPlan(sub?.plan_tier)
  const pct = Math.min(999, Math.round((usedBytes / (quotaGo * 1024 * 1024 * 1024)) * 1000) / 10)

  const grantsByClient = new Map<string, string[]>()
  for (const g of grants ?? []) {
    if (g.status && g.status !== 'active') continue
    const presta = g.prestations as unknown as { name?: string } | null
    const name = presta?.name || 'Prestation'
    const list = grantsByClient.get(g.client_id) ?? []
    list.push(name)
    grantsByClient.set(g.client_id, list)
  }

  let lastSignIn: string | null = null
  const service = createServiceRoleClient()
  if (service) {
    const { data } = await service.auth.admin.getUserById(id)
    lastSignIn = data.user?.last_sign_in_at ?? null
  }

  const suspended = Boolean(coach.suspended_at)

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <Link href="/admin/coaches" className="text-sm font-semibold text-[color:var(--brand)] hover:underline">
        ← Coaches
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageTitle>{coach.full_name || coach.email || 'Coach'}</PageTitle>
          <Muted className="mt-1">
            {coach.email}
            {branding?.slug ? (
              <>
                {' '}
                ·{' '}
                <Link href={`/c/${branding.slug}/showroom`} className="underline">
                  /c/{branding.slug}
                </Link>
              </>
            ) : null}
            {suspended ? (
              <span className="ml-2 rounded-full bg-[var(--danger-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--danger)] ring-1 ring-[var(--danger-border)]">
                Suspendu
              </span>
            ) : null}
            {env !== '—' ? (
              <span
                className={
                  env === 'sandbox'
                    ? 'ml-2 rounded-full bg-[var(--warning-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--warning)] ring-1 ring-[var(--warning-border)]'
                    : 'ml-2 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[11px] font-bold text-[var(--success)] ring-1 ring-[var(--success-border)]'
                }
              >
                {env === 'sandbox' ? 'Sandbox' : 'Prod'}
              </span>
            ) : null}
          </Muted>
        </div>
      </div>

      {q.ok ? (
        <DaBanner tone="success" className="mt-4">
          {q.ok === 'notes'
            ? 'Notes enregistrées.'
            : q.ok === 'suspend'
              ? 'Compte suspendu + ticket SAV ouvert.'
              : q.ok === 'unsuspend'
                ? 'Suspension levée.'
                : q.ok === 'reset'
                  ? 'E-mail reset MDP envoyé + ticket SAV.'
                  : 'OK'}
        </DaBanner>
      ) : null}
      {q.error ? (
        <DaBanner tone="danger" className="mt-4">
          {q.error}
        </DaBanner>
      ) : null}

      <section className="mt-6 grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm sm:grid-cols-2">
        <div>
          <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Abonnement</SectionTitle>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Statut</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{statusLabel(status)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Plan</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{sub?.plan_tier ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Fin essai</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString('fr-FR') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">App</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{branding?.app_name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Stockage</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {formatBytes(usedBytes)} / {quotaGo} Go ({pct}%)
              </dd>
            </div>
          </dl>
        </div>
        <div>
          <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Compte</SectionTitle>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Inscription</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {coach.created_at ? new Date(coach.created_at).toLocaleDateString('fr-FR') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Dernier login</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {lastSignIn ? new Date(lastSignIn).toLocaleString('fr-FR') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">Téléphone</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{coach.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[color:var(--muted)]">ID</dt>
              <dd className="truncate font-mono text-xs text-[color:var(--muted)]">{coach.id}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-6 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Actions</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <form action={setCoachSuspendedAction}>
            <input type="hidden" name="coach_id" value={coach.id} />
            <input type="hidden" name="next" value={suspended ? 'unsuspend' : 'suspend'} />
            <Button type="submit" variant={suspended ? 'secondary' : undefined} size="sm">
              {suspended ? 'Lever la suspension' : 'Suspendre le compte'}
            </Button>
          </form>
          <form action={sendCoachPasswordResetAction}>
            <input type="hidden" name="coach_id" value={coach.id} />
            <Button type="submit" variant="secondary" size="sm">
              Envoyer reset MDP
            </Button>
          </form>
          <Button href={`/admin/sav?coach=${coach.id}`} variant="secondary" size="sm">
            Voir SAV
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Notes internes</SectionTitle>
        <form action={saveCoachAdminNotesAction} className="mt-3 grid gap-3">
          <input type="hidden" name="coach_id" value={coach.id} />
          <textarea
            name="admin_notes"
            rows={4}
            defaultValue={coach.admin_notes ?? ''}
            placeholder="Visible admin seulement…"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm text-[color:var(--fg)]"
          />
          <Button type="submit" size="sm" className="justify-self-start">
            Enregistrer
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Contacter (SAV)</SectionTitle>
        <Muted className="mt-1">Ouvre un ticket in-app visible par le coach dans Aide.</Muted>
        <form action={openAdminSupportTicketAction} className="mt-3 grid gap-3">
          <input type="hidden" name="coach_id" value={coach.id} />
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Catégorie
            <select
              name="category"
              defaultValue="compte"
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm font-normal"
            >
              <option value="compte">Compte</option>
              <option value="billing">Billing</option>
              <option value="produit">Produit</option>
              <option value="bug">Bug</option>
              <option value="autre">Autre</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Sujet
            <input
              name="subject"
              required
              minLength={3}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
            Message
            <textarea
              name="body"
              required
              rows={3}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm font-normal"
            />
          </label>
          <Button type="submit" size="sm" className="justify-self-start">
            Ouvrir le ticket
          </Button>
        </form>
      </section>

      <section className="mt-6">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">Tickets SAV</SectionTitle>
        {!tickets?.length ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">Aucun ticket.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            {tickets.map((t) => (
              <li key={t.id} className="border-b border-[var(--border)] last:border-b-0">
                <Link
                  href={`/admin/sav/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-[var(--accent)]"
                >
                  <div>
                    <p className="font-semibold text-[var(--brand)]">{t.subject}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {CATEGORY_LABEL[t.category] || t.category}
                      {t.opened_by === 'admin' ? ' · ouvert par admin' : ''} ·{' '}
                      {new Date(t.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand)]">
                    {STATUS_LABEL[t.status] || t.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          Clients (lecture seule)
        </SectionTitle>
        {!clients?.length ? (
          <p className="mt-2 text-sm text-[color:var(--muted)]">Aucun client.</p>
        ) : (
          <ul className="mt-2 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]">
            {clients.map((c) => {
              const prestas = grantsByClient.get(c.id) ?? []
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[color:var(--fg)]">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ') || 'Sans nom'}
                      {c.is_demo ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-[var(--warning)]">Démo</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {c.email ?? '—'}
                      {prestas.length ? ` · ${prestas.slice(0, 3).join(', ')}${prestas.length > 3 ? '…' : ''}` : ''}
                      {c.user_id ? ' · compte lié' : ' · pas encore connecté'}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-[color:var(--muted)]">{c.status}</span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
