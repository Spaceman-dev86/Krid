import type { SupabaseClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'exercise-media'

export function normalizeStoragePath(p: string, bucket = STORAGE_BUCKET) {
  let out = p.trim()
  if (out.startsWith('/')) out = out.slice(1)
  if (out.startsWith(`${bucket}/`)) out = out.slice(bucket.length + 1)
  return out
}

export function getStoragePathFromUrl(raw: string, bucket = STORAGE_BUCKET) {
  try {
    const u = new URL(raw)
    const parts = u.pathname.split('/').filter(Boolean)
    const idx = parts.findIndex((p) => p === 'object')
    if (idx === -1) return null
    const bucketIdx = idx + 2
    if (!parts[bucketIdx] || parts[bucketIdx] !== bucket) return null
    const internal = parts.slice(bucketIdx + 1).join('/')
    return internal || null
  } catch {
    return null
  }
}

export function isPngOrGifMedia(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return false
  const withoutQuery = pathOrUrl.split('?')[0] ?? pathOrUrl
  try {
    const pathname = /^https?:\/\//i.test(withoutQuery) ? new URL(withoutQuery).pathname : withoutQuery
    return /\.(png|gif)$/i.test(pathname)
  } catch {
    return /\.(png|gif)$/i.test(withoutQuery)
  }
}

export async function signExerciseMediaUrl(
  supabase: SupabaseClient,
  rawPathOrUrl: string | null,
  bucket = STORAGE_BUCKET,
) {
  if (!rawPathOrUrl) return null
  const raw = String(rawPathOrUrl).trim()
  if (!raw) return null

  const isHttp = /^https?:\/\//i.test(raw)
  const internalFromUrl = isHttp ? getStoragePathFromUrl(raw, bucket) : null
  const internalPath = internalFromUrl ?? (isHttp ? null : raw)

  if (!internalPath) {
    return raw
  }

  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(normalizeStoragePath(internalPath, bucket), 60 * 60)

  return data?.signedUrl ?? null
}
