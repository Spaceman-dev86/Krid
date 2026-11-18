'use client'

import { getDriveFileSignedUrlAction } from '@/src/app/drive/actions'

/** Ouvre un fichier Drive (nouvel onglet) via URL signée. */
export async function openDriveFile(fileId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await getDriveFileSignedUrlAction(fileId)
  if (!res.ok) return { ok: false, error: res.error }
  window.open(res.url, '_blank', 'noopener,noreferrer')
  return { ok: true }
}
