import { chatDb } from '../chat/chat'
import { createServiceRoleClient } from '../supabase/serviceRole'

export type DriveFolderRow = {
  id: string
  coach_id: string
  parent_id: string | null
  name: string
  created_at: string
}

export type DriveFileRow = {
  id: string
  coach_id: string
  folder_id: string | null
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export type DriveShareInfo = {
  id: string
  file_id: string | null
  folder_id: string | null
  client_id: string
  client_label: string
}

export type DriveFolderOption = {
  id: string
  name: string
  parent_id: string | null
  label: string
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—'
  if (n < 1024) return `${n} o`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`
}

export async function listFolders(
  supabase: unknown,
  coachId: string,
  parentId: string | null
) {
  const db = chatDb(supabase)
  let q = db
    .from('drive_folders')
    .select('id, coach_id, parent_id, name, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as DriveFolderRow[]
}

/** Tous les dossiers du coach (pour déplacer). */
export async function listAllFoldersForMove(supabase: unknown, coachId: string): Promise<DriveFolderOption[]> {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('drive_folders')
    .select('id, parent_id, name')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { id: string; parent_id: string | null; name: string }[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  function pathLabel(id: string): string {
    const parts: string[] = []
    let cur: string | null = id
    const guard = new Set<string>()
    while (cur && !guard.has(cur)) {
      guard.add(cur)
      const row = byId.get(cur)
      if (!row) break
      parts.unshift(row.name)
      cur = row.parent_id
    }
    return parts.join(' / ') || 'Dossier'
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parent_id: r.parent_id,
    label: pathLabel(r.id),
  }))
}

export async function listFiles(
  supabase: unknown,
  coachId: string,
  folderId: string | null
) {
  const db = chatDb(supabase)
  let q = db
    .from('drive_files')
    .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
  q = folderId ? q.eq('folder_id', folderId) : q.is('folder_id', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as DriveFileRow[]
}

export async function getFolder(supabase: unknown, folderId: string) {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('drive_folders')
    .select('id, coach_id, parent_id, name, created_at')
    .eq('id', folderId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as DriveFolderRow | null
}

export async function listSharesForCoach(
  supabase: unknown,
  coachId: string,
  clientLabelById: Map<string, string>
): Promise<{ byFile: Record<string, DriveShareInfo[]>; byFolder: Record<string, DriveShareInfo[]> }> {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('drive_shares')
    .select('id, file_id, folder_id, client_id')
    .eq('coach_id', coachId)
  if (error) throw new Error(error.message)

  const byFile: Record<string, DriveShareInfo[]> = {}
  const byFolder: Record<string, DriveShareInfo[]> = {}

  for (const s of data ?? []) {
    const info: DriveShareInfo = {
      id: s.id,
      file_id: s.file_id,
      folder_id: s.folder_id,
      client_id: s.client_id,
      client_label: clientLabelById.get(s.client_id) || 'Client',
    }
    if (s.file_id) {
      ;(byFile[s.file_id] ??= []).push(info)
    }
    if (s.folder_id) {
      ;(byFolder[s.folder_id] ??= []).push(info)
    }
  }
  return { byFile, byFolder }
}

/** Fichiers visibles client via partages (fichier ou dossier parent). */
export async function listSharedFilesForClient(supabase: unknown, clientId: string) {
  const db = chatDb(supabase)
  const { data: shares, error: sharesErr } = await db
    .from('drive_shares')
    .select('file_id, folder_id')
    .eq('client_id', clientId)
  if (sharesErr) throw new Error(sharesErr.message)

  const fileIds = new Set<string>()
  const folderIds = new Set<string>()
  for (const s of shares ?? []) {
    if (s.file_id) fileIds.add(s.file_id)
    if (s.folder_id) folderIds.add(s.folder_id)
  }

  const out: DriveFileRow[] = []
  if (fileIds.size) {
    const { data, error } = await db
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .in('id', Array.from(fileIds))
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as DriveFileRow[]))
  }
  if (folderIds.size) {
    const { data, error } = await db
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .in('folder_id', Array.from(folderIds))
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    for (const f of (data ?? []) as DriveFileRow[]) {
      if (!out.some((x) => x.id === f.id)) out.push(f)
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return out
}

/**
 * Signed URL pour ouverture / téléchargement.
 * Prefer service role après contrôle d’accès applicatif (RLS storage client souvent trop strict).
 */
export async function createSignedDownloadUrl(
  supabase: unknown,
  storagePath: string,
  expiresSec = 3600
): Promise<string | null> {
  const admin = createServiceRoleClient()
  const client = admin ?? chatDb(supabase)
  const { data, error } = await client.storage.from('drive').createSignedUrl(storagePath, expiresSec)
  if (error) return null
  return data?.signedUrl ?? null
}

export function isPreviewableMime(mime: string | null | undefined, name: string): boolean {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/') || m === 'application/pdf' || m.startsWith('video/')) return true
  const lower = name.toLowerCase()
  return /\.(pdf|png|jpe?g|gif|webp|mp4|mov|webm)$/.test(lower)
}
