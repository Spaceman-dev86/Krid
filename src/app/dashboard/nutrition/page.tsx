import Link from 'next/link'

import { Card, Container } from '../../../components/marketing'
import { createClient } from '../../../lib/supabase/server'
import AddClientModal from './AddClientModal'
import StickyHeader from './StickyHeader'
import WeeklyPlanCalendarClient from './WeeklyPlanCalendarClient'

type ClientItem = {
  id: string
  name: string
  activityLevel?: string | null
  weightKg?: number | null
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function formatObjective(objective: string | null) {
  if (!objective) return '—'
  if (objective === 'prise_de_masse') return 'Prise de masse'
  if (objective === 'seche') return 'Sèche'
  if (objective === 'maintien') return 'Maintien'
  return objective
}

function formatActivityLevel(level: string | null | undefined) {
  if (!level) return '—'
  if (level === 'sedentary') return 'Sédentaire'
  if (level === 'light') return 'Légèrement actif'
  if (level === 'moderate') return 'Modérément actif'
  if (level === 'very') return 'Très actif'
  if (level === 'intense') return 'Sport intensif'
  return level
}

export default async function DashboardNutritionPage(props: PageProps) {
  const supabase = await createClient()

  const { client: clientParamRaw } = await props.searchParams
  const clientParam = Array.isArray(clientParamRaw) ? clientParamRaw[0] : clientParamRaw

  const clientsRes = await (async () => {
    const res = (await supabase
      .from('demo_clients')
      .select('id,full_name,avatar_seed,activity_level,objective,target_kcal,maintenance_kcal,age,weight_kg')
      .order('full_name', { ascending: true })) as unknown as {
      data: unknown[] | null
      error?: { message?: string } | null
    }
    if (!res.error) return res

    return (await supabase
      .from('demo_clients')
      .select('id,full_name,avatar_seed,activity_level,objective,target_kcal,maintenance_kcal,age')
      .order('full_name', { ascending: true })) as unknown as {
      data: unknown[] | null
      error?: { message?: string } | null
    }
  })()

  const clientsErrorMsg = clientsRes.error?.message ?? null

  const clientsSource = (clientsRes.data ?? []) as {
    id: string
    full_name: string
    avatar_seed: string | null
    activity_level: string | null
    objective: string | null
    target_kcal: number | null
    maintenance_kcal: number | null
    age: number | null
    weight_kg?: number | null
  }[]
  const clients = clientsSource.map((c) => ({
    id: String(c.id),
    name: String(c.full_name),
    activityLevel: c.activity_level ?? null,
    weightKg: c.weight_kg ?? null,
  })) as ClientItem[]
  const activeClientId = clientParam && clients.some((c) => c.id === clientParam) ? clientParam : clients[0]?.id
  const activeClient = clients.find((c) => c.id === activeClientId) ?? null

  const profileSource = activeClientId ? clientsSource.find((c) => String(c.id) === activeClientId) ?? null : null

  const profile = profileSource
    ? {
        objective: profileSource.objective,
        target_kcal: profileSource.target_kcal,
        maintenance_kcal: profileSource.maintenance_kcal,
        age: profileSource.age,
        weight_kg: profileSource.weight_kg,
      }
    : null

  const planRes = activeClientId
    ? ((await supabase
        .from('nutrition_week_plans')
        .select('id')
        .eq('client_id', activeClientId)
        .eq('is_active', true)
        .maybeSingle()) as unknown as { data: { id: string } | null; error?: { message?: string } | null })
    : ({ data: null, error: null } as { data: { id: string } | null; error?: { message?: string } | null })

  const weekPlanId = planRes.data?.id ?? null
  const weekPlanErrorMsg = planRes.error?.message ?? null

  const entriesRes = weekPlanId
    ? ((await supabase
        .from('nutrition_week_plan_entries')
        .select('day_of_week,meal_key,recipe_id,servings,recipe:nutrition_recipes(id,title)')
        .eq('week_plan_id', weekPlanId)) as unknown as {
        data:
          | {
              day_of_week: number
              meal_key: string
              recipe_id: string
              servings: number
              recipe: { id: string; title: string } | null
            }[]
          | null
        error?: { message?: string } | null
      })
    : ({ data: [], error: null } as { data: []; error?: { message?: string } | null })

  const entriesErrorMsg = entriesRes.error?.message ?? null

  const entries = (entriesRes.data ?? []) as unknown as {
    day_of_week: number
    meal_key: string
    recipe_id: string
    servings: number
    recipe: { id: string; title: string } | null
  }[]

  const recipeIds = Array.from(new Set(entries.map((e) => e.recipe_id).filter(Boolean)))

  const totalsRes = recipeIds.length
    ? ((await supabase
        .from('nutrition_recipe_totals')
        .select('recipe_id,calories,protein_g,fat_g,carbs_g')
        .in('recipe_id', recipeIds)) as unknown as {
        data: { recipe_id: string; calories: number; protein_g: number; fat_g: number; carbs_g: number }[] | null
      })
    : ({ data: [] } as { data: { recipe_id: string; calories: number; protein_g: number; fat_g: number; carbs_g: number }[] })

  const totalsByRecipeId = new Map<string, { calories: number; protein_g: number; fat_g: number; carbs_g: number }>()
  for (const row of (totalsRes.data ?? []) as { recipe_id: string; calories: number; protein_g: number; fat_g: number; carbs_g: number }[]) {
    totalsByRecipeId.set(String(row.recipe_id), {
      calories: Number(row.calories ?? 0),
      protein_g: Number(row.protein_g ?? 0),
      fat_g: Number(row.fat_g ?? 0),
      carbs_g: Number(row.carbs_g ?? 0),
    })
  }

  const entriesByDay = new Map<number, typeof entries>()
  for (const e of entries) {
    const day = Number(e.day_of_week)
    entriesByDay.set(day, [...(entriesByDay.get(day) ?? []), e])
  }

  const dayTotalKcal: Record<number, number> = {}
  for (let day = 1; day <= 7; day++) {
    const dayEntries = entriesByDay.get(day) ?? []
    const total = dayEntries.reduce((sum, e) => {
      const base = totalsByRecipeId.get(e.recipe_id)?.calories ?? 0
      return sum + base * Number(e.servings ?? 1)
    }, 0)
    dayTotalKcal[day] = total
  }

  const targetKcal = profile?.target_kcal ?? null
  const maintenanceKcal = profile?.maintenance_kcal ?? null
  const age = profile?.age ?? null
  const weightKg = profile?.weight_kg ?? null

  const macroTargets = (() => {
    if (!weightKg || !targetKcal) return null
    const w = Number(weightKg)
    const kcal = Number(targetKcal)
    if (!Number.isFinite(w) || !Number.isFinite(kcal) || w <= 0 || kcal <= 0) return null
    const proteinG = 1.6 * w
    const fatG = 0.8 * w
    const carbsG = (kcal - proteinG * 4 - fatG * 9) / 4
    return {
      proteinG,
      fatG,
      carbsG,
    }
  })()

  const deltaPercent = (() => {
    if (!maintenanceKcal || !targetKcal) return null
    if (maintenanceKcal === 0) return null
    return ((targetKcal - maintenanceKcal) / maintenanceKcal) * 100
  })()

  return (
    <main className="min-h-screen bg-white">
      <Container className="py-6 sm:py-10">
        <StickyHeader className="sticky top-16 z-40 bg-white/95 px-4 py-4 md:backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#341c44]">Suivi nutritionnel</h1>
              <p className="mt-1 text-sm text-black/60">Créer et suivre des plans nutritionnels pour tes clients.</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                aria-label="Retour"
                title="Retour"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none">
                  <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href="/dashboard/nutrition/recipes"
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-white px-4 text-sm font-extrabold text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
              >
                Liste de recette
              </Link>
              <AddClientModal />
            </div>
          </div>
        </StickyHeader>

        <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Card className="p-0 overflow-hidden !bg-black/5">
            <div className="border-b border-black/10 !bg-[#f3f3f3] px-4 py-3">
              <div className="text-sm font-extrabold text-[#341c44]">Clients</div>
            </div>
            <div className="p-3">
              {clientsErrorMsg ? <div className="mb-2 text-sm font-semibold text-red-600">{clientsErrorMsg}</div> : null}
              <div className="max-h-[424px] overflow-y-auto overflow-x-hidden rounded-2xl bg-white ring-1 ring-black/10">
                {clients.map((c, idx) => {
                  const isActive = c.id === activeClientId
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/nutrition?client=${c.id}`}
                      className={
                        (idx === 0 ? '' : 'border-t border-black/10 ') +
                        (isActive ? 'bg-[#341c44] text-white ' : 'bg-white text-[#341c44] hover:bg-[#f5f5f5] ') +
                        'flex min-w-0 items-center justify-between px-3 py-3 text-left text-sm font-extrabold'
                      }
                    >
                      <span className="min-w-0 truncate">{c.name}</span>
                      <span className={isActive ? 'text-white/70' : 'text-black/30'}>›</span>
                    </Link>
                  )
                })}
                {clients.length === 0 && !clientsErrorMsg ? (
                  <div className="px-3 py-3 text-sm font-semibold text-black/50">Aucun client.</div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="shadow-md ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-extrabold text-[#341c44]">
                  {(activeClient?.name ?? 'Client') +
                    (age || weightKg ? ` · ${age ? `${age} ans` : '—'} · ${weightKg ? `${weightKg} kg` : '—'}` : '')}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-black/60">
                  <span>{formatObjective(profile?.objective ?? null)}</span>
                  <span className="text-black/30">·</span>
                  <span>{deltaPercent === null ? '—' : `${deltaPercent >= 0 ? '+' : ''}${Math.round(deltaPercent)}%`}</span>
                  <span className="text-black/30">·</span>
                  <span>
                    objectif :{' '}
                    {targetKcal ? `${targetKcal} Kcal/jour` : '—'}
                    {macroTargets
                      ? ` · Prot ${Math.round(macroTargets.proteinG)}g · Lip ${Math.round(macroTargets.fatG)}g · Gluc ${Math.round(macroTargets.carbsG)}g`
                      : ''}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-black/60">Activité: {formatActivityLevel(activeClient?.activityLevel)}</div>
              </div>

              <div className="shrink-0 rounded-2xl bg-black/5 px-3 py-2 text-xs font-extrabold text-[#341c44] ring-1 ring-black/10">
                Semaine type
              </div>
            </div>

            <div className="mt-5">
              {weekPlanId ? (
                <WeeklyPlanCalendarClient
                  weekPlanId={weekPlanId}
                  days={DAYS}
                  entries={entries}
                  totalsByRecipeId={Object.fromEntries(Array.from(totalsByRecipeId.entries()))}
                />
              ) : (
                <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
                  {weekPlanErrorMsg ? <div className="mb-2 text-sm font-semibold text-red-600">{weekPlanErrorMsg}</div> : null}
                  {entriesErrorMsg ? <div className="mb-2 text-sm font-semibold text-red-600">{entriesErrorMsg}</div> : null}
                  <div className="text-sm font-semibold text-black/60">Aucune semaine active.</div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
