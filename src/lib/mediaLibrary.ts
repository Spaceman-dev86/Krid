import { createClient } from '@/src/lib/supabase/server'

export const MEDIA_LIBRARY_BUCKET = 'media-library'

export type MediaLibraryCover = {
  id: string
  storage_path: string
  label: string | null
  category: string | null
  publicUrl: string
}

export function mediaLibraryPublicUrl(storagePath: string, supabaseUrl?: string | null) {
  const base = (supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  const path = storagePath.replace(/^\//, '')
  if (!base || !path) return ''
  return `${base}/storage/v1/object/public/${MEDIA_LIBRARY_BUCKET}/${path}`
}

/** Covers actives pour le picker coach (échoue soft si table absente). */
export async function listActiveMediaLibraryCovers(): Promise<MediaLibraryCover[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_library')
    .select('id, storage_path, label, category, sort_order')
    .eq('kind', 'cover')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (error || !data) return []

  return (data as Array<{
    id: string
    storage_path: string
    label: string | null
    category: string | null
  }>).map((row) => ({
    id: row.id,
    storage_path: row.storage_path,
    label: row.label,
    category: row.category,
    publicUrl: mediaLibraryPublicUrl(row.storage_path),
  })).filter((r) => r.publicUrl)
}
