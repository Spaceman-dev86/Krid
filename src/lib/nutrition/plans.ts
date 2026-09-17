import { chatDb } from '../chat/chat'

export type MealSlot = 'petit_dej' | 'dejeuner' | 'diner' | 'collation'

export type NutritionMealItem = {
  name: string
  recipe_id?: string
  kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export type NutritionMeal = {
  id: string
  slot: MealSlot
  title: string
  items: NutritionMealItem[]
}

export type NutritionDay = {
  day_index: number
  meals: NutritionMeal[]
}

export type NutritionWeek = {
  week_index: number
  days: NutritionDay[]
}

export type NutritionTargets = {
  kcal?: number
  protein_g?: number
  fat_g?: number
  carbs_g?: number
}

export type NutritionStructure = {
  targets?: NutritionTargets
  weeks: NutritionWeek[]
}

export type NutritionPlanRow = {
  id: string
  coach_id: string
  title: string
  status: 'draft' | 'template'
  structure: NutritionStructure
  created_at: string
  updated_at: string
}

export type NutritionRecipeRow = {
  id: string
  coach_id: string
  title: string
  notes: string | null
  kcal: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  created_at: string
}

export type ClientNutritionPlanStatus = 'waiting' | 'started' | 'paused' | 'done'

export type ClientNutritionPlanRow = {
  id: string
  client_id: string
  coach_id: string
  source_plan_id: string | null
  status: ClientNutritionPlanStatus
  start_date: string | null
  snapshot: NutritionStructure | null
  created_at: string
  title?: string | null
}

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  petit_dej: 'Petit-déj',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
  collation: 'Collation',
}

export const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const

export const NUT_PLAN_STATUS_LABELS: Record<ClientNutritionPlanStatus, string> = {
  waiting: 'En attente',
  started: 'En cours',
  paused: 'Pause',
  done: 'Terminé',
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function emptyWeekStructure(): NutritionStructure {
  const days: NutritionDay[] = Array.from({ length: 7 }, (_, day_index) => ({
    day_index,
    meals: [
      { id: newId(), slot: 'petit_dej', title: 'Petit-déjeuner', items: [] },
      { id: newId(), slot: 'dejeuner', title: 'Déjeuner', items: [] },
      { id: newId(), slot: 'diner', title: 'Dîner', items: [] },
    ],
  }))
  return { weeks: [{ week_index: 0, days }], targets: {} }
}

export function parseStructure(raw: unknown): NutritionStructure {
  if (!raw || typeof raw !== 'object') return emptyWeekStructure()
  const obj = raw as NutritionStructure
  if (!Array.isArray(obj.weeks) || !obj.weeks.length) return emptyWeekStructure()
  return obj
}

export function mealDisplayTitle(meal: NutritionMeal): string {
  const fromItems = meal.items.map((i) => i.name).filter(Boolean).join(', ')
  return fromItems || meal.title || MEAL_SLOT_LABELS[meal.slot]
}

export function mealKcal(meal: NutritionMeal): number | null {
  const sum = meal.items.reduce((acc, i) => acc + (Number(i.kcal) || 0), 0)
  return sum > 0 ? sum : null
}

/** Calendar date for day_index relative to plan start_date (Monday-based week). */
export function dateIsoForPlanDay(startDateIso: string, dayIndex: number, weekIndex = 0): string {
  const [y, m, d] = startDateIso.split('-').map(Number)
  const start = new Date(y, (m ?? 1) - 1, d ?? 1)
  // Align to Monday of start week if start is mid-week? Spec: anchor on start_date as day 0 of week 0 = first Monday after or start itself as Lun.
  // MVP: start_date = day 0 (Lun of week 0). Coach/client pick start as Monday preferred.
  start.setDate(start.getDate() + weekIndex * 7 + dayIndex)
  const yy = start.getFullYear()
  const mm = String(start.getMonth() + 1).padStart(2, '0')
  const dd = String(start.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function isActiveNutritionStatus(status: string): boolean {
  return status === 'started' || status === 'paused'
}

export function pickActiveNutritionPlan(
  plans: ClientNutritionPlanRow[]
): ClientNutritionPlanRow | null {
  return plans.find((p) => p.status === 'started') ?? plans.find((p) => p.status === 'paused') ?? null
}

export async function listCoachRecipes(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('nutrition_recipes')
    .select('id, coach_id, title, notes, kcal, protein_g, carbs_g, fat_g, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('title', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as NutritionRecipeRow[]
}

export async function listCoachNutritionPlans(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('nutrition_plans')
    .select('id, coach_id, title, status, structure, created_at, updated_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Omit<NutritionPlanRow, 'structure'> & { structure: unknown }>).map(
    (row) => ({
      ...row,
      structure: parseStructure(row.structure),
    })
  )
}

export async function listClientNutritionPlans(supabase: unknown, clientId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('client_nutrition_plans')
    .select('id, client_id, coach_id, source_plan_id, title, status, start_date, snapshot, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Omit<ClientNutritionPlanRow, 'snapshot'> & { snapshot: unknown }>).map(
    (row) => ({
      ...row,
      title: row.title?.trim() || 'Plan nutrition',
      snapshot: row.snapshot ? parseStructure(row.snapshot) : null,
    })
  )
}

export async function listCoachClientNutritionPlans(supabase: unknown, coachId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('client_nutrition_plans')
    .select('id, client_id, coach_id, source_plan_id, title, status, start_date, snapshot, created_at')
    .eq('coach_id', coachId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Omit<ClientNutritionPlanRow, 'snapshot'> & { snapshot: unknown }>).map(
    (row) => ({
      ...row,
      title: row.title?.trim() || 'Plan nutrition',
      snapshot: row.snapshot ? parseStructure(row.snapshot) : null,
    })
  )
}

export async function loadDayLogs(
  supabase: unknown,
  planId: string,
  fromIso: string,
  toIso: string
) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('nutrition_day_logs')
    .select('id, plan_id, day_date, meals_validated, day_comment')
    .eq('plan_id', planId)
    .gte('day_date', fromIso)
    .lte('day_date', toIso)
  if (error) throw new Error(error.message)
  return (data ?? []) as Array<{
    id: string
    plan_id: string
    day_date: string
    meals_validated: Record<string, boolean>
    day_comment: string | null
  }>
}
