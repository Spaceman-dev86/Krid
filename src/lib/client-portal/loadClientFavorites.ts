import type { SupabaseClient } from '@supabase/supabase-js'

/** client_favorites not yet in generated Database types (slice 15). */
export async function loadClientFavorites(
  supabase: SupabaseClient,
  clientId: string
): Promise<Array<{ target_type: string; target_id: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('client_favorites')
    .select('target_type, target_id')
    .eq('client_id', clientId)
  return (data ?? []) as Array<{ target_type: string; target_id: string }>
}
