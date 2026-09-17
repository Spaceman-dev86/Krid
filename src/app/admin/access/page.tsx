import Link from 'next/link'

import { PageTitle, Muted, SectionTitle } from '@/src/components/ui'
import { TRIAL_DAYS } from '../../../lib/tenancy/ensureCoachTrial'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminAccessPage() {
  const { supabase } = await requirePlatformAdmin()

  const now = new Date()
  const in3 = new Date(now)
  in3.setUTCDate(in3.getUTCDate() + 3)
  const ago7 = new Date(now)
  ago7.setUTCDate(ago7.getUTCDate() - 7)

  const [{ count: trialActive }, { count: expiredTrial }, { data: endingSoon }, { count: staff }] =
    await Promise.all([
      supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial'),
      supabase
        .from('coach_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'expired_trial'),
      supabase
        .from('coach_subscriptions')
        .select('coach_id, trial_ends_at, profiles:coach_id(email, full_name)')
        .eq('status', 'trial')
        .gte('trial_ends_at', now.toISOString())
        .lte('trial_ends_at', in3.toISOString())
        .order('trial_ends_at', { ascending: true })
        .limit(20),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .in('role', ['platform_admin', 'admin'])
        .is('deleted_at', null),
    ])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Accès & essai</PageTitle>
        <Muted className="mt-1">
          Essai coach = {TRIAL_DAYS} jours calendaires dès 1ʳᵉ connexion app. Staff = rôles platform_admin /
          admin.
        </Muted>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/admin/coaches?filter=trial"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
        >
          <p className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">Essais actifs</p>
          <p className="mt-1 text-2xl font-extrabold text-[color:var(--brand)]">{trialActive ?? 0}</p>
        </Link>
        <Link
          href="/admin/coaches?filter=expired"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
        >
          <p className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">Essais expirés</p>
          <p className="mt-1 text-2xl font-extrabold text-[color:var(--brand)]">{expiredTrial ?? 0}</p>
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
          <p className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">Comptes staff</p>
          <p className="mt-1 text-2xl font-extrabold text-[color:var(--brand)]">{staff ?? 0}</p>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          Essais finissant sous 3 jours
        </SectionTitle>
        <Muted className="mt-1">
          Relance = ouvrir un ticket SAV depuis la fiche coach (canal in-app).
        </Muted>
        {!endingSoon?.length ? (
          <p className="mt-4 text-sm text-[color:var(--muted)]">Aucun essai dans cette fenêtre.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {endingSoon.map((row) => {
              const coach = row.profiles as unknown as { email?: string; full_name?: string } | null
              return (
                <li key={row.coach_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link
                      href={`/admin/coaches/${row.coach_id}`}
                      className="font-semibold text-[color:var(--brand)] underline"
                    >
                      {coach?.full_name || coach?.email || row.coach_id.slice(0, 8)}
                    </Link>
                    <p className="text-xs text-[color:var(--muted)]">{coach?.email}</p>
                  </div>
                  <span className="text-xs font-bold text-[color:var(--muted)]">
                    fin {row.trial_ends_at ? new Date(row.trial_ends_at).toLocaleDateString('fr-FR') : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
