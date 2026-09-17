import Link from 'next/link'

import { PageTitle, SectionTitle, Muted, Eyebrow } from '@/src/components/ui'
import { PRICING_PLANS } from '../../lib/appPricing'
import { requirePlatformAdmin } from '../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

function KpiCard({
  href,
  label,
  value,
  hint,
}: {
  href: string
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Link
      href={href}
      className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm transition hover:border-[color-mix(in_srgb,var(--brand)_35%,transparent)]"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums text-[color:var(--brand)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p> : null}
    </Link>
  )
}

function monthlyPriceForTier(tier: string): number {
  return PRICING_PLANS.find((p) => p.id === tier)?.monthlyPrice ?? 0
}

export default async function AdminOpsPage() {
  const { supabase, profile } = await requirePlatformAdmin()

  const now = new Date()
  const ago7 = new Date(now)
  ago7.setUTCDate(ago7.getUTCDate() - 7)
  const in3 = new Date(now)
  in3.setUTCDate(in3.getUTCDate() + 3)
  const ago7Iso = ago7.toISOString()
  const in3Iso = in3.toISOString()
  const nowIso = now.toISOString()

  const [
    { count: coachesTotal },
    { count: coachesNew7d },
    { count: activePaid },
    { count: trialCount },
    { count: pastDue },
    { count: expiredTrial },
    { count: expiredTrial7d },
    { count: trialEndingSoon },
    { count: convertedProxy },
    { data: activeByPlan },
    { count: savOpen },
    { count: savHot },
    { count: savNew7d },
    { count: drivePublished },
    { count: driveDraft },
    { count: formationPublished },
    { count: formationDraft },
    { count: programsPublished },
    { count: programsDraft },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'coach').is('deleted_at', null),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'coach')
      .is('deleted_at', null)
      .gte('created_at', ago7Iso),
    supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial'),
    supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'past_due'),
    supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired_trial'),
    supabase
      .from('coach_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'expired_trial')
      .gte('trial_ends_at', ago7Iso),
    supabase
      .from('coach_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'trial')
      .gte('trial_ends_at', nowIso)
      .lte('trial_ends_at', in3Iso),
    // Proxy conversion : actifs qui ont eu un essai (trial_ends_at renseigné)
    supabase
      .from('coach_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .not('trial_ends_at', 'is', null),
    supabase.from('coach_subscriptions').select('plan_tier').eq('status', 'active'),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['nouveau', 'en_cours', 'attente_coach']),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .in('status', ['nouveau', 'en_cours']),
    supabase
      .from('support_tickets')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', ago7Iso),
    supabase.from('trainly_drive_library').select('id', { count: 'exact', head: true }).eq('published', true),
    supabase.from('trainly_drive_library').select('id', { count: 'exact', head: true }).eq('published', false),
    supabase.from('trainly_formation_items').select('id', { count: 'exact', head: true }).eq('published', true),
    supabase.from('trainly_formation_items').select('id', { count: 'exact', head: true }).eq('published', false),
    supabase
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .eq('is_template', false),
    supabase
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', false)
      .eq('is_template', false),
  ])

  const planCounts: Record<string, number> = { starter: 0, business: 0, scale: 0, studio: 0 }
  for (const row of activeByPlan ?? []) {
    const tier = (row.plan_tier || '').toLowerCase()
    if (tier in planCounts) planCounts[tier] += 1
  }

  let mrrLocal = 0
  for (const [tier, count] of Object.entries(planCounts)) {
    mrrLocal += count * monthlyPriceForTier(tier)
  }

  const mrrLabel = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(mrrLocal)

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div className="mb-8">
        <PageTitle>Ops</PageTitle>
        <Muted className="mt-1">
          Cockpit plateforme
          {profile.email ? (
            <>
              {' '}
              · <span className="font-medium text-[color:var(--fg)]">{profile.email}</span>
            </>
          ) : null}
        </Muted>
      </div>

      <section>
        <Eyebrow>Coaches</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard href="/admin/coaches" label="Total" value={coachesTotal ?? 0} hint="Rôle coach" />
          <KpiCard
            href="/admin/coaches?filter=payant"
            label="Actifs payants"
            value={activePaid ?? 0}
            hint="Statut active"
          />
          <KpiCard href="/admin/coaches?filter=trial" label="Essai" value={trialCount ?? 0} hint="Statut trial" />
          <KpiCard
            href="/admin/coaches?filter=past_due"
            label="Past due"
            value={pastDue ?? 0}
            hint="Paiement en échec"
          />
          <KpiCard href="/admin/coaches" label="Nouveaux 7j" value={coachesNew7d ?? 0} hint="Inscriptions" />
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow>Essais</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            href="/admin/coaches?filter=trial"
            label="En trial"
            value={trialCount ?? 0}
            hint="Sandbox active"
          />
          <KpiCard
            href="/admin/access"
            label="Fin sous 3 j"
            value={trialEndingSoon ?? 0}
            hint="À surveiller"
          />
          <KpiCard
            href="/admin/coaches?filter=expired"
            label="Expirés 7j"
            value={expiredTrial7d ?? 0}
            hint={`${expiredTrial ?? 0} expired_trial total`}
          />
          <KpiCard
            href="/admin/coaches?filter=payant"
            label="Conv. trial→payant"
            value={convertedProxy ?? 0}
            hint="Proxy : actifs avec essai passé"
          />
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow>SaaS</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            href="/admin/billing"
            label="MRR local"
            value={mrrLabel}
            hint="Estim. tarifs app · pas Stripe"
          />
          {(['starter', 'business', 'scale', 'studio'] as const).map((tier) => (
            <KpiCard
              key={tier}
              href="/admin/billing"
              label={tier}
              value={planCounts[tier]}
              hint={`Actifs · ${monthlyPriceForTier(tier) || '—'}€/mois`}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow>SAV</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <KpiCard href="/admin/sav" label="Ouverts" value={savOpen ?? 0} hint="Tous sauf résolu" />
          <KpiCard href="/admin/sav?status=nouveau" label="À traiter" value={savHot ?? 0} hint="Nouveau + en cours" />
          <KpiCard href="/admin/sav" label="Nouveaux 7j" value={savNew7d ?? 0} hint="Créés cette semaine" />
        </div>
      </section>

      <section className="mt-8">
        <Eyebrow>Catalogue / biblio</Eyebrow>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            href="/admin/programs?view=published"
            label="Programmes publiés"
            value={programsPublished ?? 0}
            hint={`${programsDraft ?? 0} brouillons · workflow live`}
          />
          <KpiCard
            href="/admin/drive-packs?filter=published"
            label="Drive PDF publiés"
            value={drivePublished ?? 0}
            hint={`${driveDraft ?? 0} brouillons`}
          />
          <KpiCard
            href="/admin/formation?filter=published"
            label="Formation publiés"
            value={formationPublished ?? 0}
            hint={`${formationDraft ?? 0} brouillons`}
          />
        </div>
        <Muted className="mt-2 text-xs">
          Catalogue : Brouillon → Review → Publié sur{' '}
          <Link href="/admin/catalog" className="font-semibold text-[var(--brand)]">
            /admin/catalog
          </Link>
          .
        </Muted>
      </section>

      <section className="mt-10">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          Raccourcis
        </SectionTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/admin/sav', title: 'SAV', desc: 'Inbox tickets' },
            { href: '/admin/coaches', title: 'Coaches', desc: 'Liste & fiches' },
            { href: '/admin/billing', title: 'Compta', desc: 'Abo SaaS' },
            { href: '/admin/drive-packs', title: 'Drive', desc: 'Biblio PDF' },
            { href: '/admin/formation', title: 'Formation', desc: 'Contenus RO' },
            { href: '/admin/catalog', title: 'Catalogue', desc: 'Builders' },
            { href: '/admin/access', title: 'Accès', desc: 'Essai · staff' },
            { href: '/admin/design', title: 'Design', desc: 'Verrou DA' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-da-sm hover:border-[color-mix(in_srgb,var(--brand)_35%,transparent)]"
            >
              <p className="font-bold text-[var(--brand)]">{item.title}</p>
              <p className="mt-0.5 text-sm text-[color:var(--muted)]">{item.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
