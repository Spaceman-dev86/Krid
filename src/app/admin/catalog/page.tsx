import Link from 'next/link'

import { PageTitle, Muted, Eyebrow, IconCaret } from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

type CatalogSection = {
  href: string
  title: string
  desc: string
  chips: string[]
}

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

  const builders: CatalogSection[] = [
    {
      href: '/admin/programs',
      title: 'Programmes & séances',
      desc: 'Hub toggle Programmes / Séances · templates séance (blocs + exos)',
      chips: migrationPending
        ? []
        : [
            `${progDraft.count ?? 0} brouillon`,
            `${progReview.count ?? 0} review`,
            `${progPublished.count ?? 0} publiés`,
          ],
    },
    {
      href: '/admin/exercises',
      title: 'Exercices & blocs',
      desc: 'Fiches exos + templates bloc (même hub · toggle Exercices / Blocs)',
      chips: migrationPending
        ? []
        : blocksReady
          ? [
              `${exoDraft.count ?? 0} exo brouillon`,
              `${exoPublished.count ?? 0} exo publiés`,
              `${blockDraft.count ?? 0} bloc brouillon`,
              `${blockPublished.count ?? 0} bloc publiés`,
            ]
          : [
              `${exoDraft.count ?? 0} brouillon`,
              `${exoPublished.count ?? 0} publiés`,
              'blocs : migration 43+',
            ],
    },
    {
      href: '/admin/catalog/nutrition',
      title: 'Nutrition',
      desc: 'Trainly à venir · Coach = recettes / plans (preview)',
      chips: ['Hub V1'],
    },
  ]

  return (
    <main className="mx-auto w-full min-w-0 max-w-3xl px-3 py-5 max-[767px]:pb-8 md:px-6 md:py-8">
      <header className="mb-5 min-w-0 md:mb-6">
        <PageTitle className="text-2xl max-[767px]:leading-tight md:text-3xl">
          Catalogue Trainly
        </PageTitle>
        <Muted className="mt-1.5 max-w-2xl text-[13px] max-[767px]:text-[12px] md:text-sm">
          Catalogue plateforme Trainly (publish). Dans chaque section, bascule Coach pour explorer
          les bibliothèques coaches en lecture seule (filtre titre + coach).
        </Muted>
      </header>

      {migrationPending ? (
        <p className="mb-4 break-words rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-[13px] text-[color:var(--muted)] md:text-sm">
          Colonnes workflow absentes — exécute{' '}
          <code className="break-all text-[color:var(--fg)]">36_catalog_workflow.sql</code> dans
          Supabase.
        </p>
      ) : null}

      <section className="min-w-0 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm max-[767px]:p-3 md:p-5">
        <Eyebrow>Sections</Eyebrow>
        <ul className="mt-3 grid gap-2 md:mt-4">
          {builders.map((b) => (
            <li key={b.href} className="min-w-0">
              <Link
                href={b.href}
                className="group flex min-w-0 items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-3 transition hover:border-[var(--brand)]/40 hover:bg-[var(--accent)] max-[767px]:min-h-[3.25rem] md:gap-3 md:px-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-[color:var(--brand)] md:text-base">
                    {b.title}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-snug text-[color:var(--muted)] md:text-sm">
                    {b.desc}
                  </p>
                  {b.chips.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {b.chips.map((chip) => (
                        <span
                          key={chip}
                          className="inline-flex max-w-full truncate rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)] ring-1 ring-[var(--border)] md:text-[11px]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] transition group-hover:bg-[var(--surface)] group-hover:text-[color:var(--fg)] max-[767px]:h-9 max-[767px]:w-9"
                  aria-hidden
                >
                  <IconCaret dir="right" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
