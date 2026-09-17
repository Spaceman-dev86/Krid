import Link from 'next/link'
import { redirect } from 'next/navigation'

import { PageTitle, Muted, DaBanner } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { createClient } from '../../lib/supabase/server'
import { TRIAL_DAYS } from '../../lib/tenancy/ensureCoachTrial'

export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }> | { error?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!canAccessCoachApp(profile?.role)) {
    redirect('/login')
  }

  const shell = await loadCoachShellContext(user.id)

  const { data: publicProfile } = await supabase
    .from('coach_public_profile')
    .select('public_name')
    .eq('coach_id', user.id)
    .maybeSingle()

  const greetName =
    publicProfile?.public_name?.trim() ||
    profile?.full_name?.trim() ||
    shell.branding?.app_name?.trim() ||
    null

  const subscription = shell.subscription

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <PageTitle className="text-2xl">Bonjour{greetName ? `, ${greetName}` : ''}</PageTitle>
            <Muted className="mt-1">
              Tableau de bord coach
              {profile?.email ? (
                <>
                  {' '}
                  · <span className="font-medium text-[color:var(--fg)]">{profile.email}</span>
                </>
              ) : null}
            </Muted>
          </div>
        </div>

        {shell.trialCreated ? (
          <DaBanner tone="success">
            Essai Business démarré — <strong>{TRIAL_DAYS}</strong> jours calendaires.
          </DaBanner>
        ) : null}

        {shell.trialError ? <DaBanner tone="danger">Essai : {shell.trialError}</DaBanner> : null}

        {params.error ? <DaBanner tone="danger">{params.error}</DaBanner> : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Abonnement</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[color:var(--muted)]">Statut</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{subscription?.status ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted)]">Plan</dt>
              <dd className="font-semibold text-[color:var(--fg)]">{subscription?.plan_tier ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted)]">Début essai</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {subscription?.trial_started_at
                  ? new Date(subscription.trial_started_at).toLocaleDateString('fr-FR')
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted)]">Fin essai</dt>
              <dd className="font-semibold text-[color:var(--fg)]">
                {subscription?.trial_ends_at
                  ? new Date(subscription.trial_ends_at).toLocaleDateString('fr-FR')
                  : '—'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Raccourcis</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            <li>
              <Link href="/profile/mon-app" className="font-semibold text-[color:var(--brand)] hover:underline">
                Mon app
              </Link>
              <span className="text-[color:var(--muted)]"> — branding, onboarding, lien install</span>
            </li>
            <li>
              <Link href="/profile/liens" className="font-semibold text-[color:var(--brand)] hover:underline">
                Liens trackés
              </Link>
              <span className="text-[color:var(--muted)]"> — campagnes &amp; leads</span>
            </li>
            <li>
              <Link href="/profile/prestations" className="font-semibold text-[color:var(--brand)] hover:underline">
                Prestations
              </Link>
              <span className="text-[color:var(--muted)]"> — catalogue showroom</span>
            </li>
            {shell.branding?.slug ? (
              <li>
                <Link
                  href={`/c/${shell.branding.slug}/showroom`}
                  className="font-semibold text-[color:var(--brand)] hover:underline"
                >
                  Voir le showroom
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </CoachAppShell>
  )
}
