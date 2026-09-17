import type { SupabaseClient, User } from '@supabase/supabase-js'

export function userMetadataPasswordSet(user: User | null | undefined): boolean {
  if (!user) return false
  const meta = user.user_metadata as { password_set?: unknown } | null
  return meta?.password_set === true
}

/** Lit password_set_at (colonne) ou fallback metadata. */
export async function hasPasswordSet(
  supabase: SupabaseClient,
  user: User
): Promise<boolean> {
  if (userMetadataPasswordSet(user)) return true

  const { data, error } = await supabase
    .from('profiles')
    .select('password_set_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error && /password_set_at/i.test(error.message)) {
    return false
  }

  const row = data as { password_set_at?: string | null } | null
  return Boolean(row?.password_set_at)
}

export async function markPasswordSet(supabase: SupabaseClient, userId: string) {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({ password_set_at: now, updated_at: now })
    .eq('id', userId)

  if (error && /password_set_at/i.test(error.message)) {
    return
  }
}

export function buildSetPasswordUrl(origin: string, nextPath: string | null | undefined) {
  const url = new URL('/auth/update-password', origin)
  if (nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//')) {
    url.searchParams.set('next', nextPath)
  }
  url.searchParams.set('mode', 'set')
  return url
}
