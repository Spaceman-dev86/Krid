'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
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
  if (uploadFile.size === 0) return 'Fichier vide'
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

  if (!name) redirect(folderRedirect(parentId, 'error=' + encodeURIComponent('Nom requis')))

  const db = chatDb(supabase)
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

  revalidatePath('/drive')
  if (parentId) revalidatePath(`/drive/${parentId}`)
  revalidatePath(`/drive/${data.id}`)
  redirect(`/drive/${data.id}?created=1`)
}

export async function uploadFileAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  const files = formData.getAll('file').filter(isUploadFile)

  if (!files.length) {
    redirect(folderRedirect(folderId, 'error=' + encodeURIComponent('Fichier requis')))
  }

  const db = chatDb(supabase)
  for (const file of files) {
    const err = await uploadOneFile(db, userId, folderId, file)
    if (err) {
      redirect(folderRedirect(folderId, 'error=' + encodeURIComponent(err)))
    }
  }

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  redirect(folderRedirect(folderId, 'uploaded=1'))
}

export async function softDeleteFileAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  if (!fileId) redirect(folderRedirect(folderId))

  const db = chatDb(supabase)
  await db
    .from('drive_files')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('coach_id', userId)

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  redirect(folderRedirect(folderId, 'deleted=1'))
}

export async function softDeleteFolderAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim()
  const parentId = String(formData.get('parent_id') ?? '').trim() || null
  if (!folderId) redirect('/drive')

  const db = chatDb(supabase)
  await db
    .from('drive_folders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('coach_id', userId)

  revalidatePath('/drive')
  redirect(folderRedirect(parentId, 'deleted=1'))
}

export async function moveFileAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const fromFolderId = String(formData.get('from_folder_id') ?? '').trim() || null
  const rawTarget = String(formData.get('target_folder_id') ?? '').trim()
  const targetFolderId = rawTarget === '__root__' || !rawTarget ? null : rawTarget

  if (!fileId) redirect(folderRedirect(fromFolderId))

  const db = chatDb(supabase)

  if (targetFolderId) {
    const { data: dest } = await db
      .from('drive_folders')
      .select('id')
      .eq('id', targetFolderId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!dest) {
      redirect(folderRedirect(fromFolderId, 'error=' + encodeURIComponent('Dossier cible introuvable')))
    }
  }

  const { error } = await db
    .from('drive_files')
    .update({ folder_id: targetFolderId, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(folderRedirect(fromFolderId, 'error=' + encodeURIComponent(error.message)))
  }

  revalidatePath('/drive')
  if (fromFolderId) revalidatePath(`/drive/${fromFolderId}`)
  if (targetFolderId) revalidatePath(`/drive/${targetFolderId}`)
  redirect(folderRedirect(fromFolderId, 'moved=1'))
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
    const { data } = await db
      .from('drive_folders')
      .select('parent_id')
      .eq('id', cur)
      .maybeSingle()
    cur = (data?.parent_id as string | null) ?? null
  }
  return false
}

export async function moveFolderAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const folderId = String(formData.get('folder_id') ?? '').trim()
  const fromParentId = String(formData.get('from_parent_id') ?? '').trim() || null
  const rawTarget = String(formData.get('target_folder_id') ?? '').trim()
  const targetParentId = rawTarget === '__root__' || !rawTarget ? null : rawTarget

  if (!folderId) redirect(folderRedirect(fromParentId))

  const db = chatDb(supabase)

  if (targetParentId) {
    const cycle = await isDescendantOrSelf(db, folderId, targetParentId)
    if (cycle) {
      redirect(
        folderRedirect(fromParentId, 'error=' + encodeURIComponent('Impossible de déplacer un dossier dans lui-même'))
      )
    }
    const { data: dest } = await db
      .from('drive_folders')
      .select('id')
      .eq('id', targetParentId)
      .eq('coach_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!dest) {
      redirect(folderRedirect(fromParentId, 'error=' + encodeURIComponent('Dossier cible introuvable')))
    }
  }

  const { error } = await db
    .from('drive_folders')
    .update({ parent_id: targetParentId, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .eq('coach_id', userId)
    .is('deleted_at', null)

  if (error) {
    redirect(folderRedirect(fromParentId, 'error=' + encodeURIComponent(error.message)))
  }

  revalidatePath('/drive')
  if (fromParentId) revalidatePath(`/drive/${fromParentId}`)
  if (targetParentId) revalidatePath(`/drive/${targetParentId}`)
  revalidatePath(`/drive/${folderId}`)
  redirect(folderRedirect(fromParentId, 'moved=1'))
}

export async function unshareAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const shareId = String(formData.get('share_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null
  if (!shareId) redirect(folderRedirect(folderId))

  const db = chatDb(supabase)
  await db.from('drive_shares').delete().eq('id', shareId).eq('coach_id', userId)

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', userId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/home`)
    revalidatePath(`/c/${branding.slug}/drive`)
  }

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  redirect(folderRedirect(folderId, 'unshared=1'))
}

export async function shareFileToClientAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const fileId = String(formData.get('file_id') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const folderId = String(formData.get('folder_id') ?? '').trim() || null

  if (!fileId || !clientId) {
    redirect(folderRedirect(folderId, 'error=' + encodeURIComponent('Fichier et client requis')))
  }

  const db = chatDb(supabase)
  const { data: client } = await db
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('coach_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!client) {
    redirect(folderRedirect(folderId, 'error=' + encodeURIComponent('Client introuvable')))
  }

  const { error } = await db.from('drive_shares').insert({
    coach_id: userId,
    file_id: fileId,
    client_id: clientId,
  })

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      redirect(folderRedirect(folderId, 'shared=1'))
    }
    redirect(folderRedirect(folderId, 'error=' + encodeURIComponent(error.message)))
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', userId)
    .maybeSingle()
  if (branding?.slug) revalidatePath(`/c/${branding.slug}/home`)
  if (branding?.slug) revalidatePath(`/c/${branding.slug}/drive`)

  revalidatePath('/drive')
  if (folderId) revalidatePath(`/drive/${folderId}`)
  redirect(folderRedirect(folderId, 'shared=1'))
}

export async function shareFolderToClientAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const shareFolderId = String(formData.get('share_folder_id') ?? '').trim()
  const clientId = String(formData.get('client_id') ?? '').trim()
  const currentFolderId = String(formData.get('folder_id') ?? '').trim() || null

  if (!shareFolderId || !clientId) {
    redirect(folderRedirect(currentFolderId, 'error=' + encodeURIComponent('Dossier et client requis')))
  }

  const db = chatDb(supabase)
  const { error } = await db.from('drive_shares').insert({
    coach_id: userId,
    folder_id: shareFolderId,
    client_id: clientId,
  })

  if (error && !/duplicate|unique/i.test(error.message)) {
    redirect(folderRedirect(currentFolderId, 'error=' + encodeURIComponent(error.message)))
  }

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug')
    .eq('coach_id', userId)
    .maybeSingle()
  if (branding?.slug) {
    revalidatePath(`/c/${branding.slug}/home`)
    revalidatePath(`/c/${branding.slug}/drive`)
  }

  revalidatePath('/drive')
  redirect(folderRedirect(currentFolderId, 'shared=1'))
}
