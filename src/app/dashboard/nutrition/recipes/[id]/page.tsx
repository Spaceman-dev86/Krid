import Link from 'next/link'

import { Card, Container } from '../../../../../components/marketing'
import { createClient } from '../../../../../lib/supabase/server'
import StickyHeader from '../../StickyHeader'

type PageProps = {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardNutritionRecipeDetailPage(props: PageProps) {
  const { id } = await props.params

  const supabase = await createClient()

  const { data: recipesRaw } = await supabase
    .from('nutrition_recipes')
    .select('id,title,photo_url')
    .order('title', { ascending: true })

  const recipes = (recipesRaw ?? []) as unknown as { id: string; title: string; photo_url: string | null }[]
  const isKnownRecipe = recipes.some((r) => r.id === id)

  const { data: recipeRaw } = await supabase
    .from('nutrition_recipes')
    .select('id,title,note,photo_url,category,steps')
    .eq('id', id)
    .maybeSingle()

  const recipe = (recipeRaw ?? null) as unknown as {
    id: string
    title: string
    note: string | null
    photo_url: string | null
    category: string | null
    steps: string[] | null
  } | null

  const categoryLabel = (() => {
    const c = recipe?.category
    if (!c) return null
    if (c === 'petit-dej') return 'Petit-déj'
    if (c === 'snack') return 'Snack'
    if (c === 'repas') return 'Repas'
    return c
  })()

  const steps = (recipe?.steps ?? [])
    .map((body, idx) => ({ step_order: idx + 1, body: String(body ?? '').trim() }))
    .filter((s) => s.body)

  const { data: ingredientsRaw } = await supabase
    .from('nutrition_recipe_ingredients')
    .select('quantity_g,ingredient:nutrition_ingredients(id,name,calories,protein_g,carbs_g,fat_g)')
    .eq('recipe_id', id)

  const ingredients = (ingredientsRaw ?? []) as unknown as {
    quantity_g: number
    ingredient: {
      id: string
      name: string
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
    } | null
  }[]

  const totals = (() => {
    let kcal = 0
    let p = 0
    let c = 0
    let f = 0
    for (const row of ingredients) {
      const ing = row.ingredient
      if (!ing) continue
      const qty = Number(row.quantity_g ?? 0)
      kcal += (Number(ing.calories ?? 0) * qty) / 100
      p += (Number(ing.protein_g ?? 0) * qty) / 100
      c += (Number(ing.carbs_g ?? 0) * qty) / 100
      f += (Number(ing.fat_g ?? 0) * qty) / 100
    }
    return { kcal, p, c, f }
  })()

  return (
    <main className="min-h-screen bg-white">
      <Container className="py-6 sm:py-10">
        <StickyHeader className="sticky top-16 z-40 -mx-4 bg-white/95 px-4 py-4 md:backdrop-blur sm:-mx-6 sm:px-6">
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
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

        <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="p-0 overflow-hidden !bg-black/5">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 !bg-[#f3f3f3] px-4 py-3">
              <div className="text-sm font-extrabold text-[#341c44]">Liste de recette</div>
            </div>
            <div className="p-3">
              <div className="max-h-[424px] overflow-y-auto overflow-x-hidden rounded-2xl bg-white ring-1 ring-black/10">
                {recipes.map((r, idx) => {
                  const isActive = r.id === id
                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/nutrition/recipes/${r.id}`}
                      className={
                        (idx === 0 ? '' : 'border-t border-black/10 ') +
                        (isActive ? 'bg-[#341c44] text-white ' : 'bg-white text-[#341c44] hover:bg-[#f5f5f5] ') +
                        'flex min-w-0 items-center justify-between px-3 py-3 text-left text-sm font-extrabold'
                      }
                    >
                      <span className="min-w-0 truncate">{r.title}</span>
                      <span className={isActive ? 'text-white/70' : 'text-black/30'}>›</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </Card>

          <Card className="shadow-md ring-black/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xl font-extrabold tracking-tight text-[#341c44]">
                  {recipe?.title ?? (isKnownRecipe ? 'Recette' : `Recette: ${id}`)}
                </div>
                {categoryLabel ? <div className="mt-1 text-sm font-semibold text-black/50">{categoryLabel}</div> : null}
                {recipe?.note ? <div className="mt-2 text-sm font-semibold text-black/50">{recipe.note}</div> : null}
              </div>
              {recipe?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={recipe.photo_url} alt="Photo recette" className="h-20 w-28 rounded-2xl object-cover ring-1 ring-black/10" />
              ) : (
                <div className="h-20 w-28 rounded-2xl bg-black/5 ring-1 ring-black/10" />
              )}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-h-[220px] overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                <div className="border-b border-black/10 bg-black/5 px-4 py-3">
                  <div className="text-xs font-extrabold text-[#341c44]">Ingrédients</div>
                </div>
                <div className="p-4">
                  {ingredients.length > 0 ? (
                    <div className="grid">
                      {ingredients.map((row, idx) => {
                        const ing = row.ingredient
                        if (!ing) return null
                        const qty = Number(row.quantity_g ?? 0)
                        const kcal = (Number(ing.calories ?? 0) * qty) / 100
                        return (
                          <div key={`${ing.id}-${idx}`} className={(idx === 0 ? '' : 'border-t border-black/10 ') + 'py-3'}>
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="min-w-0 truncate text-sm font-extrabold text-[#341c44]">{ing.name}</div>
                                <div className="mt-0.5 text-xs font-semibold text-black/50">{qty} g</div>
                              </div>
                              <div className="shrink-0 text-sm font-extrabold tabular-nums text-[#341c44]">{kcal.toFixed(1)} kcal</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-black/50">Aucun ingrédient.</div>
                  )}
                </div>
              </div>

              <div className="min-h-[220px] overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                <div className="border-b border-black/10 bg-black/5 px-4 py-3">
                  <div className="text-xs font-extrabold text-[#341c44]">Macros</div>
                </div>
                <div className="p-4">
                  <div className="grid">
                    <div className="flex items-center justify-between py-3">
                      <div className="text-sm font-extrabold text-[#341c44]">Calories</div>
                      <div className="text-sm font-extrabold tabular-nums text-[#341c44]">{totals.kcal.toFixed(1)} kcal</div>
                    </div>
                    <div className="border-t border-black/10 flex items-center justify-between py-3">
                      <div className="text-sm font-extrabold text-[#341c44]">Protéines</div>
                      <div className="text-sm font-extrabold tabular-nums text-[#341c44]">{totals.p.toFixed(1)} g</div>
                    </div>
                    <div className="border-t border-black/10 flex items-center justify-between py-3">
                      <div className="text-sm font-extrabold text-[#341c44]">Glucides</div>
                      <div className="text-sm font-extrabold tabular-nums text-[#341c44]">{totals.c.toFixed(1)} g</div>
                    </div>
                    <div className="border-t border-black/10 flex items-center justify-between py-3">
                      <div className="text-sm font-extrabold text-[#341c44]">Lipides</div>
                      <div className="text-sm font-extrabold tabular-nums text-[#341c44]">{totals.f.toFixed(1)} g</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="text-xs font-extrabold text-[#341c44]">Étapes</div>
              {steps.length > 0 ? (
                <div className="grid rounded-2xl bg-black/5 p-4 ring-1 ring-black/10">
                  {steps.map((s, idx) => (
                    <div key={s.step_order} className={(idx === 0 ? '' : 'border-t border-black/10 ') + 'py-3'}>
                      <div className="text-xs font-extrabold text-black/40">Étape {s.step_order}</div>
                      <div className="mt-1 text-sm font-semibold text-[#341c44]">{s.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm font-semibold text-black/50">Aucune étape.</div>
              )}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
