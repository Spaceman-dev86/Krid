import type { SupabaseClient } from '@supabase/supabase-js'

import { chatDb } from '../chat/chat'

export type CoachSubStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'expired_trial' | 'none'

export type AdminCoachListRow = {
  id: string
  email: string | null
  full_name: string | null
  created_at: string | null
  suspended_at: string | null
  plan_tier: string | null
  status: CoachSubStatus
  trial_ends_at: string | null
  client_count: number
  slug: string | null
  open_tickets: number
  /** sandbox = essai / expired_trial · prod = payant / past_due */
  environment: 'sandbox' | 'prod' | '—'
  storage_used_bytes: number
  storage_quota_go: number
  storage_pct: number
  /** Admin avec workspace coach (ex. Remi) */
  is_staff_coach: boolean
}

export type AdminCoachFilter = 'all' | 'trial' | 'payant' | 'past_due' | 'suspended' | 'expired'

type Untyped = SupabaseClient<any>

const QUOTA_GO: Record<string, number> = {
  starter: 5,
  business: 25,
  scale: 100,
  studio: 500,
}

export function quotaGoForPlan(planTier: string | null | undefined): number {
  return QUOTA_GO[(planTier || 'business').toLowerCase()] ?? 25
}

export function environmentForStatus(status: CoachSubStatus): 'sandbox' | 'prod' | '—' {
  if (status === 'trial' || status === 'expired_trial') return 'sandbox'
  if (status === 'active' || status === 'past_due') return 'prod'
  return '—'
}

export async function listAdminCoaches(
  supabase: Untyped,
  opts: { filter?: AdminCoachFilter; q?: string } = {},
): Promise<{ rows: AdminCoachListRow[]; error: string | null }> {
  const filter = opts.filter ?? 'all'
  const q = (opts.q ?? '').trim().toLowerCase()

  const { data: coaches, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, suspended_at, role, coach_workspace')
    .or('role.eq.coach,coach_workspace.eq.true')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)

  // Fallback si colonne coach_workspace absente (migration 38)
  let coachRows = coaches
  if (error && /coach_workspace/i.test(error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select('id, email, full_name, created_at, suspended_at, role')
      .eq('role', 'coach')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500)
    if (fallback.error) return { rows: [], error: fallback.error.message }
    coachRows = (fallback.data ?? []).map((c) => ({ ...c, coach_workspace: false }))
  } else if (error) {
    return { rows: [], error: error.message }
  }

  if (!coachRows?.length) return { rows: [], error: null }

  const ids = coachRows.map((c: { id: string }) => c.id)
  const db = chatDb(supabase)

  const [{ data: subs }, { data: branding }, { data: clients }, { data: tickets }, { data: driveFiles }] =
    await Promise.all([
      supabase
        .from('coach_subscriptions')
        .select('coach_id, plan_tier, status, trial_ends_at, created_at')
        .in('coach_id', ids)
        .order('created_at', { ascending: false }),
      supabase.from('coach_branding').select('coach_id, slug').in('coach_id', ids),
      supabase.from('clients').select('coach_id').in('coach_id', ids).is('deleted_at', null),
      supabase
        .from('support_tickets')
        .select('coach_id, status')
        .in('coach_id', ids)
        .in('status', ['nouveau', 'en_cours', 'attente_coach']),
      db.from('drive_files').select('coach_id, size_bytes').in('coach_id', ids).is('deleted_at', null).limit(20000),
    ])

  const subByCoach = new Map<string, { plan_tier: string; status: string; trial_ends_at: string | null }>()
  for (const s of subs ?? []) {
    if (!subByCoach.has(s.coach_id)) {
      subByCoach.set(s.coach_id, {
        plan_tier: s.plan_tier,
        status: s.status,
        trial_ends_at: s.trial_ends_at,
      })
    }
  }

  const slugByCoach = new Map<string, string>()
  for (const b of branding ?? []) {
    slugByCoach.set(b.coach_id, b.slug)
  }

  const clientCount = new Map<string, number>()
  for (const c of clients ?? []) {
    clientCount.set(c.coach_id, (clientCount.get(c.coach_id) ?? 0) + 1)
  }

  const openTickets = new Map<string, number>()
  for (const t of tickets ?? []) {
    openTickets.set(t.coach_id, (openTickets.get(t.coach_id) ?? 0) + 1)
  }

  const storageByCoach = new Map<string, number>()
  for (const f of driveFiles ?? []) {
    storageByCoach.set(f.coach_id, (storageByCoach.get(f.coach_id) ?? 0) + Number(f.size_bytes ?? 0))
  }

  let rows: AdminCoachListRow[] = coachRows.map(
    (c: {
      id: string
      email: string | null
      full_name: string | null
      created_at: string | null
      suspended_at: string | null
      role?: string | null
      coach_workspace?: boolean | null
    }) => {
      const sub = subByCoach.get(c.id)
      const status = (sub?.status as CoachSubStatus) ?? 'none'
      const plan = sub?.plan_tier ?? null
      const quotaGo = quotaGoForPlan(plan)
      const used = storageByCoach.get(c.id) ?? 0
      const quotaBytes = quotaGo * 1024 * 1024 * 1024
      const pct = quotaBytes > 0 ? Math.min(999, Math.round((used / quotaBytes) * 1000) / 10) : 0
      const isStaff =
        c.role === 'admin' || c.role === 'platform_admin' || Boolean(c.coach_workspace)
      return {
        id: c.id,
        email: c.email,
        full_name: c.full_name,
        created_at: c.created_at,
        suspended_at: c.suspended_at ?? null,
        plan_tier: plan,
        status,
        trial_ends_at: sub?.trial_ends_at ?? null,
        client_count: clientCount.get(c.id) ?? 0,
        slug: slugByCoach.get(c.id) ?? null,
        open_tickets: openTickets.get(c.id) ?? 0,
        environment: environmentForStatus(status),
        storage_used_bytes: used,
        storage_quota_go: quotaGo,
        storage_pct: pct,
        is_staff_coach: isStaff && c.role !== 'coach',
      }
    },
  )

  if (filter === 'trial') rows = rows.filter((r) => r.status === 'trial')
  if (filter === 'payant') rows = rows.filter((r) => r.status === 'active')
  if (filter === 'past_due') rows = rows.filter((r) => r.status === 'past_due')
  if (filter === 'suspended') rows = rows.filter((r) => Boolean(r.suspended_at))
  if (filter === 'expired') rows = rows.filter((r) => r.status === 'expired_trial')

  if (q) {
    rows = rows.filter((r) => {
      const hay = `${r.full_name ?? ''} ${r.email ?? ''} ${r.slug ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }

  return { rows, error: null }
}

export function statusLabel(status: CoachSubStatus): string {
  switch (status) {
    case 'trial':
      return 'Essai'
    case 'active':
      return 'Actif'
    case 'past_due':
      return 'Past due'
    case 'canceled':
      return 'Annulé'
    case 'expired_trial':
      return 'Essai expiré'
    default:
      return 'Sans abo'
  }
}
