/** Owners visibles en mode Coach : role=coach OU coach_workspace (admin Remi). */

export type CoachOwner = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  coach_workspace?: boolean | null
}

export async function listCatalogCoachOwners(
  supabase: {
    from: (t: string) => any
  },
  coachQ?: string,
): Promise<{ owners: CoachOwner[]; error: string | null }> {
  const q = (coachQ ?? '').trim()

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, role, coach_workspace')
    .or('role.eq.coach,coach_workspace.eq.true')
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .limit(500)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data, error } = await query

  if (error && /coach_workspace/i.test(error.message)) {
    let fallback = supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('role', 'coach')
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .limit(500)
    if (q) fallback = fallback.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
    const res = await fallback
    return {
      owners: (res.data ?? []) as CoachOwner[],
      error: res.error?.message ?? null,
    }
  }

  return { owners: (data ?? []) as CoachOwner[], error: error?.message ?? null }
}
