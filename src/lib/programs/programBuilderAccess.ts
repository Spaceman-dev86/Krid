import { redirect } from 'next/navigation'

import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'
import { createClient } from '@/src/lib/supabase/server'

export type ProgramBuilderAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  isAdmin: boolean
}

/** Auth builder : admin plateforme OU coach app. */
export async function requireProgramBuilderUser(
  opts?: { adminLoginRedirect?: string },
): Promise<ProgramBuilderAuth> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(opts?.adminLoginRedirect ?? '/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as { role?: string | null } | null)?.role
  const isAdmin = isPlatformAdmin(role)
  if (!isAdmin && !canAccessCoachApp(role)) {
    redirect('/home')
  }
  return { supabase, userId: user.id, isAdmin }
}

export type EditableBuilderProgram = {
  id: string
  is_calendar: boolean
  coach_id: string | null
  is_trainly_catalog: boolean | null
}

/**
 * Programme éditable dans le day-board :
 * - admin : catalogue Trainly (`is_trainly_catalog`)
 * - coach : programme lui appartenant (hors soft-delete)
 */
export async function assertEditableBuilderProgram(
  supabase: Awaited<ReturnType<typeof createClient>>,
  programId: string,
  auth: Pick<ProgramBuilderAuth, 'userId' | 'isAdmin'>,
): Promise<EditableBuilderProgram | null> {
  const { data } = await supabase
    .from('programs')
    .select('id,is_calendar,coach_id,is_trainly_catalog,deleted_at')
    .eq('id', programId)
    .is('deleted_at', null)
    .maybeSingle()

  const row = data as
    | {
        id: string
        is_calendar: boolean | null
        coach_id: string | null
        is_trainly_catalog: boolean | null
        deleted_at: string | null
      }
    | null
  if (!row) return null

  if (auth.isAdmin && row.is_trainly_catalog === true) {
    return {
      id: row.id,
      is_calendar: Boolean(row.is_calendar),
      coach_id: row.coach_id,
      is_trainly_catalog: row.is_trainly_catalog,
    }
  }

  if (row.coach_id === auth.userId) {
    return {
      id: row.id,
      is_calendar: Boolean(row.is_calendar),
      coach_id: row.coach_id,
      is_trainly_catalog: row.is_trainly_catalog,
    }
  }

  return null
}
