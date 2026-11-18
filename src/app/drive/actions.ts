'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import { canFitInQuota, getCoachDriveQuota } from '../../lib/drive/quota'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, userId: user.id }
}

function folderRedirect(folderId: string | null, extra = '') {
  const base = folderId ? `/drive/${folderId}` : '/drive'
  return extra ? `${base}?${extra}` : base
}

export type DriveQuietResult = { ok: true; navigateTo?: string | null } | { ok: false; error: string }

function folderHref(folderId: string | null) {
  return folderId ? `/drive/${folderId}` : '/drive'
}

/** Clé Storage ASCII only (pas d’espaces ni accents). */
function storageSafeName(original: string): string {
  const trimmed = original.trim() || 'file'
  const dot = trimmed.lastIndexOf('.')
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed
  const ext = dot > 0 ? trimmed.slice(dot) : ''
  const asciiBase =
    base
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 120) || 'file'
  const asciiExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 20)
  return `${asciiBase}${asciiExt}`
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    !!value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    'name' in value &&
    'size' in value &&
    typeof (value as File).arrayBuffer === 'function'
  )
}

async function uploadOneFile(
  db: ReturnType<typeof chatDb>,
  userId: string,
  folderId: string | null,
  uploadFile: File
): Promise<string | null> {
  // Input file vide (navigateur) = ignorer, pas une erreur utilisateur.
  if (uploadFile.size === 0) return null
  if (uploadFile.size > 200 * 1024 * 1024) return `« ${uploadFile.name} » trop lourd (max 200 Mo)`

  const safeName = storageSafeName(uploadFile.name)
  const fileId = crypto.randomUUID()
  const storagePath = `${userId}/${fileId}/${safeName}`

  const buffer = Buffer.from(await uploadFile.arrayBuffer())
  const { error: upErr } = await db.storage.from('drive').upload(storagePath, buffer, {
    contentType: uploadFile.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) return upErr.message

  const { error } = await db.from('drive_files').insert({
    id: fileId,
    coach_id: userId,
    folder_id: folderId,
    name: uploadFile.name.slice(0, 240),
    storage_path: storagePath,
    mime_type: uploadFile.type || null,
    size_bytes: uploadFile.size,
  })

  if (error) {
    await db.storage.from('drive').remove([storagePath])
    return error.message
  }
  return null
}

export async function createFolderAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const name = String(formData.get('name') ?? '').trim()
  const parentId = String(formData.get('parent_id') ?? '').trim() || null
  // Les browsers envoient souvent un File(size=0) si le champ file est vide.
  const files = formData.getAll('file').filter(isUploadFile).filter((f) => f.size > 0)

  if (!name) redirect(folderRedirect(parentId, 'error=' + encodeURIComponent('Nom requis')))

  const db = chatDb(supabase)

  if (files.length) {
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
    const quota = await getCoachDriveQuota(supabase, userId)
    if (!canFitInQuota(quota, totalBytes)) {
      redirect(
        folderRedirect(
          parentId,
          'error=' +
            encodeURIComponent(
              `Espace Drive plein (${quota.quotaGo} Go · plan ${quota.planTier}). Archive des fichiers ou upgrade dans Paramètres → Stockage.`,
            ),
        ),
      )
    }
  }

  const { data, error } = await db
    .from('drive_folders')
    .insert({
      coach_id: userId,
      parent_id: parentId,
      name,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    redirect(
      folderRedirect(parentId, 'error=' + encodeURIComponent(error?.message || 'Création dossier impossible'))
    )
  }

  for (const file of files) {
    const err = await uploadOneFile(db, userId, data.id, file)
    if (err) {
      redirect(`/drive/${data.id}?error=` + encodeURIComponent(err))
    }
  }

  revalidatePath('/drive')
  if (parentId) revalidatePath(`/drive/${parentId}`)
  revalidatePath(`/drive/${data.id}`)
  redirect(`/drive/${data.id}`)
}

export async function renameFolderAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  if (!folderId || !name) return { ok: false, error: 'Nom requis' }

  const db = chatDb(supabase)
  const { data: folder } = await db
    .from('drive_folders')
    .select('id, parent_id')
    .eq('id', folderId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!folder) return { ok: false, error: 'Dossier introuvable' }

  let clashQ = db
    .from('drive_folders')
    .select('id')
    .eq('coach_id', userId)
    .eq('name', name)
    .is('deleted_at', null)
    .neq('id', folderId)
  clashQ = folder.parent_id ? clashQ.eq('parent_id', folder.parent_id) : clashQ.is('parent_id', null)
  const { data: clash } = await clashQ.maybeSingle()
  if (clash) return { ok: false, error: 'Un dossier porte déjà ce nom ici' }

  const { error } = await db
    .from('drive_folders')
    .update({ name })
    .eq('id', folderId)
    .eq('coach_id', userId)
  if (error) return { ok: false, error: error.message }

  // Pas de revalidate : l’UI a déjà le nom (optimistic).
  return { ok: true }
}

