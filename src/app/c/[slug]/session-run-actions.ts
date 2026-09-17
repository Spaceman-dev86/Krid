'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isActivePlanStatus } from '../../../lib/client-portal/fitnessPlans'
import {
  buildSessionSnapshot,
  emptyRealized,
  markPendingAsNonFait,
  resolveFinishStyle,
  type SessionRunRealized,
} from '../../../lib/client-portal/sessionRuns'
import { resolveLibreFinishStyle } from '../../../lib/client-portal/diySessions'
import { fetchProgramPreviewStructure } from '../../../lib/fetchProgramPreviewStructure'
import { createClient } from '../../../lib/supabase/server'
import { chatDb } from '../../../lib/chat/chat'

function portalBase(slug: string) {
  return `/c/${slug}`
}

function sessionPath(slug: string, sessionId: string) {
  return `${portalBase(slug)}/programme/seance/${sessionId}`
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
    .select('id, coach_id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) redirect(`${portalBase(slug)}?error=not_your_coach`)

  return { supabase, clientId: client.id, coachId: client.coach_id, slug }
}

export async function startSessionRunAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const planId = String(formData.get('plan_id') ?? '').trim()

  if (!slug || !sessionId || !planId) redirect('/login/client')

  const { supabase, clientId, coachId } = await requireClientForPortal(slug)
  const returnTo = sessionPath(slug, sessionId)

  const { data: plan } = await supabase
    .from('client_fitness_plans')
    .select('id, status, source_program_id')
    .eq('id', planId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (!plan || !isActivePlanStatus(plan.status) || !plan.source_program_id) {
    redirect(`${returnTo}?run_error=plan`)
  }

  const { data: existingForSession } = await supabase
    .from('session_runs')
    .select('id, style')
    .eq('client_id', clientId)
    .eq('plan_id', planId)
    .eq('source_session_id', sessionId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingForSession) {
    if (existingForSession.style === 'en_cours') {
      redirect(`${returnTo}?run=${existingForSession.id}`)
    }
    redirect(`${returnTo}?run_error=already_done`)
  }

  const { data: otherEnCours } = await supabase
    .from('session_runs')
    .select('id, source_session_id')
    .eq('client_id', clientId)
    .eq('style', 'en_cours')
    .is('deleted_at', null)
    .maybeSingle()

  if (otherEnCours?.id && otherEnCours.source_session_id) {
    redirect(
      `${sessionPath(slug, otherEnCours.source_session_id)}?run=${otherEnCours.id}&run_error=other_en_cours`
    )
  }

  const structure = await fetchProgramPreviewStructure(supabase, plan.source_program_id)
  const session = structure.sessions.find((s) => s.id === sessionId)
  if (!session) redirect(`${returnTo}?run_error=session`)

  const snapshot = buildSessionSnapshot(session, structure)
  const realized = emptyRealized(snapshot)
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const { data: created, error } = await supabase
    .from('session_runs')
    .insert({
      client_id: clientId,
      coach_id: coachId,
      plan_id: planId,
      source_session_id: sessionId,
      source: 'plan',
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
    redirect(`${returnTo}?run_error=${encodeURIComponent(error?.message ?? 'insert_failed')}`)
  }

  revalidatePath(returnTo)
  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath(`${portalBase(slug)}/seance`)
  revalidatePath(`${portalBase(slug)}/historique`)
  redirect(`${returnTo}?run=${created.id}`)
}

export async function saveSessionRunProgressAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const runId = String(formData.get('run_id') ?? '').trim()
  const realizedRaw = String(formData.get('realized') ?? '').trim()
  const stay = String(formData.get('stay') ?? '').trim() === '1'
  const returnPath = String(formData.get('return_to') ?? '').trim()

  if (!slug || !runId) redirect('/login/client')

  const { supabase, clientId } = await requireClientForPortal(slug)
  const returnTo =
    returnPath ||
    (sessionId ? `${sessionPath(slug, sessionId)}?run=${runId}` : `${portalBase(slug)}/seance/run/${runId}`)

  let realized: SessionRunRealized
  try {
    realized = JSON.parse(realizedRaw) as SessionRunRealized
  } catch {
    if (stay) return { ok: false as const, error: 'bad_realized' }
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}run_error=bad_realized`)
  }

  const { error } = await supabase
    .from('session_runs')
    .update({
      realized,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('client_id', clientId)
    .eq('style', 'en_cours')

  if (error) {
    if (stay) return { ok: false as const, error: error.message }
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}run_error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(returnTo.split('?')[0])
  if (stay) return { ok: true as const }
  redirect(returnTo)
}

export async function finishSessionRunAction(formData: FormData) {
  const slug = String(formData.get('slug') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const runId = String(formData.get('run_id') ?? '').trim()
  const realizedRaw = String(formData.get('realized') ?? '').trim()
  const returnPath = String(formData.get('return_to') ?? '').trim()

  if (!slug || !runId) redirect('/login/client')

  const { supabase, clientId } = await requireClientForPortal(slug)
  const returnTo =
    returnPath ||
    (sessionId ? sessionPath(slug, sessionId) : `${portalBase(slug)}/seance`)

  let realized: SessionRunRealized
  try {
    realized = JSON.parse(realizedRaw) as SessionRunRealized
  } catch {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}run=${runId}&run_error=bad_realized`)
  }

  realized = markPendingAsNonFait(realized)
  const baseStyle = resolveFinishStyle(realized)

  const db = chatDb(supabase)
  const { data: runRow } = await db
    .from('session_runs')
    .select('source')
    .eq('id', runId)
    .eq('client_id', clientId)
    .maybeSingle()

  const style =
    runRow?.source === 'libre' ? resolveLibreFinishStyle(baseStyle) : baseStyle

  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('session_runs')
    .update({
      realized,
      style,
      actual_date: today,
      finished_at: now,
      updated_at: now,
    })
    .eq('id', runId)
    .eq('client_id', clientId)
    .eq('style', 'en_cours')

  if (error) {
    redirect(
      `${returnTo}${returnTo.includes('?') ? '&' : '?'}run=${runId}&run_error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(returnTo.split('?')[0])
  revalidatePath(`${portalBase(slug)}/home`)
  revalidatePath(`${portalBase(slug)}/seance`)
  revalidatePath(`${portalBase(slug)}/historique`)
  redirect(`${portalBase(slug)}/historique/seance/${runId}`)
}
