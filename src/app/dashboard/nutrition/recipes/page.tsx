import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card, Container } from '../../../../components/marketing'
import { coachDashboardCardClass } from '../../../../lib/coachDashboardUi'
import { createClient } from '../../../../lib/supabase/server'
import StickyHeader from '../StickyHeader'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RecipeRow = {
  id: string
  title: string
  note: string | null
  photo_url: string | null
}

export default async function DashboardNutritionRecipesPage() {
  const supabase = await createClient()

  const { data: recipesRaw } = await supabase
    .from('nutrition_recipes')
    .select('id,title,note,photo_url')
    .order('title', { ascending: true })

  const recipes = (recipesRaw ?? []) as unknown as RecipeRow[]

  if (recipes.length > 0) {
    redirect(`/dashboard/nutrition/recipes/${recipes[0].id}`)
  }

  return (
    <main className="min-h-screen bg-transparent">
      <Container className="py-6 sm:py-10">
        <StickyHeader opaquePageBackdrop>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Page recette</h1>
              <p className="mt-1 text-sm text-black/60">Liste + détail.</p>
            </div>

            <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/nutrition"
                  aria-label="Retour"
                  title="Retour"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] hover:bg-[#f5f5f5]"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                    <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  href="/dashboard/nutrition/recipes/new"
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90"
                >
                  Ajouter une recette
                </Link>
              </div>
            </div>
        </StickyHeader>

        <div className="relative z-0 mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className={`${coachDashboardCardClass} overflow-hidden p-0`}>
            <div className="border-b border-black/10 bg-white px-4 py-3">
              <div className="text-sm font-extrabold text-[#341c44]">Liste de recette</div>
            </div>
            <div className="p-3">
              {recipes.length > 0 ? (
                <div className="max-h-[424px] overflow-y-auto overflow-x-hidden rounded-2xl bg-white ring-1 ring-black/10">
                  {recipes.map((r, idx) => (
                    <Link
                      key={r.id}
                      href={`/dashboard/nutrition/recipes/${r.id}`}
                      className={
                        (idx === 0 ? '' : 'border-t border-black/10 ') +
                        'flex min-w-0 items-center justify-between px-3 py-3 text-left text-sm font-extrabold text-[#341c44] hover:bg-[#f5f5f5]'
                      }
                    >
                      <span className="min-w-0 truncate">{r.title}</span>
                      <span className="text-black/30">›</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-black/60 ring-1 ring-black/10">
                  Aucune recette.
                </div>
              )}
            </div>
          </Card>

          <Card className={coachDashboardCardClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="mt-1 text-sm font-semibold text-black/60">Sélectionne une recette à gauche.</div>
              </div>
              <div className="h-20 w-28 rounded-2xl bg-black/5 ring-1 ring-black/10" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-h-[220px] rounded-2xl bg-white ring-1 ring-black/10" />
              <div className="min-h-[220px] rounded-2xl bg-white ring-1 ring-black/10" />
            </div>

            <div className="mt-4 grid gap-2">
              <div className="text-xs font-extrabold text-[#341c44]">Étapes</div>
              <div className="grid gap-2">
                <div className="h-11 rounded-2xl bg-white ring-1 ring-black/10" />
                <div className="h-11 rounded-2xl bg-white ring-1 ring-black/10" />
                <div className="h-11 rounded-2xl bg-white ring-1 ring-black/10" />
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