export async function renameFileAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const name = String(formData.get('name') ?? '').trim()
  if (!fileId || !name) return { ok: false, error: 'Nom requis' }

  const db = chatDb(supabase)
  const { data: file } = await db
    .from('drive_files')
    .select('id, folder_id')
    .eq('id', fileId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!file) return { ok: false, error: 'Fichier introuvable' }

  let clashQ = db
    .from('drive_files')
    .select('id')
    .eq('coach_id', userId)
    .eq('name', name)
    .is('deleted_at', null)
    .neq('id', fileId)
  clashQ = file.folder_id ? clashQ.eq('folder_id', file.folder_id) : clashQ.is('folder_id', null)
  const { data: clash } = await clashQ.maybeSingle()
  if (clash) return { ok: false, error: 'Un fichier porte déjà ce nom ici' }

  const { error } = await db
    .from('drive_files')
    .update({ name: name.slice(0, 240) })
    .eq('id', fileId)
    .eq('coach_id', userId)
  if (error) return { ok: false, error: error.message }

  // Pas de revalidate : l’UI a déjà le nom (optimistic).
  return { ok: true }
}

export async function uploadFileAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  const files = formData.getAll('file').filter(isUploadFile)

  if (!files.length) return { ok: false, error: 'Fichier requis' }

  const db = chatDb(supabase)
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
  const quota = await getCoachDriveQuota(supabase, userId)
  if (!canFitInQuota(quota, totalBytes)) {
    return {
      ok: false,
      error: `Espace Drive plein (${quota.quotaGo} Go · plan ${quota.planTier}). Archive des fichiers ou upgrade dans Paramètres → Stockage.`,
    }
  }

  for (const file of files) {
    const err = await uploadOneFile(db, userId, folderId, file)
    if (err) return { ok: false, error: err }
  }

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  return { ok: true }
}

export async function softDeleteFileAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  if (!fileId) return { ok: false, error: 'Fichier requis' }

  const db = chatDb(supabase)
  await db
    .from('drive_files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('coach_id', userId)

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  return { ok: true }
}

export async function softDeleteFolderAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim()
  const parentId = String(formData.get('parent_id') ?? '').trim() || null
  const listFolderId = String(formData.get('list_folder_id') ?? '').trim() || null
  if (!folderId) return { ok: false, error: 'Dossier requis' }

  const db = chatDb(supabase)
  const now = new Date().toISOString()

  const { data: owned } = await db
    .from('drive_folders')
    .select('id')
    .eq('id', folderId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!owned) return { ok: false, error: 'Dossier introuvable' }

  const { data: allFolders } = await db
    .from('drive_folders')
    .select('id, parent_id')
    .eq('coach_id', userId)
    .is('deleted_at', null)

  const kids = new Map<string | null, string[]>()
  for (const row of allFolders ?? []) {
    const list = kids.get(row.parent_id) ?? []
    list.push(row.id)
    kids.set(row.parent_id, list)
  }
  const tree = new Set<string>([folderId])
  const stack = [folderId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of kids.get(id) ?? []) {
      if (!tree.has(child)) {
        tree.add(child)
        stack.push(child)
      }
    }
  }
  const treeIds = Array.from(tree)

  await db.from('drive_files').update({ deleted_at: now }).eq('coach_id', userId).in('folder_id', treeIds)
  await db.from('drive_folders').update({ deleted_at: now }).eq('coach_id', userId).in('id', treeIds)

  if (parentId) revalidatePath(`/drive/${parentId}`)
  else revalidatePath('/drive')

  // Si on archive le dossier affiché, remonter au parent.
  return {
    ok: true,
    navigateTo: listFolderId === folderId ? folderHref(parentId) : undefined,
  }
}

