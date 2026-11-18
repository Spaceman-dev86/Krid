'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'
import { assertCanEditProgramSession } from '@/src/lib/programs/assertCanEditProgramSession'
import { parseSessionCompositionFormData } from '@/src/lib/sessions/parseSessionCompositionForm'
import { loadProgramSessionBoardSnapshot } from '@/src/app/admin/programs/programSessionActions'
import { writeProgramSessionComposition } from '@/src/lib/sessions/writeProgramSessionComposition'
import { createClient } from '@/src/lib/supabase/server'

function safeReturnTo(raw: string): string | null {
  const v = raw.trim()
  if (!v.startsWith('/')) return null
  if (v.startsWith('//')) return null
  try {
    const u = new URL(v, 'http://local.invalid')
    if (u.pathname.startsWith('/programs/plans/')) {
      const out = new URLSearchParams()
      const w = u.searchParams.get('w')
      const sid = u.searchParams.get('sid')
      if (w && /^\d+$/.test(w)) out.set('w', w)
      if (sid && /^[0-9a-f-]{36}$/i.test(sid)) out.set('sid', sid)
      const q = out.toString()
      return q ? `${u.pathname}?${q}` : u.pathname
    }
    if (u.pathname.startsWith('/programs/')) return u.pathname
  } catch {
    return null
  }
  return null
}

/** Enregistre la composition séance (SessionFicheEditor) pour un programme coach. */
export async function saveCoachProgramSessionCompositionAction(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = profile?.role ?? null
  if (!canAccessCoachApp(role) && !isPlatformAdmin(role)) redirect('/login')

  const programId = String(formData.get('program_id') ?? '').trim()
  const sessionId = String(formData.get('session_id') ?? '').trim()
  const returnTo = safeReturnTo(String(formData.get('return_to') ?? ''))
  const failBase =
    returnTo ??
    (programId && sessionId
      ? `/programs/${programId}/sessions/${sessionId}/edit`
      : '/programs')

  function fail(msg: string): never {
    const sep = failBase.includes('?') ? '&' : '?'
    redirect(`${failBase}${sep}error=${encodeURIComponent(msg)}`)
  }

  if (!programId || !sessionId) fail('Paramètres manquants')

  const access = await assertCanEditProgramSession(supabase, sessionId, user.id, role)
  if (!access.ok) fail(access.error)
  if (access.programId !== programId) fail('Séance hors programme')

  const expectedRaw = String(formData.get('expected_version') ?? '').trim()
  const expectedParsed = expectedRaw ? Number.parseInt(expectedRaw, 10) : NaN
  const expectedVersion = Number.isFinite(expectedParsed) ? expectedParsed : null

  const title = String(formData.get('name') ?? '').trim() || access.title
  const notes = String(formData.get('notes') ?? '').trim() || null
  const objectiveRessenti = formData.get('objective_ressenti') === 'on'
  const objectiveNote = formData.get('objective_note') === 'on'
  const objectiveDifficulty = formData.get('objective_difficulty') === 'on'

  const { error: metaErr } = await supabase
    .from('sessions')
    .update({
      title,
      notes,
      description: notes,
      objective_ressenti: objectiveRessenti,
      objective_note: objectiveNote,
      objective_difficulty: objectiveDifficulty,
    } as never)
    .eq('id', sessionId)
    .eq('week_id', access.weekId)
  if (metaErr) fail(metaErr.message)

  const slots = parseSessionCompositionFormData(formData)
  const result = await writeProgramSessionComposition(supabase, sessionId, slots, {
    expectedVersion,
  })
  if (!result.ok) fail(result.error)

  // Touch snapshot (orphan ids) — utile si on reste sur la page sans redirect immédiat.
  await loadProgramSessionBoardSnapshot(supabase, sessionId)

  revalidatePath(`/programs/${programId}`)
  revalidatePath(`/programs/${programId}/sessions/${sessionId}/edit`)
  if (returnTo) {
    revalidatePath(returnTo.split('?')[0])
    redirect(returnTo)
  }
  redirect(`/programs/${programId}/sessions/${sessionId}/edit`)
}
