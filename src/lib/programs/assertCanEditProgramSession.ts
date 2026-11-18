import type { SupabaseClient } from '@supabase/supabase-js'

import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'

export type ProgramSessionAccess =
  | {
      ok: true
      sessionId: string
      weekId: string
      programId: string
      title: string
      composition_version: number
    }
  | { ok: false; error: string; status: number }

/** Coach propriétaire du programme (ou platform admin) peut éditer la séance. */
export async function assertCanEditProgramSession(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  role: string | null | undefined,
): Promise<ProgramSessionAccess> {
  const id = String(sessionId ?? '').trim()
  if (!id) return { ok: false, error: 'Séance manquante', status: 400 }

  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('id, title, week_id, composition_version')
    .eq('id', id)
    .maybeSingle()

  if (sErr) return { ok: false, error: sErr.message, status: 500 }
  if (!session) return { ok: false, error: 'Séance introuvable', status: 404 }

  const { data: week, error: wErr } = await supabase
    .from('program_weeks')
    .select('id, program_id')
    .eq('id', session.week_id)
    .maybeSingle()

  if (wErr) return { ok: false, error: wErr.message, status: 500 }
  if (!week) return { ok: false, error: 'Semaine introuvable', status: 404 }

  const { data: program, error: pErr } = await supabase
    .from('programs')
    .select('id, coach_id, deleted_at')
    .eq('id', week.program_id)
    .maybeSingle()

  if (pErr) return { ok: false, error: pErr.message, status: 500 }
  if (!program || program.deleted_at) {
    return { ok: false, error: 'Programme introuvable', status: 404 }
  }

  if (!isPlatformAdmin(role) && program.coach_id !== userId) {
    return { ok: false, error: 'Accès refusé', status: 403 }
  }
  if (!isPlatformAdmin(role) && !canAccessCoachApp(role)) {
    return { ok: false, error: 'Accès refusé', status: 403 }
  }

  return {
    ok: true,
    sessionId: session.id,
    weekId: session.week_id,
    programId: program.id,
    title: session.title?.trim() || 'Séance',
    composition_version: session.composition_version ?? 0,
  }
}

/** Vérifie l’accès via un session_block (copie programme). */
export async function assertCanEditProgramSessionBlock(
  supabase: SupabaseClient,
  sessionBlockId: string,
  userId: string,
  role: string | null | undefined,
): Promise<ProgramSessionAccess> {
  const id = String(sessionBlockId ?? '').trim()
  if (!id) return { ok: false, error: 'Bloc manquant', status: 400 }

  const { data: block, error } = await supabase
    .from('session_blocks')
    .select('program_session_id')
    .eq('id', id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!block?.program_session_id) {
    return { ok: false, error: 'Bloc introuvable', status: 404 }
  }

  return assertCanEditProgramSession(supabase, block.program_session_id, userId, role)
}
