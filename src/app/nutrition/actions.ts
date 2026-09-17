'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import {
  emptyWeekStructure,
  parseStructure,
  type NutritionStructure,
} from '../../lib/nutrition/plans'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, userId: user.id }
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export async function createNutritionPlanAction() {
  const { supabase, userId } = await requireCoach()
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('nutrition_plans')
    .insert({
      coach_id: userId,
      title: 'Nouveau plan nutrition',
      status: 'draft',
      structure: emptyWeekStructure(),
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    redirect('/nutrition?error=' + encodeURIComponent(error?.message || 'Création impossible'))
  }
  revalidatePath('/nutrition')
  redirect(`/nutrition/${data.id}`)
}

export async function saveNutritionPlanAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Plan nutrition'
  const statusRaw = String(formData.get('status') ?? 'draft').trim()
  const status = statusRaw === 'template' ? 'template' : 'draft'
  const structureJson = String(formData.get('structure_json') ?? '').trim()

  if (!planId) redirect('/nutrition?error=' + encodeURIComponent('Plan manquant'))

  let structure: NutritionStructure
  try {
    structure = parseStructure(JSON.parse(structureJson || '{}'))
  } catch {
    redirect(`/nutrition/${planId}?error=` + encodeURIComponent('Structure invalide'))
  }

  const targetsKcal = numOrNull(formData.get('target_kcal'))
  const targetsP = numOrNull(formData.get('target_protein'))
  const targetsC = numOrNull(formData.get('target_carbs'))
  const targetsF = numOrNull(formData.get('target_fat'))
  structure.targets = {
    ...(targetsKcal != null ? { kcal: targetsKcal } : {}),
    ...(targetsP != null ? { protein_g: targetsP } : {}),
    ...(targetsC != null ? { carbs_g: targetsC } : {}),
    ...(targetsF != null ? { fat_g: targetsF } : {}),
  }

  const db = chatDb(supabase)
  const { error } = await db
    .from('nutrition_plans')
    .update({
      title,
      status,
      structure,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(`/nutrition/${planId}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/nutrition')
  revalidatePath(`/nutrition/${planId}`)
  redirect(`/nutrition/${planId}?saved=1`)
}

export async function softDeleteNutritionPlanAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const planId = String(formData.get('plan_id') ?? '').trim()
  if (!planId) redirect('/nutrition')

  const db = chatDb(supabase)
  await db
    .from('nutrition_plans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('coach_id', userId)

  revalidatePath('/nutrition')
  redirect('/nutrition?deleted=1')
}

export async function sendNutritionPlanAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '').trim()
  if (!planId || !clientId) {
    redirect('/nutrition?error=' + encodeURIComponent('Plan et client requis'))
  }

  const db = chatDb(supabase)
  const { data: plan, error: planErr } = await db
    .from('nutrition_plans')
    .select('id, title, structure')
    .eq('id', planId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (planErr || !plan) {
    redirect('/nutrition?error=' + encodeURIComponent(planErr?.message || 'Plan introuvable'))
  }

  const { data: client } = await db
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) {
    redirect(`/nutrition/${planId}?error=` + encodeURIComponent('Client introuvable'))
  }

  const snapshot = parseStructure(plan.structure)
  const { error } = await db.from('client_nutrition_plans').insert({
    client_id: clientId,
    coach_id: userId,
    source_plan_id: planId,
    title: plan.title,
    status: 'waiting',
    snapshot,
  })

  if (error) {
    redirect(`/nutrition/${planId}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath('/nutrition')
  revalidatePath(`/nutrition/${planId}`)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', userId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/home`)
  }

  redirect(`/nutrition/${planId}?sent=1`)
}

export async function saveRecipeAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const recipeId = String(formData.get('recipe_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim() || null
  const kcal = numOrNull(formData.get('kcal'))
  const protein_g = numOrNull(formData.get('protein_g'))
  const carbs_g = numOrNull(formData.get('carbs_g'))
  const fat_g = numOrNull(formData.get('fat_g'))

  if (!title) redirect('/nutrition/recipes?error=' + encodeURIComponent('Titre requis'))

  const db = chatDb(supabase)
  if (recipeId) {
    const { error } = await db
      .from('nutrition_recipes')
      .update({
        title,
        notes,
        kcal,
        protein_g,
        carbs_g,
        fat_g,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recipeId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
    if (error) redirect('/nutrition/recipes?error=' + encodeURIComponent(error.message))
  } else {
    const { error } = await db.from('nutrition_recipes').insert({
      coach_id: userId,
      title,
      notes,
      kcal,
      protein_g,
      carbs_g,
      fat_g,
    })
    if (error) redirect('/nutrition/recipes?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/nutrition/recipes')
  redirect('/nutrition/recipes?saved=1')
}

export async function deleteRecipeAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const recipeId = String(formData.get('recipe_id') ?? '').trim()
  if (!recipeId) redirect('/nutrition/recipes')

  const db = chatDb(supabase)
  await db
    .from('nutrition_recipes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', recipeId)
    .eq('coach_id', userId)

  revalidatePath('/nutrition/recipes')
  redirect('/nutrition/recipes?deleted=1')
}
