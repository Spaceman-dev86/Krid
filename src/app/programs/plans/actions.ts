'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/src/lib/supabase/server'

function clean(value: FormDataEntryValue | null) {
  const s = String(value ?? '').trim()
  return s.length ? s : null
}

type CoachComment = {
  id: string
  text: string
  created_at: string
  coach_id: string
}

/** Ajoute un commentaire coach empilé sur le run (notif client à brancher). */
export async function addPlanSessionCoachCommentAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'auth' }

  const runId = clean(formData.get('run_id'))
  const planId = clean(formData.get('plan_id'))
  const text = clean(formData.get('text'))
  if (!runId || !planId || !text) return { ok: false as const, error: 'missing' }

  const { data: run, error: loadErr } = await supabase
    .from('session_runs')
    .select('id, coach_id, coach_comments')
    .eq('id', runId)
    .eq('coach_id', user.id)
    .maybeSingle()

  if (loadErr || !run) return { ok: false as const, error: loadErr?.message ?? 'not_found' }

  const prev = Array.isArray(run.coach_comments) ? (run.coach_comments as CoachComment[]) : []
  const entry: CoachComment = {
    id: crypto.randomUUID(),
    text,
    created_at: new Date().toISOString(),
    coach_id: user.id,
  }
  const next: CoachComment[] = [...prev, entry]

  const { error } = await supabase
    .from('session_runs')
    .update({
      coach_comments: next,
      updated_at: new Date().toISOString(),
    })
    .eq('id', runId)
    .eq('coach_id', user.id)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/programs/plans/${planId}`)
  return {
    ok: true as const,
    comment: { id: entry.id, text: entry.text, createdAt: entry.created_at },
  }
}
