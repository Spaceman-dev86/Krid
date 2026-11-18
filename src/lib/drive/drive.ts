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
  /** Client direct, ou null si partage groupe. */
  client_id: string | null
  group_id: string | null
  /** Label affiché (nom client ou nom groupe). */
  label: string
  kind: 'client' | 'group'
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

/** Nb de fichiers directs par dossier (cartes Drive). */
export async function countDirectFilesByFolderIds(
  supabase: unknown,
  coachId: string,
  folderIds: string[],
): Promise<Record<string, number>> {
  const { fileCountsByFolder } = await loadFolderCardStats(supabase, coachId, folderIds, [])
  return fileCountsByFolder
}

/**
 * Counts + noms + taille **directe** des dossiers visibles — 1 seule query scoped.
 * Pas de scan global des fichiers (trop lent à chaque hop).
 * `tree` conservé pour compat callers ; ignoré (tailles = somme fichiers directs).
 */
export async function loadFolderCardStats(
  supabase: unknown,
  coachId: string,
  folderIds: string[],
  _tree: { id: string; parent_id: string | null }[] = [],
): Promise<{
  fileCountsByFolder: Record<string, number>
  fileNamesByFolder: Record<string, { id: string; name: string }[]>
  sizeBytesByFolder: Record<string, number>
}> {
  const fileCountsByFolder: Record<string, number> = {}
  const fileNamesByFolder: Record<string, { id: string; name: string }[]> = {}
  const sizeBytesByFolder: Record<string, number> = {}
  for (const id of folderIds) {
    fileCountsByFolder[id] = 0
    fileNamesByFolder[id] = []
    sizeBytesByFolder[id] = 0
  }
  if (!folderIds.length) {
    return { fileCountsByFolder, fileNamesByFolder, sizeBytesByFolder }
  }

  const db = chatDb(supabase)
  const { data: direct, error } = await db
    .from('drive_files')
    .select('id, folder_id, name, size_bytes')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .in('folder_id', folderIds)
    .order('name', { ascending: true })
    .limit(5000)
  if (error) throw new Error(error.message)

  for (const row of direct ?? []) {
    if (!row.folder_id) continue
    fileCountsByFolder[row.folder_id] = (fileCountsByFolder[row.folder_id] ?? 0) + 1
    ;(fileNamesByFolder[row.folder_id] ??= []).push({ id: row.id, name: row.name })
    sizeBytesByFolder[row.folder_id] =
      (sizeBytesByFolder[row.folder_id] ?? 0) + Number(row.size_bytes ?? 0)
  }

  return { fileCountsByFolder, fileNamesByFolder, sizeBytesByFolder }
}

/**
 * Taille totale (octets) sous chaque dossier = somme des fichiers
 * dans ce dossier et tous ses sous-dossiers.
 */
