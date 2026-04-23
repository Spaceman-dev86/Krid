'use client'

import { useMemo, useState } from 'react'

import { createClient } from '../../../lib/supabase/client'

type PostgrestErrorLike = {
  message?: string
}

type WriteResult = {
  error: PostgrestErrorLike | null
}

type PostgrestTableLike = {
  upsert: (values: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<WriteResult>
  select: (columns: string) => {
    order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: PostgrestErrorLike | null }>
  }
  order: (column: string, opts: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: PostgrestErrorLike | null }>
}

type PostgrestTotalsTableLike = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: PostgrestErrorLike | null }>
    }
  }
}

type SupabaseUntypedLike = {
  from: (table: string) => PostgrestTableLike
}

type Entry = {
  day_of_week: number
  meal_key: string
  recipe_id: string
  servings: number
  recipe: { id: string; title: string } | null
}

type RecipeListItem = {
  id: string
  title: string
  category: string | null
  photo_url: string | null
}

type PickerIngredientRow = {
  quantity_g: number
  ingredient: { id: string; name: string } | null
}

const MEALS = [
  { key: 'Petit-déj', label: 'Petit-déjeuner', icon: 'breakfast' },
  { key: 'Snack', label: 'Goûter', icon: 'snack' },
  { key: 'Midi', label: 'Déjeuner', icon: 'lunch' },
  { key: 'Soir', label: 'Dîner', icon: 'dinner' },
] as const

function mealToCategory(mealKey: string) {
  if (mealKey === 'Petit-déj') return 'petit-dej'
  if (mealKey === 'Snack') return 'snack'
  return 'repas'
}

function Icon({ name }: { name: (typeof MEALS)[number]['icon'] }) {
  const common = {
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (name === 'breakfast') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path d="M4 8h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" {...common} />
        <path d="M14 9h3a3 3 0 0 1 0 6h-3" {...common} />
        <path d="M7 3v3" {...common} />
        <path d="M11 3v3" {...common} />
      </svg>
    )
  }

  if (name === 'snack') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path d="M7 12c0 4 2 8 5 8s5-4 5-8" {...common} />
        <path d="M5 12h14" {...common} />
        <path d="M8 6c0 1.5 1 2.5 2.5 2.5S13 7.5 13 6" {...common} />
        <path d="M14 6c0 1.5 1 2.5 2.5 2.5S19 7.5 19 6" {...common} />
      </svg>
    )
  }

  if (name === 'lunch') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
        <path d="M4 15h16" {...common} />
        <path d="M6 15v3" {...common} />
        <path d="M18 15v3" {...common} />
        <path d="M7 11c1.2-3 3.2-5 5-5s3.8 2 5 5" {...common} />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path d="M7 7h10" {...common} />
      <path d="M6 10h12" {...common} />
      <path d="M5 13h14" {...common} />
      <path d="M6 13v6" {...common} />
      <path d="M18 13v6" {...common} />
    </svg>
  )
}

