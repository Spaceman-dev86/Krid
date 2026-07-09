import type { SupabaseClient } from '@supabase/supabase-js'

import { programCoverBucket } from './programCoverStorage'

const COVER_FOLDER = '3-programs'
const COVER_EXTENSIONS = ['jpg', 'png', 'webp', 'gif'] as const

/** Rewrites legacy storage paths (e.g. `programs/{id}.jpg`) to `3-programs/{id}.jpg`. */
export function normalizeProgramCoverUrl(
  imageUrl: string | null | undefined,
  programId: string
): string | null {
  const value = String(imageUrl ?? '').trim()
  if (!value) return null

  const legacySegments = [`/programs/${programId}.`, `/3-programs/programs/${programId}.`]
  for (const legacy of legacySegments) {
    const index = value.indexOf(legacy)
    if (index === -1) continue

    const prefix = value.slice(0, index)
    const suffix = value.slice(index + legacy.length)
    const ext = suffix.split(/[?#]/)[0]
    if (!ext) continue

    return `${prefix}/${COVER_FOLDER}/${programId}.${ext}`
  }

  return value
}

function programCoverPublicUrl(supabase: SupabaseClient, programId: string, ext: string): string | null {
  const { data } = supabase.storage.from(programCoverBucket()).getPublicUrl(`${COVER_FOLDER}/${programId}.${ext}`)
  const publicUrl = String(data?.publicUrl ?? '').trim()
  return publicUrl || null
}

async function findStoredProgramCoverUrl(supabase: SupabaseClient, programId: string): Promise<string | null> {
  for (const ext of COVER_EXTENSIONS) {
    const url = programCoverPublicUrl(supabase, programId, ext)
    if (!url) continue

    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) return url
    } catch {
      // Ignore network errors and try the next extension.
    }
  }

  return null
}

/** Resolves a program cover URL from DB value, legacy paths, or storage. */
export async function resolveProgramCoverUrl(
  supabase: SupabaseClient,
  programId: string,
  imageUrl: string | null | undefined
): Promise<string | null> {
  const normalized = normalizeProgramCoverUrl(imageUrl, programId)
  if (normalized) {
    try {
      const response = await fetch(normalized, { method: 'HEAD' })
      if (response.ok) return normalized
    } catch {
      // Fall through to storage lookup.
    }
  }

  return findStoredProgramCoverUrl(supabase, programId)
}

export async function resolveProgramCoverUrls(
  supabase: SupabaseClient,
  programs: { id: string; image_url: string | null }[]
): Promise<Map<string, string | null>> {
  const entries = await Promise.all(
    programs.map(async (program) => [
      program.id,
      await resolveProgramCoverUrl(supabase, program.id, program.image_url),
    ] as const)
  )

  return new Map(entries)
}
