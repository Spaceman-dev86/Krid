import type { SupabaseClient } from '@supabase/supabase-js'

type ProgramAccessRow = { id: string; coach_id: string }

export type ProgramEditorAccessResult =
  | { ok: true; program: ProgramAccessRow }
  | { ok: false; code: string; message: string; status: number }

export async function assertCanEditProgram(
  supabase: SupabaseClient,
  programId: string,
  userId: string,
  isAdmin: boolean
): Promise<ProgramEditorAccessResult> {
  const { data, error } = await supabase
    .from('programs')
    .select('id,coach_id')
    .eq('id', programId)
    .maybeSingle()

  if (error) {
    return { ok: false, code: 'program.load_failed', message: error.message, status: 500 }
  }

  const program = data as ProgramAccessRow | null
  if (!program) {
    return { ok: false, code: 'program.not_found', message: 'Programme introuvable.', status: 404 }
  }

  if (!isAdmin && program.coach_id !== userId) {
    return { ok: false, code: 'auth.forbidden', message: 'Accès refusé à ce programme.', status: 403 }
  }

  return { ok: true, program }
}

export async function loadProgramEditorRole(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isAdmin: boolean }> {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  const profile = data as { role: string | null } | null
  return { isAdmin: profile?.role === 'admin' }
}
