'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { chatDb } from '../../../lib/chat/chat'
import {
  buildDiySnapshot,
  diyEmptyRealized,
  type DiyExerciseInput,
} from '../../../lib/client-portal/diySessions'
import type { SessionRunSnapshot } from '../../../lib/client-portal/sessionRuns'
import { createClient } from '../../../lib/supabase/server'

function portalBase(slug: string) {
  return `/c/${slug}`
}

async function requirePortalClient(slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(portalBase(slug) + '/seance')}`)
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const { data: client } = await supabase
    .from('clients')
    .select('id, coach_id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}?error=not_your_coach`)

  return {
    supabase,
    userId: user.id,
    clientId: client.id,
    coachId: client.coach_id as string,
    slug,
  }
}

function parseExercisesFromForm(formData: FormData): DiyExerciseInput[] {
  const raw = String(formData.get('exercises_json') ?? '').trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as DiyExerciseInput[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((e) => e && String(e.name ?? '').trim())
  } catch {
    return []
  }
}

export async function saveDiyDraftAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance libre'
  const draftId = String(formData.get('draft_id') ?? '').trim()
  if (!slug) redirect('/login/client')

  const ctx = await requirePortalClient(slug)
  const exercises = parseExercisesFromForm(formData)
  if (!exercises.length) {
    redirect(`${portalBase(slug)}/seance/new?error=${encodeURIComponent('Ajoute au moins un exercice')}`)
  }

  const snapshot = buildDiySnapshot(title, exercises, draftId || undefined)
  const db = chatDb(ctx.supabase)
  const now = new Date().toISOString()

  if (draftId) {
    const { error } = await db
      .from('client_diy_sessions')
      .update({ title, snapshot, updated_at: now })
      .eq('id', draftId)
      .eq('client_id', ctx.clientId)
    if (error) {
      redirect(`${portalBase(slug)}/seance/new?error=${encodeURIComponent(error.message)}`)
    }
  } else {
    const { data, error } = await db
      .from('client_diy_sessions')
      .insert({
        client_id: ctx.clientId,
        coach_id: ctx.coachId,
        title,
        snapshot,
      })
      .select('id')
      .maybeSingle()
    if (error || !data?.id) {
      redirect(
        `${portalBase(slug)}/seance/new?error=${encodeURIComponent(error?.message ?? 'save_failed')}`
      )
    }
  }

  revalidatePath(`${portalBase(slug)}/seance`)
  redirect(`${portalBase(slug)}/seance?saved=1`)
}

export async function startDiySessionAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim() || 'Séance libre'
  const draftId = String(formData.get('draft_id') ?? '').trim()
  if (!slug) redirect('/login/client')

  const ctx = await requirePortalClient(slug)
  const db = chatDb(ctx.supabase)

  let snapshot: SessionRunSnapshot
  if (draftId && !formData.get('exercises_json')) {
    const { data: draft } = await db
      .from('client_diy_sessions')
      .select('id, title, snapshot')
      .eq('id', draftId)
      .eq('client_id', ctx.clientId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!draft?.snapshot) {
      redirect(`${portalBase(slug)}/seance?error=${encodeURIComponent('Brouillon introuvable')}`)
    }
    snapshot = draft.snapshot as SessionRunSnapshot
    snapshot = { ...snapshot, title: draft.title || title }
  } else {
    const exercises = parseExercisesFromForm(formData)
    if (!exercises.length) {
      redirect(`${portalBase(slug)}/seance/new?error=${encodeURIComponent('Ajoute au moins un exercice')}`)
    }
    snapshot = buildDiySnapshot(title, exercises)
  }

  if (!snapshot.items?.length) {
    redirect(`${portalBase(slug)}/seance/new?error=${encodeURIComponent('Séance vide')}`)
  }

  const { data: otherEnCours } = await ctx.supabase
    .from('session_runs')
    .select('id, source, source_session_id')
    .eq('client_id', ctx.clientId)
    .eq('style', 'en_cours')
    .is('deleted_at', null)
    .maybeSingle()

  if (otherEnCours?.id) {
    if (otherEnCours.source === 'libre') {
      redirect(`${portalBase(slug)}/seance/run/${otherEnCours.id}`)
    }
    if (otherEnCours.source_session_id) {
      redirect(
        `${portalBase(slug)}/programme/seance/${otherEnCours.source_session_id}?run=${otherEnCours.id}&run_error=other_en_cours`
      )
    }
    redirect(`${portalBase(slug)}/seance?error=${encodeURIComponent('Une séance est déjà en cours')}`)
  }

  const realized = diyEmptyRealized(snapshot)
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const { data: created, error } = await ctx.supabase
    .from('session_runs')
    .insert({
      client_id: ctx.clientId,
      coach_id: ctx.coachId,
      plan_id: null,
      source_session_id: null,
      source: 'libre',
      title: snapshot.title,
      scheduled_date: today,
      actual_date: today,
      style: 'en_cours',
      snapshot,
      realized,
      started_at: now,
      updated_at: now,
    })
    .select('id')
    .maybeSingle()

  if (error || !created?.id) {
    redirect(
      `${portalBase(slug)}/seance/new?error=${encodeURIComponent(error?.message ?? 'start_failed')}`
    )
  }

  // Soft-delete draft if started from one
  if (draftId) {
    await db
      .from('client_diy_sessions')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', draftId)
      .eq('client_id', ctx.clientId)
  }

  revalidatePath(`${portalBase(slug)}/seance`)
  revalidatePath(`${portalBase(slug)}/home`)
  redirect(`${portalBase(slug)}/seance/run/${created.id}`)
}

export async function deleteDiyDraftAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const draftId = String(formData.get('draft_id') ?? '').trim()
  if (!slug || !draftId) redirect('/login/client')

  const ctx = await requirePortalClient(slug)
  const db = chatDb(ctx.supabase)
  const now = new Date().toISOString()
  await db
    .from('client_diy_sessions')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', draftId)
    .eq('client_id', ctx.clientId)

  revalidatePath(`${portalBase(slug)}/seance`)
  redirect(`${portalBase(slug)}/seance`)
}
