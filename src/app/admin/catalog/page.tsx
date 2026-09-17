import Link from 'next/link'

import { PageTitle, Muted, SectionTitle } from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

export default async function AdminCatalogPage() {
  const { supabase } = await requirePlatformAdmin()

  const [progDraft, progReview, progPublished, exoDraft, exoPublished, blockDraft, blockPublished] =
    await Promise.all([
      supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .eq('catalog_status', 'draft')
        .eq('is_template', false),
      supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .eq('catalog_status', 'review')
        .eq('is_template', false),
      supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .eq('catalog_status', 'published')
        .eq('is_template', false),
      supabase
        .from('exercise_library')
        .select('id', { count: 'exact', head: true })
        .is('coach_id', null)
        .eq('status', 'draft')
        .is('deleted_at', null),
      supabase
        .from('exercise_library')
        .select('id', { count: 'exact', head: true })
        .is('coach_id', null)
        .eq('status', 'published')
        .is('deleted_at', null),
      supabase
        .from('block_library' as never)
        .select('id', { count: 'exact', head: true })
        .is('coach_id' as never, null)
        .eq('status' as never, 'draft')
        .is('deleted_at' as never, null),
      supabase
        .from('block_library' as never)
        .select('id', { count: 'exact', head: true })
        .is('coach_id' as never, null)
        .eq('status' as never, 'published')
        .is('deleted_at' as never, null),
    ])

  const migrationPending = Boolean(
    progDraft.error || progReview.error || progPublished.error || exoDraft.error,
  )
  const blocksReady = !blockDraft.error && !blockPublished.error

  const builders = [
    {
      href: '/admin/programs',
      title: 'Programmes & séances',
      desc: 'Hub toggle Programmes / Séances · templates séance (blocs + exos)',
      meta: migrationPending
        ? null
        : `${progDraft.count ?? 0} prog brouillon · ${progReview.count ?? 0} review · ${progPublished.count ?? 0} publiés`,
    },
    {
      href: '/admin/exercises',
      title: 'Exercices & blocs',
      desc: 'Fiches exos + templates bloc (même hub · toggle Exercices / Blocs)',
      meta: migrationPending
        ? null
        : blocksReady
          ? `${exoDraft.count ?? 0} exo brouillon · ${exoPublished.count ?? 0} exo publiés · ${blockDraft.count ?? 0} bloc brouillon · ${blockPublished.count ?? 0} bloc publiés`
          : `${exoDraft.count ?? 0} brouillon · ${exoPublished.count ?? 0} publiés (blocs : migration 43+)`,
    },
    {
      href: '/admin/catalog/nutrition',
      title: 'Nutrition',
      desc: 'Trainly à venir · Coach = recettes / plans (preview)',
      meta: 'Hub V1',
    },
  ]

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <PageTitle>Catalogue Trainly</PageTitle>
        <Muted className="mt-1">
          Catalogue plateforme Trainly (publish). Dans chaque section, bascule <strong>Coach</strong> pour
          explorer les bibliothèques coaches en lecture seule (filtre titre + coach).
        </Muted>
      </div>

      {migrationPending ? (
        <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-sm text-[color:var(--muted)]">
          Colonnes workflow absentes — exécute{' '}
          <code className="text-[color:var(--fg)]">36_catalog_workflow.sql</code> dans Supabase.
        </p>
      ) : null}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
        <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
          Sections
        </SectionTitle>
        <ul className="mt-4 grid gap-2">
          {builders.map((b) => (
            <li key={b.href}>
              <Link
                href={b.href}
                className="block rounded-xl border border-[var(--border)] px-4 py-3 hover:bg-[var(--accent)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-bold text-[color:var(--brand)]">{b.title}</p>
                  {b.meta ? (
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">{b.meta}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-[color:var(--muted)]">{b.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
