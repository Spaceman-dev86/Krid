'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requireClientForPortal(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/home')}`)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}?error=not_your_coach`)

  return { supabase, clientId: client.id, slug }
}

export async function startFitnessPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)

  const { data: plan } = await supabase
    .from('client_fitness_plans')
    .select('id, status, source_program_id')
    .eq('id', planId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!plan || plan.status !== 'waiting') {
    redirect(`${returnTo}?plan_error=invalid`)
  }

  const { data: startedOther } = await supabase
    .from('client_fitness_plans')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'started')
    .maybeSingle()

  if (startedOther) {
    redirect(`${returnTo}?plan_error=already_active`)
  }

  const today = new Date().toISOString().slice(0, 10)

  const { error } = await supabase
    .from('client_fitness_plans')
    .update({
      status: 'started',
      start_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('client_id', clientId)

  if (error) redirect(`${returnTo}?plan_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath(`${portalBase(slug)}/seance`)
  redirect(`${returnTo}?plan_started=1`)
}

export async function pauseFitnessPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)

  const { error } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('status', 'started')

  if (error) redirect(`${returnTo}?plan_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath(`${portalBase(slug)}/seance`)
  redirect(returnTo)
}

export async function resumeFitnessPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)

  const { data: startedOther } = await supabase
    .from('client_fitness_plans')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'started')
    .neq('id', planId)
    .maybeSingle()

  if (startedOther) {
    redirect(`${returnTo}?plan_error=already_active`)
  }

  const { error } = await supabase
    .from('client_fitness_plans')
    .update({ status: 'started', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('status', 'paused')

  if (error) redirect(`${returnTo}?plan_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath(`${portalBase(slug)}/seance`)
  redirect(returnTo)
}

export async function startNutritionPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)
  const { chatDb } = await import('../../../lib/chat/chat')
  const db = chatDb(supabase)

  const { data: plan } = await db
    .from('client_nutrition_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!plan || plan.status !== 'waiting') {
    redirect(`${returnTo}?nut_error=invalid`)
  }

  const { data: startedOther } = await db
    .from('client_nutrition_plans')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'started')
    .maybeSingle()

  if (startedOther) {
    redirect(`${returnTo}?nut_error=already_active`)
  }

  const today = new Date().toISOString().slice(0, 10)
  const { error } = await db
    .from('client_nutrition_plans')
    .update({
      status: 'started',
      start_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId)
    .eq('client_id', clientId)

  if (error) redirect(`${returnTo}?nut_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  redirect(`${returnTo}?nut_started=1`)
}

export async function pauseNutritionPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)
  const { chatDb } = await import('../../../lib/chat/chat')
  const db = chatDb(supabase)

  const { error } = await db
    .from('client_nutrition_plans')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('status', 'started')

  if (error) redirect(`${returnTo}?nut_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  redirect(returnTo)
}

export async function resumeNutritionPlanAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const returnTo = String(formData.get('return_to') ?? '').trim() || `${portalBase(slug)}/home`

  if (!slug || !planId) redirect(returnTo)

  const { supabase, clientId } = await requireClientForPortal(slug)
  const { chatDb } = await import('../../../lib/chat/chat')
  const db = chatDb(supabase)

  const { data: startedOther } = await db
    .from('client_nutrition_plans')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'started')
    .neq('id', planId)
    .maybeSingle()

  if (startedOther) {
    redirect(`${returnTo}?nut_error=already_active`)
  }

  const { error } = await db
    .from('client_nutrition_plans')
    .update({ status: 'started', updated_at: new Date().toISOString() })
    .eq('id', planId)
    .eq('client_id', clientId)
    .eq('status', 'paused')

  if (error) redirect(`${returnTo}?nut_error=${encodeURIComponent(error.message)}`)

  revalidatePath(`${portalBase(slug)}/home`)
  redirect(returnTo)
}

export async function validateMealAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()
  const mealId = String(formData.get('meal_id') ?? '').trim()
  const dayDate = String(formData.get('day_date') ?? '').trim()
  const undo = String(formData.get('undo') ?? '').trim() === '1'

  if (!slug || !planId || !mealId || !dayDate) {
    redirect(`${portalBase(slug)}/home`)
  }

  const { supabase, clientId } = await requireClientForPortal(slug)
  const { chatDb } = await import('../../../lib/chat/chat')
  const db = chatDb(supabase)

  const { data: plan } = await db
    .from('client_nutrition_plans')
    .select('id, status')
    .eq('id', planId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!plan || (plan.status !== 'started' && plan.status !== 'paused')) {
    redirect(`${portalBase(slug)}/home?nut_error=invalid`)
  }

  const { data: existing } = await db
    .from('nutrition_day_logs')
    .select('id, meals_validated')
    .eq('plan_id', planId)
    .eq('day_date', dayDate)
    .maybeSingle()

  const meals: Record<string, boolean> = {
    ...((existing?.meals_validated as Record<string, boolean>) ?? {}),
  }
  if (undo) delete meals[mealId]
  else meals[mealId] = true

  if (existing?.id) {
    await db
      .from('nutrition_day_logs')
      .update({
        meals_validated: meals,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
  } else {
    await db.from('nutrition_day_logs').insert({
      plan_id: planId,
      client_id: clientId,
      day_date: dayDate,
      meals_validated: meals,
    })
  }

  revalidatePath(`${portalBase(slug)}/home`)
  redirect(`${portalBase(slug)}/home`)
}