export async function sumBytesUnderFolderIds(
  supabase: unknown,
  coachId: string,
  folderIds: string[],
): Promise<Record<string, number>> {
  const { sizeBytesByFolder } = await loadFolderCardStats(supabase, coachId, folderIds, [])
  return sizeBytesByFolder
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
  clientLabelById: Map<string, string>,
  groupLabelById: Map<string, string> = new Map(),
): Promise<{ byFile: Record<string, DriveShareInfo[]>; byFolder: Record<string, DriveShareInfo[]> }> {
  const db = chatDb(supabase)
  const { data, error } = await db
    .from('drive_shares')
    .select('id, file_id, folder_id, client_id, group_id')
    .eq('coach_id', coachId)
  if (error) throw new Error(error.message)

  const byFile: Record<string, DriveShareInfo[]> = {}
  const byFolder: Record<string, DriveShareInfo[]> = {}

  for (const s of data ?? []) {
    const isGroup = Boolean(s.group_id)
    const info: DriveShareInfo = {
      id: s.id,
      file_id: s.file_id,
      folder_id: s.folder_id,
      client_id: s.client_id ?? null,
      group_id: s.group_id ?? null,
      kind: isGroup ? 'group' : 'client',
      label: isGroup
        ? groupLabelById.get(s.group_id!) || 'Groupe'
        : clientLabelById.get(s.client_id!) || 'Client',
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

/**
 * Descendants d’un dossier (incl. lui-même), via service role après contrôle d’accès.
 * Nécessaire car le partage dossier doit couvrir les sous-dossiers (RLS ne recurse pas encore).
 */
async function expandFolderTreeIds(
  adminDb: ReturnType<typeof chatDb>,
  rootFolderIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>(rootFolderIds)
  if (!rootFolderIds.length) return out

  const { data, error } = await adminDb
    .from('drive_folders')
    .select('id, parent_id')
    .is('deleted_at', null)
  if (error) throw new Error(error.message)

  const kids = new Map<string | null, string[]>()
  for (const row of data ?? []) {
    const list = kids.get(row.parent_id) ?? []
    list.push(row.id)
    kids.set(row.parent_id, list)
  }

  const stack = [...rootFolderIds]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of kids.get(id) ?? []) {
      if (!out.has(child)) {
        out.add(child)
        stack.push(child)
      }
    }
  }
  return out
}

/** Collecte file_id + folder racines accessibles pour un client (direct + groupes). */
async function collectClientShareTargets(
  db: ReturnType<typeof chatDb>,
  clientId: string,
): Promise<{ fileIds: Set<string>; rootFolderIds: string[] }> {
  const { data: memberships, error: memErr } = await db
    .from('client_group_members')
    .select('group_id')
    .eq('client_id', clientId)
  if (memErr) throw new Error(memErr.message)
  const groupIds = (memberships ?? [])
    .map((m: { group_id: string | null }) => m.group_id)
    .filter(Boolean) as string[]

  const { data: directShares, error: directErr } = await db
    .from('drive_shares')
    .select('file_id, folder_id')
    .eq('client_id', clientId)
  if (directErr) throw new Error(directErr.message)

  const fileIds = new Set<string>()
  const rootFolderIds: string[] = []
  for (const s of directShares ?? []) {
    if (s.file_id) fileIds.add(s.file_id)
    if (s.folder_id) rootFolderIds.push(s.folder_id)
  }

  if (groupIds.length) {
    const { data: groupShares, error: groupErr } = await db
      .from('drive_shares')
      .select('file_id, folder_id')
      .in('group_id', groupIds)
    if (groupErr) throw new Error(groupErr.message)
    for (const s of groupShares ?? []) {
      if (s.file_id) fileIds.add(s.file_id)
      if (s.folder_id) rootFolderIds.push(s.folder_id)
    }
  }

  return { fileIds, rootFolderIds }
}

/** Fichiers visibles client via partages (fichier ou dossier + sous-dossiers + groupes). Dédup par id. */
export async function listSharedFilesForClient(supabase: unknown, clientId: string) {
  const db = chatDb(supabase)
  const { fileIds, rootFolderIds } = await collectClientShareTargets(db, clientId)

  // Service role après validation des shares (RLS ne couvre que le dossier direct).
  const admin = createServiceRoleClient()
  const reader = admin ? chatDb(admin) : db
  const folderIds = await expandFolderTreeIds(reader, rootFolderIds)

  const seen = new Set<string>()
  const out: DriveFileRow[] = []

  function pushUnique(rows: DriveFileRow[]) {
    for (const f of rows) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      out.push(f)
    }
  }

  if (fileIds.size) {
    const { data, error } = await reader
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .in('id', Array.from(fileIds))
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    pushUnique((data ?? []) as DriveFileRow[])
  }
  if (folderIds.size) {
    const { data, error } = await reader
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .in('folder_id', Array.from(folderIds))
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    pushUnique((data ?? []) as DriveFileRow[])
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  return out
}

export type ClientDriveTreeNode = {
  /** null = racine portail (partages). */
  folderId: string | null
  folderName: string | null
  parentId: string | null
  /** Sous-dossiers accessibles depuis ce nœud. */
  folders: DriveFolderRow[]
  /** Fichiers à ce niveau (dédupliqués). */
  files: DriveFileRow[]
  breadcrumb: { id: string | null; name: string }[]
}

/**
 * Arborescence portail client.
 * Racine = dossiers partagés (racines) + fichiers partagés isolés (hors dossiers couverts).
 * Navigation dans un dossier partagé = enfants + fichiers directs.
 */
export async function loadClientDriveTree(
  supabase: unknown,
  clientId: string,
  currentFolderId: string | null,
): Promise<ClientDriveTreeNode> {
  const db = chatDb(supabase)
  const { fileIds: sharedFileIds, rootFolderIds } = await collectClientShareTargets(db, clientId)
  const admin = createServiceRoleClient()
  const reader = admin ? chatDb(admin) : db

  const accessibleFolderIds = await expandFolderTreeIds(reader, rootFolderIds)
  const rootSet = new Set(rootFolderIds)

  const { data: allFolders, error: foldersErr } = await reader
    .from('drive_folders')
    .select('id, coach_id, parent_id, name, created_at')
    .is('deleted_at', null)
  if (foldersErr) throw new Error(foldersErr.message)
  const folderById = new Map(
    ((allFolders ?? []) as DriveFolderRow[]).map((f) => [f.id, f]),
  )

  // Fichiers isolés (share fichier) — hors dossiers déjà accessibles via share dossier
  const loneFiles: DriveFileRow[] = []
  if (sharedFileIds.size) {
    const { data, error } = await reader
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .in('id', Array.from(sharedFileIds))
      .is('deleted_at', null)
    if (error) throw new Error(error.message)
    for (const f of (data ?? []) as DriveFileRow[]) {
      if (f.folder_id && accessibleFolderIds.has(f.folder_id)) continue
      loneFiles.push(f)
    }
  }

  if (currentFolderId) {
    if (!accessibleFolderIds.has(currentFolderId)) {
      throw new Error('Dossier non accessible')
    }
    const folder = folderById.get(currentFolderId)
    if (!folder) throw new Error('Dossier introuvable')

    const childFolders = ((allFolders ?? []) as DriveFolderRow[])
      .filter((f) => f.parent_id === currentFolderId && accessibleFolderIds.has(f.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    const { data: filesHere, error: filesErr } = await reader
      .from('drive_files')
      .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
      .eq('folder_id', currentFolderId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    if (filesErr) throw new Error(filesErr.message)

    const seen = new Set<string>()
    const files: DriveFileRow[] = []
    for (const f of (filesHere ?? []) as DriveFileRow[]) {
      if (seen.has(f.id)) continue
      seen.add(f.id)
      files.push(f)
    }

    // Breadcrumb limité aux ancêtres encore dans l’arbre accessible (jusqu’à une racine partagée)
    const crumbs: { id: string | null; name: string }[] = []
    let cur: string | null = currentFolderId
    const guard = new Set<string>()
    while (cur && !guard.has(cur) && accessibleFolderIds.has(cur)) {
      guard.add(cur)
      const row = folderById.get(cur)
      if (!row) break
      crumbs.unshift({ id: row.id, name: row.name })
      if (rootSet.has(cur)) break
      cur = row.parent_id && accessibleFolderIds.has(row.parent_id) ? row.parent_id : null
    }
    if (crumbs.length) crumbs.pop()

    return {
      folderId: currentFolderId,
      folderName: folder.name,
      parentId: folder.parent_id && accessibleFolderIds.has(folder.parent_id) && !rootSet.has(currentFolderId)
        ? folder.parent_id
        : null,
      folders: childFolders,
      files,
      breadcrumb: [{ id: null, name: 'Docs' }, ...crumbs],
    }
  }

  // Racine portail
  const rootFolders = ((allFolders ?? []) as DriveFolderRow[])
    .filter((f) => rootSet.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  loneFiles.sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  return {
    folderId: null,
    folderName: null,
    parentId: null,
    folders: rootFolders,
    files: loneFiles,
    breadcrumb: [{ id: null, name: 'Docs' }],
  }
}

/** Recherche coach : dossiers + fichiers dans un scope (null = tout le Drive). */
export async function searchDriveInScope(
  supabase: unknown,
  coachId: string,
  scopeFolderId: string | null,
  needle: string,
): Promise<{ folders: DriveFolderRow[]; files: DriveFileRow[] }> {
  const q = needle.trim().toLowerCase()
  if (!q) return { folders: [], files: [] }

  const db = chatDb(supabase)
  const { data: allFolders, error: fe } = await db
    .from('drive_folders')
    .select('id, coach_id, parent_id, name, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
  if (fe) throw new Error(fe.message)
  const folders = (allFolders ?? []) as DriveFolderRow[]

  let allowedFolderIds: Set<string> | null = null
  if (scopeFolderId) {
    allowedFolderIds = await expandFolderTreeIds(db, [scopeFolderId])
  }

  const matchedFolders = folders.filter((f) => {
    if (allowedFolderIds && !allowedFolderIds.has(f.id)) return false
    if (scopeFolderId && f.id === scopeFolderId) return false
    return f.name.toLowerCase().includes(q)
  })

  const { data: allFiles, error: fileErr } = await db
    .from('drive_files')
    .select('id, coach_id, folder_id, name, storage_path, mime_type, size_bytes, created_at')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
  if (fileErr) throw new Error(fileErr.message)

  const matchedFiles = ((allFiles ?? []) as DriveFileRow[]).filter((f) => {
    if (allowedFolderIds) {
      if (!f.folder_id || !allowedFolderIds.has(f.folder_id)) return false
    }
    return f.name.toLowerCase().includes(q)
  })

  return { folders: matchedFolders, files: matchedFiles }
}

/** Noms de fichiers directs d’un dossier (badge pop-up). */
export async function listFileNamesInFolders(
  supabase: unknown,
  coachId: string,
  folderIds: string[],
): Promise<Record<string, { id: string; name: string }[]>> {
  const out: Record<string, { id: string; name: string }[]> = {}
  for (const id of folderIds) out[id] = []
  if (!folderIds.length) return out

  const db = chatDb(supabase)
  const { data, error } = await db
    .from('drive_files')
    .select('id, folder_id, name')
    .eq('coach_id', coachId)
    .is('deleted_at', null)
    .in('folder_id', folderIds)
    .order('name', { ascending: true })
    .limit(5000)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (!row.folder_id) continue
    ;(out[row.folder_id] ??= []).push({ id: row.id, name: row.name })
  }
  return out
}

/** Fil d’Ariane depuis l’arbre déjà chargé (0 query). Courant exclu. */
export function buildBreadcrumbFromTree(
  folderId: string,
  tree: { id: string; parent_id: string | null; name: string }[],
): { id: string | null; name: string }[] {
  const byId = new Map(tree.map((t) => [t.id, t]))
  const crumbs: { id: string | null; name: string }[] = []
  let cur: string | null = folderId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    const row = byId.get(cur)
    if (!row) break
    crumbs.unshift({ id: row.id, name: row.name })
    cur = row.parent_id
  }
  if (crumbs.length) crumbs.pop()
  return [{ id: null, name: 'Drive' }, ...crumbs]
}

/** Fil d’Ariane Drive (racine → dossier courant, sans le courant). Prefer `buildBreadcrumbFromTree` si l’arbre est déjà chargé. */
export async function buildFolderBreadcrumb(
  supabase: unknown,
  folderId: string,
): Promise<{ id: string | null; name: string }[]> {
  const db = chatDb(supabase)
  const crumbs: { id: string | null; name: string }[] = []
  let cur: string | null = folderId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    const row = await db
      .from('drive_folders')
      .select('id, parent_id, name')
      .eq('id', cur)
      .is('deleted_at', null)
      .maybeSingle()
    const data = row.data as { id: string; parent_id: string | null; name: string } | null
    if (!data) break
    crumbs.unshift({ id: data.id, name: data.name })
    cur = data.parent_id
  }
  if (crumbs.length) crumbs.pop()
  return [{ id: null, name: 'Drive' }, ...crumbs]
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
