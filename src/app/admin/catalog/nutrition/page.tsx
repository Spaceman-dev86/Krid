import Link from 'next/link'

import { PageTitle, Muted, SectionTitle, Button } from '@/src/components/ui'
import { CatalogBackLink, CatalogScopeToggle } from '@/src/components/admin/CatalogScopeToggle'
import { CatalogLiveSearch } from '@/src/components/admin/CatalogLiveSearch'
import { coachDisplayName, type CoachProfileEmbed } from '../../../../lib/catalog/coachScope'
import { listCatalogCoachOwners } from '../../../../lib/catalog/coachOwners'
import { catalogListHref, parseCatalogMode, sanitizeSearch } from '../../../../lib/catalog/search'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{ mode?: string; q?: string; coach?: string }>
    | { mode?: string; q?: string; coach?: string }
}

type RecipeRow = {
  id: string
  title: string
  kcal: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  notes?: string | null
  coach_id: string
  profiles?: CoachProfileEmbed | null
}

type PlanRow = {
  id: string
  title: string
  status: string
  coach_id: string
  profiles?: CoachProfileEmbed | null
}

export default async function AdminCatalogNutritionPage({ searchParams }: Props) {
  const params = await Promise.resolve(searchParams ?? {})
  const mode = parseCatalogMode(params.mode)
  const search = sanitizeSearch(params.q)
  const coachQ = sanitizeSearch(params.coach)
  const { supabase } = await requirePlatformAdmin()

  let recipes: RecipeRow[] = []
  let plans: PlanRow[] = []
  let error: string | null = null

  if (mode === 'coach') {
    const { owners, error: ownersError } = await listCatalogCoachOwners(supabase, coachQ)
    const byId = new Map(owners.map((p) => [p.id, p]))
    const ownerIds = owners.map((p) => p.id)

    if (ownersError) {
      error = ownersError
    } else if (ownerIds.length) {
      let recipesQuery = supabase
        .from('nutrition_recipes')
        .select('id, title, kcal, protein_g, carbs_g, fat_g, notes, coach_id, created_at')
        .in('coach_id', ownerIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(80)

      let plansQuery = supabase
        .from('nutrition_plans')
        .select('id, title, status, coach_id, created_at')
        .in('coach_id', ownerIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(80)

      if (search) {
        recipesQuery = recipesQuery.ilike('title', `%${search}%`)
        plansQuery = plansQuery.ilike('title', `%${search}%`)
      }

      const [r, p] = await Promise.all([recipesQuery, plansQuery])
      recipes = ((r.data ?? []) as unknown as RecipeRow[]).map((row) => ({
        ...row,
        profiles: (byId.get(row.coach_id) as CoachProfileEmbed) ?? null,
      }))
      plans = ((p.data ?? []) as unknown as PlanRow[]).map((row) => ({
        ...row,
        profiles: (byId.get(row.coach_id) as CoachProfileEmbed) ?? null,
      }))
      error = r.error?.message || p.error?.message || null
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <CatalogBackLink />
        <PageTitle className="mt-2">Nutrition</PageTitle>
        <Muted className="mt-1">
          {mode === 'coach'
            ? 'Plans & recettes coaches — lecture seule (détail déplié).'
            : 'Catalogue Trainly nutrition — publish plateforme à brancher.'}
        </Muted>
      </div>

      <div className="mb-4">
        <CatalogScopeToggle base="/admin/catalog/nutrition" mode={mode} q={search} coach={coachQ} />
      </div>

      {mode === 'trainly' ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
          <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
            Trainly — à venir
          </SectionTitle>
          <p className="mt-3 text-sm text-[color:var(--fg)]">
            Le catalogue plateforme nutrition (création + Brouillon → Review → Publié) arrive ensuite. Passe
            en <strong>Coach</strong> pour preview les biblio existantes.
          </p>
          <Button
            href={catalogListHref('/admin/catalog/nutrition', { mode: 'coach' })}
            size="sm"
            className="mt-4"
          >
            Voir biblio coaches
          </Button>
        </section>
      ) : (
        <>
          <CatalogLiveSearch
            basePath="/admin/catalog/nutrition"
            mode="coach"
            initialQ={search}
            initialCoach={coachQ}
            showCoachFilter
            titlePlaceholder="Rechercher par titre…"
          />

          {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
            <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
              Recettes ({recipes.length})
            </SectionTitle>
            {!recipes.length ? (
              <Muted className="mt-3">Aucune recette pour ces filtres.</Muted>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {recipes.map((r) => (
                  <li key={r.id} className="py-2">
                    <details>
                      <summary className="cursor-pointer list-none">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-semibold text-[color:var(--fg)]">{r.title}</p>
                          <span className="text-[11px] font-bold text-[var(--brand)]">Preview ▾</span>
                        </div>
                        <p className="text-[11px] text-[color:var(--muted)]">
                          {coachDisplayName(r.profiles)}
                          {r.kcal != null ? ` · ${r.kcal} kcal` : ''}
                        </p>
                      </summary>
                      <div className="mt-2 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 text-sm text-[color:var(--fg)] ring-1 ring-[var(--border)]">
                        <dl className="grid gap-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <dt className="text-[color:var(--muted)]">Kcal</dt>
                            <dd className="font-semibold">{r.kcal ?? '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[color:var(--muted)]">Protéines</dt>
                            <dd className="font-semibold">{r.protein_g != null ? `${r.protein_g} g` : '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[color:var(--muted)]">Glucides</dt>
                            <dd className="font-semibold">{r.carbs_g != null ? `${r.carbs_g} g` : '—'}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt className="text-[color:var(--muted)]">Lipides</dt>
                            <dd className="font-semibold">{r.fat_g != null ? `${r.fat_g} g` : '—'}</dd>
                          </div>
                        </dl>
                        {r.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs text-[color:var(--muted)]">{r.notes}</p>
                        ) : null}
                        {r.coach_id ? (
                          <Link
                            href={`/admin/coaches/${r.coach_id}`}
                            className="mt-2 inline-block text-xs font-semibold text-[var(--brand)] hover:underline"
                          >
                            Fiche coach →
                          </Link>
                        ) : null}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm">
            <SectionTitle className="text-sm uppercase tracking-wide text-[color:var(--muted)]">
              Plans ({plans.length})
            </SectionTitle>
            {!plans.length ? (
              <Muted className="mt-3">Aucun plan pour ces filtres.</Muted>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--border)]">
                {plans.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--fg)]">{p.title}</p>
                      <p className="text-[11px] text-[color:var(--muted)]">
                        {coachDisplayName(p.profiles)} · {p.status}
                      </p>
                    </div>
                    <Link
                      href={`/admin/coaches/${p.coach_id}`}
                      className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                    >
                      Coach →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  )
}