/** URL signée pour ouvrir / télécharger un fichier du coach (ownership vérifié). */
export async function getDriveFileSignedUrlAction(
  fileId: string,
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) return { ok: false, error: 'Accès refusé' }
  if (!fileId) return { ok: false, error: 'Fichier invalide' }

  const db = chatDb(supabase)
  const { data: file, error } = await db
    .from('drive_files')
    .select('id, name, storage_path')
    .eq('id', fileId)
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !file?.storage_path) {
    return { ok: false, error: error?.message || 'Fichier introuvable' }
  }

  const { createSignedDownloadUrl } = await import('../../lib/drive/drive')
  const url = await createSignedDownloadUrl(supabase, file.storage_path)
  if (!url) return { ok: false, error: 'Ouverture impossible' }
  return { ok: true, url, name: file.name }
}

export async function moveFileAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const fromFolderId = String(formData.get('from_folder_id') ?? '').trim() || null
  const rawTarget = String(formData.get('target_folder_id') ?? '').trim()
  const targetFolderId = rawTarget === '__root__' || !rawTarget ? null : rawTarget

  if (!fileId) return { ok: false, error: 'Fichier requis' }

  const db = chatDb(supabase)

  if (targetFolderId) {
    const { data: dest } = await db
      .from('drive_folders')
      .select('id')
      .eq('id', targetFolderId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!dest) return { ok: false, error: 'Dossier cible introuvable' }
  }

  const { error } = await db
    .from('drive_files')
    .update({ folder_id: targetFolderId, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/drive')
  if (fromFolderId) revalidatePath(`/drive/${fromFolderId}`)
  if (targetFolderId) revalidatePath(`/drive/${targetFolderId}`)
  return { ok: true }
}

async function isDescendantOrSelf(
  db: ReturnType<typeof chatDb>,
  ancestorId: string,
  maybeDescendantId: string
): Promise<boolean> {
  if (ancestorId === maybeDescendantId) return true
  let cur: string | null = maybeDescendantId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    if (cur === ancestorId) return true
    const row: { data: { parent_id: string | null } | null } = await db
      .from('drive_folders')
      .select('parent_id')
      .eq('id', cur)
      .maybeSingle()
    cur = row.data?.parent_id ?? null
  }
  return false
}

/**
 * Clients / groupes / shares / badges — hors chemin critique nav (après paint).
 */
export async function loadDriveAuxQuietAction(input?: {
  folderIds?: string[]
}): Promise<
  | {
      ok: true
      clients: { id: string; label: string }[]
      groups: { id: string; label: string }[]
      sharesByFile: Record<string, import('../../lib/drive/drive').DriveShareInfo[]>
      sharesByFolder: Record<string, import('../../lib/drive/drive').DriveShareInfo[]>
      fileCountsByFolder: Record<string, number>
      sizeBytesByFolder: Record<string, number>
      fileNamesByFolder: Record<string, { id: string; name: string }[]>
    }
  | { ok: false; error: string }
> {
  const { supabase, userId } = await requireCoach()
  const { clientDisplayName, chatDb: cdb } = await import('../../lib/chat/chat')
  const { listSharesForCoach, loadFolderCardStats } = await import('../../lib/drive/drive')
  const db = cdb(supabase)
  const folderIds = input?.folderIds?.filter(Boolean) ?? []

  const [clientsRes, groupsRes, stats] = await Promise.all([
    db
      .from('clients')
      .select('id, first_name, last_name, email')
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('first_name', { ascending: true }),
    db.from('client_groups').select('id, name').eq('coach_id', userId).order('name', { ascending: true }),
    loadFolderCardStats(supabase, userId, folderIds, []),
  ])

  const clients = ((clientsRes.data ?? []) as {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
  }[]).map((c) => ({
    id: c.id,
    label: clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email || 'Client',
    }),
  }))
  const groups = ((groupsRes.data ?? []) as { id: string; name: string | null }[]).map((g) => ({
    id: g.id,
    label: g.name || 'Groupe',
  }))
  const clientLabelById = new Map(clients.map((c) => [c.id, c.label]))
  const groupLabelById = new Map(groups.map((g) => [g.id, g.label]))
  const shares = await listSharesForCoach(supabase, userId, clientLabelById, groupLabelById)
  return {
    ok: true,
    clients,
    groups,
    sharesByFile: shares.byFile,
    sharesByFolder: shares.byFolder,
    fileCountsByFolder: stats.fileCountsByFolder,
    sizeBytesByFolder: stats.sizeBytesByFolder,
    fileNamesByFolder: stats.fileNamesByFolder,
  }
}

