import { chatDb } from '@/src/lib/chat/chat'
import { quotaGoForPlan } from '@/src/lib/admin/listAdminCoaches'

export { quotaGoForPlan }

export type DriveQuotaSnapshot = {
  planTier: string
  quotaGo: number
  quotaBytes: number
  usedBytes: number
  remainingBytes: number
  pct: number
  full: boolean
}

/** Usage Drive perso (fichiers non archivés). */
export async function getCoachDriveQuota(
  supabase: unknown,
  coachId: string,
): Promise<DriveQuotaSnapshot> {
  const db = chatDb(supabase)

  const [{ data: sub }, { data: files }] = await Promise.all([
    db.from('coach_subscriptions').select('plan_tier').eq('coach_id', coachId).maybeSingle(),
    db
      .from('drive_files')
      .select('size_bytes')
      .eq('coach_id', coachId)
      .is('deleted_at', null)
      .limit(5000),
  ])

  const planTier = String(sub?.plan_tier || 'business').toLowerCase()
  const quotaGo = quotaGoForPlan(planTier)
  const quotaBytes = quotaGo * 1024 * 1024 * 1024
  let usedBytes = 0
  for (const f of files ?? []) {
    usedBytes += Number(f.size_bytes ?? 0)
  }
  const remainingBytes = Math.max(0, quotaBytes - usedBytes)
  const pct = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10) : 0

  return {
    planTier,
    quotaGo,
    quotaBytes,
    usedBytes,
    remainingBytes,
    pct,
    full: usedBytes >= quotaBytes,
  }
}

/** true si on peut ajouter `additionalBytes` sans dépasser le quota. */
export function canFitInQuota(snap: DriveQuotaSnapshot, additionalBytes: number): boolean {
  if (additionalBytes <= 0) return !snap.full
  return snap.usedBytes + additionalBytes <= snap.quotaBytes
}