export default function WeeklyPlanCalendarClient(props: {
  weekPlanId: string
  days: string[]
  entries: Entry[]
  totalsByRecipeId: Record<string, { calories: number; protein_g: number; fat_g: number; carbs_g: number }>
}) {
  const { weekPlanId, days, entries, totalsByRecipeId } = props
  const supabase = useMemo(() => createClient(), [])
  const supabaseUntyped = supabase as unknown as SupabaseUntypedLike

  const supabaseTotals = supabase as unknown as {
    from: (table: 'nutrition_recipe_totals') => PostgrestTotalsTableLike
  }

  const [picker, setPicker] = useState<null | { day: number; mealKey: string; currentRecipeId: string | null; currentRecipeTitle: string | null }>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recipes, setRecipes] = useState<RecipeListItem[] | null>(null)
  const [recipeQuery, setRecipeQuery] = useState('')
  const [pickerTotals, setPickerTotals] = useState<null | { calories: number; protein_g: number; carbs_g: number; fat_g: number }>(null)
  const [pickerIngredients, setPickerIngredients] = useState<null | { recipeId: string; items: PickerIngredientRow[] }>(null)

  const entriesBySlot = useMemo(() => {
    const m = new Map<string, Entry>()
    for (const e of entries) {
      m.set(`${e.day_of_week}-${e.meal_key}`, e)
    }
    return m
  }, [entries])

  const dayTotals = useMemo(() => {
    const totals: Record<number, { calories: number; protein_g: number; fat_g: number; carbs_g: number }> = {}
    for (let d = 1; d <= 7; d++) totals[d] = { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
    for (const e of entries) {
      const base = totalsByRecipeId[e.recipe_id] ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 }
      const mult = Number(e.servings ?? 1)
      totals[e.day_of_week].calories += base.calories * mult
      totals[e.day_of_week].protein_g += base.protein_g * mult
      totals[e.day_of_week].fat_g += base.fat_g * mult
      totals[e.day_of_week].carbs_g += base.carbs_g * mult
    }
    return totals
  }, [entries, totalsByRecipeId])

  const filteredRecipes = useMemo(() => {
    if (!picker || !recipes) return []
    const category = mealToCategory(picker.mealKey)
    const q = recipeQuery.trim().toLowerCase()
    return recipes
      .filter((r) => (r.category ?? 'repas') === category)
      .filter((r) => (!q ? true : String(r.title ?? '').toLowerCase().includes(q)))
  }, [picker, recipeQuery, recipes])

  async function ensureRecipesLoaded() {
    if (recipes) return
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('nutrition_recipes')
        .select('id,title,category,photo_url')
        .order('title', { ascending: true })
      if (err) throw err
      setRecipes((data ?? []) as unknown as RecipeListItem[])
    } catch {
      setRecipes([])
    } finally {
      setLoading(false)
    }
  }

  async function loadPickerTotals(recipeId: string | null) {
    if (!recipeId) return setPickerTotals(null)
    try {
      const { data, error: err } = await supabaseTotals
        .from('nutrition_recipe_totals')
        .select('calories,protein_g,carbs_g,fat_g')
        .eq('recipe_id', recipeId)
        .maybeSingle()
      if (err) throw err
      if (!data) return setPickerTotals(null)
      setPickerTotals({
        calories: Number(data.calories ?? 0),
        protein_g: Number(data.protein_g ?? 0),
        carbs_g: Number(data.carbs_g ?? 0),
        fat_g: Number(data.fat_g ?? 0),
      })
    } catch {
      setPickerTotals(null)
    }
  }

  async function loadPickerIngredients(recipeId: string | null) {
    if (!recipeId) return setPickerIngredients(null)
    try {
      const { data, error: err } = await (supabase as unknown as {
        from: (table: 'nutrition_recipe_ingredients') => {
          select: (columns: string) => {
            eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: PostgrestErrorLike | null }>
          }
        }
      })
        .from('nutrition_recipe_ingredients')
        .select('quantity_g,ingredient:nutrition_ingredients(id,name)')
        .eq('recipe_id', recipeId)

      if (err) throw err
      setPickerIngredients({ recipeId, items: (data ?? []) as unknown as PickerIngredientRow[] })
    } catch {
      setPickerIngredients({ recipeId, items: [] })
    }
  }

  async function setSlotRecipe(slot: { day: number; mealKey: string }, nextRecipeId: string) {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        week_plan_id: weekPlanId,
        day_of_week: slot.day,
        meal_key: slot.mealKey,
        recipe_id: nextRecipeId,
        servings: 1,
      }

      const { error: err } = await supabaseUntyped
        .from('nutrition_week_plan_entries')
        .upsert(payload, { onConflict: 'week_plan_id,day_of_week,meal_key' })
      if (err) throw err
      window.location.reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? 'Erreur inconnue.'
      setError(msg)
      setLoading(false)
    }
  }

  async function clearSlotRecipe(slot: { day: number; mealKey: string }) {
    setLoading(true)
    setError(null)
    try {
      const { error: err } = await (supabase as unknown as {
        from: (table: 'nutrition_week_plan_entries') => {
          delete: () => {
            eq: (column: string, value: string) => {
              eq: (column: string, value: number) => {
                eq: (column: string, value: string) => Promise<WriteResult>
              }
            }
          }
        }
      })
        .from('nutrition_week_plan_entries')
        .delete()
        .eq('week_plan_id', weekPlanId)
        .eq('day_of_week', slot.day)
        .eq('meal_key', slot.mealKey)

      if (err) throw err
      window.location.reload()
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message ?? 'Erreur inconnue.'
      setError(msg)
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-black/10">
          <div className="bg-[#f5f5f5]" />
          {days.map((d, idx) => {
            const day = idx + 1
            return (
              <div key={d} className="px-4 py-3">
                <div className="text-sm font-extrabold text-[#341c44]">{d}</div>
                <div className="mt-0.5 text-xs font-extrabold text-black/50">{Math.round(dayTotals[day]?.calories ?? 0)} kcal</div>
                <div className="mt-1 text-[11px] font-semibold text-black/40">
                  {Math.round(dayTotals[day]?.protein_g ?? 0)}P · {Math.round(dayTotals[day]?.fat_g ?? 0)}L · {Math.round(dayTotals[day]?.carbs_g ?? 0)}G
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))]">
          {MEALS.map((meal, rowIdx) => (
            <div key={meal.key} className={(rowIdx === 0 ? '' : 'border-t border-black/10 ') + 'contents'}>
              <div
                className={
                  (rowIdx === 0 ? '' : 'border-t border-black/10 ') +
                  ' flex flex-col items-center justify-center gap-2 bg-[#f5f5f5] py-5'
                }
              >
                <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[#341c44] text-white shadow-sm">
                  <Icon name={meal.icon} />
                </div>
                <div className="text-[11px] font-extrabold leading-none text-[#341c44]">{meal.key}</div>
              </div>

              {days.map((d, idx) => {
                const day = idx + 1
                const slot = entriesBySlot.get(`${day}-${meal.key}`) ?? null
                const kcal = slot ? (totalsByRecipeId[slot.recipe_id]?.calories ?? 0) * Number(slot.servings ?? 1) : 0

                return (
                  <button
                    key={`${d}-${meal.key}`}
                    type="button"
                    onClick={async () => {
                      setPicker({
                        day,
                        mealKey: meal.key,
                        currentRecipeId: slot?.recipe_id ?? null,
                        currentRecipeTitle: slot?.recipe?.title ?? null,
                      })
                      setRecipeQuery('')
                      await loadPickerTotals(slot?.recipe_id ?? null)
                      await loadPickerIngredients(slot?.recipe_id ?? null)
                      await ensureRecipesLoaded()
                    }}
                    className={(rowIdx === 0 ? '' : 'border-t border-black/10 ') + 'h-full w-full px-4 py-4 text-left hover:bg-[#f5f5f5]'}
                    aria-label={slot ? `Modifier ${meal.label} ${d}` : `Ajouter ${meal.label} ${d}`}
                    disabled={loading}
                  >
                    {slot ? (
                      <div className="py-1">
                        <div className="min-w-0 text-sm font-extrabold leading-snug text-[#341c44] line-clamp-2">{slot.recipe?.title ?? 'Recette'}</div>
                        <div className="mt-1 text-xs font-semibold text-black/50">{Math.round(kcal)} kcal</div>
                      </div>
                    ) : (
                      <div className="flex py-1">
                        <div className="w-full translate-x-2 text-center text-sm font-extrabold text-black/30">--</div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {picker ? (
        <div className="fixed inset-0 z-[10000]">
          <button type="button" className="absolute inset-0 bg-black/30" onClick={() => (loading ? null : setPicker(null))} aria-label="Fermer" />
          <div className="absolute left-1/2 top-24 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10 shadow-md">
              <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-[#341c44]">
                    {picker.currentRecipeTitle ? picker.currentRecipeTitle : 'Choisir une recette'}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-black/50">
                    {days[picker.day - 1]} · {picker.mealKey}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {picker.currentRecipeId ? (
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-red-600 ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                      onClick={() => {
                        if (loading) return
                        const slot = { day: picker.day, mealKey: picker.mealKey }
                        setPicker(null)
                        void clearSlotRecipe(slot)
                      }}
                      aria-label="Supprimer la recette"
                      title="Supprimer"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                        <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                    onClick={() => (loading ? null : setPicker(null))}
                    aria-label="Fermer"
                    title="Fermer"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-3">
                {error ? <div className="mb-2 text-sm font-semibold text-red-600">{error}</div> : null}

                {(() => {
                  const currentPhotoUrl = recipes?.find((r) => r.id === picker.currentRecipeId)?.photo_url ?? null
                  return currentPhotoUrl ? (
                    <div className="mb-3 flex items-start justify-end">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={currentPhotoUrl} alt="" className="h-16 w-24 rounded-2xl object-cover ring-1 ring-black/10" />
                    </div>
                  ) : null
                })()}

                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  {pickerIngredients ? (
                    <div className="overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                      <div className="border-b border-black/10 px-3 py-2 text-xs font-extrabold text-[#341c44]">Ingrédients</div>
                      <div className="p-3">
                        {pickerIngredients.items.length > 0 ? (
                          <div className="grid">
                            {pickerIngredients.items.map((row, idx) => (
                              <div key={(row.ingredient?.id ?? 'x') + '-' + idx} className={(idx === 0 ? '' : 'border-t border-black/10 ') + 'py-2'}>
                                <div className="flex min-w-0 items-center justify-between gap-3">
                                  <div className="min-w-0 truncate text-sm font-extrabold text-[#341c44]">
                                    {row.ingredient?.name ?? 'Ingrédient'}
                                  </div>
                                  <div className="shrink-0 text-sm font-semibold tabular-nums text-black/40">
                                    {Math.round(Number(row.quantity_g ?? 0))} g
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-black/50">Aucun ingrédient.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-[140px] rounded-2xl bg-black/5 ring-1 ring-black/10" />
                  )}

                  {pickerTotals ? (
                    <div className="overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                      <div className="border-b border-black/10 px-3 py-2 text-xs font-extrabold text-[#341c44]">Macros</div>
                      <div className="p-3">
                        <div className="grid gap-2 text-sm font-extrabold">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#341c44]">Kcal</span>
                            <span className="tabular-nums text-black/40">{Math.round(pickerTotals.calories)}</span>
                          </div>
                          <div className="border-t border-black/10 pt-2 flex items-center justify-between gap-2">
                            <span className="text-[#341c44]">Lipides</span>
                            <span className="tabular-nums text-black/40">{pickerTotals.fat_g.toFixed(1)} <span className="text-black/40">g</span></span>
                          </div>
                          <div className="border-t border-black/10 pt-2 flex items-center justify-between gap-2">
                            <span className="text-[#341c44]">Protéines</span>
                            <span className="tabular-nums text-black/40">{pickerTotals.protein_g.toFixed(1)} <span className="text-black/40">g</span></span>
                          </div>
                          <div className="border-t border-black/10 pt-2 flex items-center justify-between gap-2">
                            <span className="text-[#341c44]">Glucides</span>
                            <span className="tabular-nums text-black/40">{pickerTotals.carbs_g.toFixed(1)} <span className="text-black/40">g</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[140px] rounded-2xl bg-black/5 ring-1 ring-black/10" />
                  )}
                </div>

                <input
                  value={recipeQuery}
                  onChange={(e) => setRecipeQuery(e.target.value)}
                  placeholder="Choisir une nouvelle recette..."
                  className="mb-3 h-11 w-full rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 focus:outline-none focus:ring-2 focus:ring-[#341c44]/20"
                />

                <div className="max-h-[420px] overflow-y-auto overflow-x-hidden rounded-2xl bg-white ring-1 ring-black/10">
                  {filteredRecipes.map((r, idx) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={async () => {
                        if (!picker) return
                        const slot = { day: picker.day, mealKey: picker.mealKey }
                        setPicker(null)
                        void loadPickerTotals(r.id)
                        void loadPickerIngredients(r.id)
                        void setSlotRecipe(slot, r.id)
                      }}
                      className={(idx === 0 ? '' : 'border-t border-black/10 ') + 'flex w-full items-center justify-between px-3 py-3 text-left text-sm font-extrabold text-[#341c44] hover:bg-[#f5f5f5]'}
                    >
                      <span className="min-w-0 truncate">{r.title}</span>
                      <span className="ml-3 text-black/30">›</span>
                    </button>
                  ))}

                  {filteredRecipes.length === 0 ? (
                    <div className="px-3 py-3 text-sm font-semibold text-black/50">Aucune recette dans cette catégorie.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
