import type { createClient } from '../supabase/server'
import { createServiceRoleClient } from '../supabase/serviceRole'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Les comptes créés via showroom / rejoindre (ou invite legacy) doivent être `client`.
 * (Le trigger handle_new_user defaultait à `coach` si metadata absente.)
 */
export async function ensureAuthUserIsClient(supabase: Supabase, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (!profile || profile.role === 'client') return
  if (profile.role === 'platform_admin' || profile.role === 'admin') return

  // Prefer service role: user may not be allowed to update own role via RLS
  const admin = createServiceRoleClient()
  const db = admin ?? supabase
  await db.from('profiles').update({ role: 'client', updated_at: new Date().toISOString() }).eq('id', userId)
}
