import type { createClient } from '../supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

type ClientRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  status: string
  coach_id: string
  onboarding_completed_at: string | null
}

const CLIENT_SELECT_FULL =
  'id, email, first_name, last_name, phone, status, coach_id, onboarding_completed_at'
const CLIENT_SELECT_BASE = 'id, email, first_name, last_name, phone, status, coach_id'

function normEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? ''
}

function pickRow(
  rows: Array<Record<string, unknown>>,
  authEmail: string
): ClientRow | null {
  if (!rows.length) return null
  const mapped = rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    first_name: (r.first_name as string | null) ?? null,
    last_name: (r.last_name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    status: String(r.status),
    coach_id: String(r.coach_id),
    onboarding_completed_at: (r.onboarding_completed_at as string | null) ?? null,
  }))
  if (authEmail) {
    const byEmail = mapped.find((r) => normEmail(r.email) === authEmail)
    if (byEmail) return byEmail
  }
  return mapped[0] ?? null
}

/** Choisit la fiche client quand plusieurs partagent le même user_id (bug invite). */
export async function pickClientForAuthUser(
  supabase: Supabase,
  userId: string,
  coachId?: string
): Promise<ClientRow | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  const authEmail = normEmail(profile?.email)

  async function run(select: string) {
    let query = supabase.from('clients').select(select).eq('user_id', userId).is('deleted_at', null)
    if (coachId) query = query.eq('coach_id', coachId)
    return query
  }

  const first = await run(CLIENT_SELECT_FULL)
  if (!first.error && first.data?.length) {
    return pickRow(first.data as Array<Record<string, unknown>>, authEmail)
  }

  // Colonne onboarding_completed_at absente (tranche 26 pas encore run) → fallback
  if (first.error && /onboarding_completed_at/i.test(first.error.message)) {
    const second = await run(CLIENT_SELECT_BASE)
    if (!second.error && second.data?.length) {
      return pickRow(second.data as Array<Record<string, unknown>>, authEmail)
    }
  }

  return null
}

export async function pickClientCoachIdForAuthUser(
  supabase: Supabase,
  userId: string
): Promise<{ coach_id: string } | null> {
  const row = await pickClientForAuthUser(supabase, userId)
  return row ? { coach_id: row.coach_id } : null
}