/**
 * Déplacement sans redirect (DnD). Retourne { ok } pour refresh client.
 * targetFolderId null = racine Drive.
 */
export async function moveDriveItemQuietAction(input: {
  kind: 'file' | 'folder'
  id: string
  targetFolderId: string | null
  /** Vue courante (pour revalidate). */
  viewFolderId: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, userId } = await requireCoach()
  const db = chatDb(supabase)
  const targetFolderId = input.targetFolderId

  if (input.kind === 'file') {
    if (targetFolderId) {
      const { data: dest } = await db
        .from('drive_folders')
        .select('id')
        .eq('id', targetFolderId)
        .eq('coach_id', userId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!dest) return { ok: false, error: 'Dossier cible introuvable' }
    }
    const { data: file } = await db
      .from('drive_files')
      .select('id, folder_id')
      .eq('id', input.id)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!file) return { ok: false, error: 'Fichier introuvable' }
    if ((file.folder_id ?? null) === targetFolderId) return { ok: true }

    const { error } = await db
      .from('drive_files')
      .update({ folder_id: targetFolderId, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('coach_id', userId)
    if (error) return { ok: false, error: error.message }
  } else {
    // Drop sur soi-même = no-op silencieux.
    if (targetFolderId === input.id) return { ok: true }
    if (targetFolderId) {
      const cycle = await isDescendantOrSelf(db, input.id, targetFolderId)
      if (cycle) return { ok: false, error: 'Impossible de déplacer un dossier dans un de ses sous-dossiers' }
      const { data: dest } = await db
        .from('drive_folders')
        .select('id')
        .eq('id', targetFolderId)
        .eq('coach_id', userId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!dest) return { ok: false, error: 'Dossier cible introuvable' }
    }
    const { data: folder } = await db
      .from('drive_folders')
      .select('id, parent_id')
      .eq('id', input.id)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!folder) return { ok: false, error: 'Dossier introuvable' }
    if ((folder.parent_id ?? null) === targetFolderId) return { ok: true }

    const { error } = await db
      .from('drive_folders')
      .update({ parent_id: targetFolderId, updated_at: new Date().toISOString() })
      .eq('id', input.id)
      .eq('coach_id', userId)
    if (error) return { ok: false, error: error.message }
  }

  // Revalidate ciblée — évite de relancer tout le layout Drive à chaque DnD.
  if (input.viewFolderId) revalidatePath(`/drive/${input.viewFolderId}`)
  else revalidatePath('/drive')
  if (targetFolderId) revalidatePath(`/drive/${targetFolderId}`)
  return { ok: true }
}

export async function moveFolderAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim()
  const fromParentId = String(formData.get('from_parent_id') ?? '').trim() || null
  const rawTarget = String(formData.get('target_folder_id') ?? '').trim()
  const targetParentId = rawTarget === '__root__' || !rawTarget ? null : rawTarget

  if (!folderId) return { ok: false, error: 'Dossier requis' }

  // Même place / soi-même = no-op silencieux.
  if (targetParentId === folderId) return { ok: true }
  if ((targetParentId ?? null) === (fromParentId ?? null)) return { ok: true }

  const db = chatDb(supabase)

  if (targetParentId) {
    const cycle = await isDescendantOrSelf(db, folderId, targetParentId)
    if (cycle) return { ok: false, error: 'Impossible de déplacer un dossier dans un de ses sous-dossiers' }
    const { data: dest } = await db
      .from('drive_folders')
      .select('id')
      .eq('id', targetParentId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!dest) return { ok: false, error: 'Dossier cible introuvable' }
  }

  const { error } = await db
    .from('drive_folders')
    .update({ parent_id: targetParentId, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) return { ok: false, error: error.message }

  if (fromParentId) revalidatePath(`/drive/${fromParentId}`)
  else revalidatePath('/drive')
  if (targetParentId) revalidatePath(`/drive/${targetParentId}`)
  return { ok: true }
}

