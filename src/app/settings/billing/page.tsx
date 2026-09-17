import { redirect } from 'next/navigation'

import {
  PageTitle,
  Muted,
  Eyebrow,
  Button,
  DaBanner,
} from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { SettingsSubnav } from '../../../components/coach/SettingsSubnav'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { createClient } from '../../../lib/supabase/server'
import { isTrialExpired, trialDaysRemaining, TRIAL_DAYS } from '../../../lib/tenancy/ensureCoachTrial'

export const dynamic = 'force-dynamic'

const PLANS = [
  { id: 'starter', label: 'Starter', storage: '5 Go', blurb: 'Solo · essai & démarrage' },
  { id: 'business', label: 'Business', storage: '25 Go', blurb: 'Cabinet · usage courant' },
  { id: 'scale', label: 'Scale', storage: '100 Go', blurb: 'Volume · équipe' },
  { id: 'studio', label: 'Studio', storage: 'Sur devis', blurb: 'Sur-mesure · 500 Go+' },
] as const

const STATUS_LABEL: Record<string, string> = {
  trial: 'Essai',
  active: 'Actif',
  past_due: 'Paiement en échec',
  expired_trial: 'Essai terminé',
  canceled: 'Résilié',
}

export default async function SettingsBillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const sub = shell.subscription
  const days = trialDaysRemaining(sub)
  const expired = isTrialExpired(sub)
  const currentTier = (sub?.plan_tier || 'business').toLowerCase()
  const statusKey = (sub?.status || '').toLowerCase()
  const statusLabel = STATUS_LABEL[statusKey] ?? sub?.status ?? '—'

  return (
    <CoachAppShell
      appName={shell.branding?.app_name}
      trialLabel={shell.trialLabel}
      title="Abonnement"
      savUnread={shell.savUnread}
    >
      <div className="mx-auto grid max-w-xl gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Eyebrow>Plateforme</Eyebrow>
            <PageTitle className="mt-2 text-2xl">Abonnement Trainly</PageTitle>
            <Muted className="mt-1">SaaS plateforme · ≠ paiements de tes clients</Muted>
          </div>
          <SettingsSubnav savUnread={shell.savUnread} />
        </div>

        {expired ? (
          <DaBanner tone="warning">
            Essai terminé — choisis un plan pour retrouver l’accès métier complet.
          </DaBanner>
        ) : null}
        {statusKey === 'past_due' ? (
          <DaBanner tone="danger">Paiement en échec — mets à jour ton moyen de paiement dès que Checkout sera branché.</DaBanner>
        ) : null}

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>État actuel</Eyebrow>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[color:var(--muted)]">Statut</dt>
              <dd className="text-base font-extrabold text-[var(--brand)]">{statusLabel}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--muted)]">Plan</dt>
              <dd className="text-base font-extrabold capitalize text-[color:var(--fg)]">
                {sub?.plan_tier ?? '—'}
              </dd>
            </div>
            {statusKey === 'trial' && days != null ? (
              <div>
                <dt className="text-[color:var(--muted)]">Essai ({TRIAL_DAYS} j)</dt>
                <dd className="font-semibold text-[color:var(--fg)]">
                  {days} jour{days === 1 ? '' : 's'} restants
                </dd>
              </div>
            ) : null}
            {sub?.trial_ends_at ? (
              <div>
                <dt className="text-[color:var(--muted)]">Fin d’essai</dt>
                <dd className="font-semibold text-[color:var(--fg)]">
                  {new Date(sub.trial_ends_at).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            ) : null}
            {sub?.current_period_end ? (
              <div>
                <dt className="text-[color:var(--muted)]">Prochaine échéance</dt>
                <dd className="font-semibold text-[color:var(--fg)]">
                  {new Date(sub.current_period_end).toLocaleDateString('fr-FR')}
                </dd>
              </div>
            ) : null}
          </dl>
          <Button href="/settings/storage" variant="secondary" size="sm" className="mt-4">
            Voir le stockage inclus
          </Button>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <Eyebrow>Plans</Eyebrow>
          <ul className="mt-3 grid gap-2">
            {PLANS.map((plan) => {
              const active = currentTier === plan.id
              return (
                <li
                  key={plan.id}
                  className={
                    active
                      ? 'flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--brand)_40%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] px-4 py-3'
                      : 'flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-4 py-3'
                  }
                >
                  <div>
                    <p className="font-bold text-[color:var(--fg)]">{plan.label}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {plan.blurb} · stockage {plan.storage}
                    </p>
                  </div>
                  {active ? (
                    <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand-fg)]">
                      Actuel
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <DaBanner tone="warning" className="mt-4">
            Stripe Checkout / portail client : prochain branchement. Compte Stripe gratuit à créer ; frais uniquement
            au paiement réussi.
          </DaBanner>
          <Button type="button" size="sm" className="mt-4" disabled>
            Payer / changer de plan (bientôt)
          </Button>
        </section>
      </div>
    </CoachAppShell>
  )
}
