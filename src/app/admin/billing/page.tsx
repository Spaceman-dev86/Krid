import Link from 'next/link'

import { PageTitle, Muted, SectionTitle, Button } from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminBillingPage() {
  const { supabase } = await requirePlatformAdmin()

  const [{ count: active }, { count: trial }, { count: pastDue }, { count: canceled }, { data: pastDueRows }] =
    await Promise.all([
      supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'trial'),
      supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'past_due'),
      supabase.from('coach_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'canceled'),
      supabase
        .from('coach_subscriptions')
        .select('coach_id, plan_tier, updated_at, profiles:coach_id(email, full_name)')
        .eq('status', 'past_due')
        .order('updated_at', { ascending: false })
        .limit(30),
    ])

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Comptabilité SaaS</PageTitle>
        <Muted className="mt-1">
          Abo Trainly only (pas GMV Connect). MRR Stripe = prochain branchement — compteurs locaux ci-dessous.
        </Muted>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Actifs', value: active ?? 0, href: '/admin/coaches?filter=payant' },
          { label: 'Essai', value: trial ?? 0, href: '/admin/coaches?filter=trial' },
          { label: 'Past due', value: pastDue ?? 0, href: '/admin/coaches?filter=past_due' },
          { label: 'Annulés', value: canceled ?? 0, href: '/admin/coaches' },
        ].map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
          >
            <p className="text-[11px] font-semibold uppercase text-[color:var(--muted)]">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-[color:var(--brand)]">{c.value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          File past_due
        </SectionTitle>
        <Muted className="mt-1">Relance = ticket SAV catégorie billing depuis la fiche coach.</Muted>
        {!pastDueRows?.length ? (
          <p className="mt-4 text-sm text-[color:var(--muted)]">Aucun abo past_due.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--border)]">
            {pastDueRows.map((row) => {
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
                    <p className="text-xs text-[color:var(--muted)]">
                      {coach?.email} · plan {row.plan_tier}
                    </p>
                  </div>
                  <Button
                    href={`/admin/coaches/${row.coach_id}`}
                    variant="secondary"
                    className="!rounded-lg !px-3 !py-1.5 text-xs"
                  >
                    Relancer
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <p className="mt-6 text-xs text-[color:var(--muted)]">
        MRR / factures Stripe Billing : à brancher quand les webhooks SaaS sont en place.
      </p>
    </main>
  )
}