export async function unshareAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const shareId = String(formData.get('share_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  if (!shareId) return { ok: false, error: 'Partage requis' }

  const db = chatDb(supabase)
  await db.from('drive_shares').delete().eq('id', shareId).eq('coach_id', userId)

  await revalidateClientDrive(supabase, userId)
  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  return { ok: true }
}

/** audience = `client:<id>` | `group:<id>` (rétrocompat : champ client_id seul). */
function parseAudience(formData: FormData): { clientId: string | null; groupId: string | null } {
  const raw = String(formData.get('audience') ?? '').trim()
  if (raw.startsWith('client:')) return { clientId: raw.slice(7), groupId: null }
  if (raw.startsWith('group:')) return { clientId: null, groupId: raw.slice(6) }
  const clientId = String(formData.get('client_id') ?? '').trim() || null
  const groupId = String(formData.get('group_id') ?? '').trim() || null
  return { clientId, groupId }
}

async function revalidateClientDrive(supabase: Awaited<ReturnType<typeof createClient>>, coachId: string) {
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', coachId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/home`)
    revalidatePath(`/c/${branding.slug}/drive`)
  }
}

export async function shareFileToClientAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  const { clientId, groupId } = parseAudience(formData)

  if (!fileId || (!clientId && !groupId)) return { ok: false, error: 'Fichier et destinataire requis' }

  const db = chatDb(supabase)
  const { data: file } = await db
    .from('drive_files')
    .select('id')
    .eq('id', fileId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!file) return { ok: false, error: 'Fichier introuvable' }

  if (clientId) {
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!client) return { ok: false, error: 'Client introuvable' }
  } else if (groupId) {
    const { data: group } = await db
      .from('client_groups')
      .select('id')
      .eq('id', groupId)
      .eq('coach_id', userId)
      .maybeSingle()
    if (!group) return { ok: false, error: 'Groupe introuvable' }
  }

  const { error } = await db.from('drive_shares').insert({
    coach_id: userId,
    file_id: fileId,
    client_id: clientId,
    group_id: groupId,
  })

  if (error && !/duplicate|unique/i.test(error.message)) {
    return { ok: false, error: error.message }
  }

  await revalidateClientDrive(supabase, userId)
  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  return { ok: true }
}

export async function shareFolderToClientAction(formData: FormData): Promise<DriveQuietResult> {
  const { supabase, userId } = await requireCoach()
  const shareFolderId = String(formData.get('share_folder_id') ?? '').trim()
  const currentFolderId = String(formData.get('folder_id') ?? '').trim() || null
  const { clientId, groupId } = parseAudience(formData)

  if (!shareFolderId || (!clientId && !groupId)) {
    return { ok: false, error: 'Dossier et destinataire requis' }
  }

  const db = chatDb(supabase)
  const { data: folder } = await db
    .from('drive_folders')
    .select('id')
    .eq('id', shareFolderId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!folder) return { ok: false, error: 'Dossier introuvable' }

  if (clientId) {
    const { data: client } = await db
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!client) return { ok: false, error: 'Client introuvable' }
  } else if (groupId) {
    const { data: group } = await db
      .from('client_groups')
      .select('id')
      .eq('id', groupId)
      .eq('coach_id', userId)
      .maybeSingle()
    if (!group) return { ok: false, error: 'Groupe introuvable' }
  }

  const { error } = await db.from('drive_shares').insert({
    coach_id: userId,
    folder_id: shareFolderId,
    client_id: clientId,
    group_id: groupId,
  })

  if (error && !/duplicate|unique/i.test(error.message)) {
    return { ok: false, error: error.message }
  }

  await revalidateClientDrive(supabase, userId)
  revalidatePath('/drive')
  if (currentFolderId) revalidatePath(`/drive/${currentFolderId}`)
  return { ok: true }
}
