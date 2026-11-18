'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import {
  detectFormationMediaType,
  isUploadFile,
  storageSafeName,
} from '../../../lib/admin/trainlyMedia'
import { chatDb } from '../../../lib/chat/chat'
import { slugifyDocFolder } from '../../../lib/documentation/slug'
import { createClient } from '../../../lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase, db: chatDb(supabase), userId: user.id }
}

function revalidateDocs() {
  revalidatePath('/admin/documentation')
  revalidatePath('/documentation')
}

function folderRedirect(slug: string | null | undefined, qs: string): never {
  const base = slug ? `/admin/documentation?folder=${encodeURIComponent(slug)}` : '/admin/documentation'
  redirect(qs ? `${base}&${qs}` : base)
}

export async function createDocumentationFolderAction(formData: FormData) {
  const { db, userId } = await requireAdmin()
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  if (title.length < 2) {
    redirect('/admin/documentation?error=' + encodeURIComponent('Titre de dossier requis'))
  }

  let slug = slugifyDocFolder(title)
  const { data: clash } = await db
    .from('documentation_folders')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (clash) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`

  const { data: maxSort } = await db
    .from('documentation_folders')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { error } = await db.from('documentation_folders').insert({
    title,
    description,
    slug,
    sort_order: (maxSort?.sort_order ?? 100) + 10,
    is_system: false,
    created_by: userId,
  })

  if (error) {
    redirect('/admin/documentation?error=' + encodeURIComponent(error.message))
  }

  revalidateDocs()
  redirect(`/admin/documentation?folder=${encodeURIComponent(slug)}&ok=folder_created`)
}

export async function renameDocumentationFolderAction(formData: FormData) {
  const { db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  if (!id || title.length < 2) {
    redirect('/admin/documentation?error=' + encodeURIComponent('Titre requis'))
  }

  const { data: folder } = await db
    .from('documentation_folders')
    .select('id, slug, is_system')
    .eq('id', id)
    .maybeSingle()
  if (!folder) redirect('/admin/documentation?error=' + encodeURIComponent('Dossier introuvable'))

  let slug = slugifyDocFolder(title)
  const { data: clash } = await db
    .from('documentation_folders')
    .select('id')
    .eq('slug', slug)
    .neq('id', id)
    .maybeSingle()
  if (clash) slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`

  const { error } = await db
    .from('documentation_folders')
    .update({ title, slug })
    .eq('id', id)
  if (error) redirect('/admin/documentation?error=' + encodeURIComponent(error.message))

  revalidateDocs()
  redirect(`/admin/documentation?folder=${encodeURIComponent(slug)}&ok=folder_renamed`)
}

export async function deleteDocumentationFolderAction(formData: FormData) {
  const { db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/documentation?error=invalid')

  const { data: folder } = await db
    .from('documentation_folders')
    .select('id, is_system, slug')
    .eq('id', id)
    .maybeSingle()

  if (!folder) redirect('/admin/documentation?error=' + encodeURIComponent('Dossier introuvable'))
  if (folder.is_system) {
    redirect('/admin/documentation?error=' + encodeURIComponent('Dossier système non supprimable'))
  }

  const { count } = await db
    .from('documentation_items')
    .select('id', { count: 'exact', head: true })
    .eq('folder_id', id)

  if ((count ?? 0) > 0) {
    redirect(
      `/admin/documentation?folder=${encodeURIComponent(folder.slug)}&error=` +
        encodeURIComponent('Vide le dossier avant de le supprimer'),
    )
  }

  const { error } = await db.from('documentation_folders').delete().eq('id', id)
  if (error) redirect('/admin/documentation?error=' + encodeURIComponent(error.message))

  revalidateDocs()
  redirect('/admin/documentation?ok=folder_deleted')
}

export async function createDocumentationItemAction(formData: FormData) {
  const { supabase, db, userId } = await requireAdmin()
  const folderId = String(formData.get('folder_id') || '')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const publishNow = formData.get('publish_now') === 'on'
  const file = formData.get('file')

  const { data: folder } = await db
    .from('documentation_folders')
    .select('id, slug')
    .eq('id', folderId)
    .maybeSingle()

  if (!folder) redirect('/admin/documentation?error=' + encodeURIComponent('Dossier invalide'))
  if (title.length < 2) folderRedirect(folder.slug, 'error=' + encodeURIComponent('Titre requis'))
  if (!isUploadFile(file) || file.size === 0) {
    folderRedirect(folder.slug, 'error=' + encodeURIComponent('Fichier requis'))
  }
  if (file.size > 200 * 1024 * 1024) {
    folderRedirect(folder.slug, 'error=' + encodeURIComponent('Max 200 Mo'))
  }

  const mediaType = detectFormationMediaType(file.type || '', file.name)
  if (!mediaType) {
    folderRedirect(folder.slug, 'error=' + encodeURIComponent('PDF, image ou vidéo uniquement'))
  }

  const itemId = crypto.randomUUID()
  const safeName = storageSafeName(file.name)
  const storagePath = `${itemId}/${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const bucket = 'trainly-formation'

  const { error: upErr } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) folderRedirect(folder.slug, 'error=' + encodeURIComponent(upErr.message))

  const { error } = await db.from('documentation_items').insert({
    id: itemId,
    folder_id: folder.id,
    title,
    description,
    media_type: mediaType,
    storage_bucket: bucket,
    file_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    original_name: file.name.slice(0, 240),
    allow_duplicate: allowDuplicate,
    published: publishNow,
    created_by: userId,
  })

  if (error) {
    await supabase.storage.from(bucket).remove([storagePath])
    folderRedirect(folder.slug, 'error=' + encodeURIComponent(error.message))
  }

  revalidateDocs()
  folderRedirect(folder.slug, 'ok=created')
}

export async function updateDocumentationItemAction(formData: FormData) {
  const { db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const folderSlug = String(formData.get('folder_slug') || '')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const published = formData.get('published') === 'on'

  if (!id || title.length < 2) folderRedirect(folderSlug, 'error=invalid')

  const { error } = await db
    .from('documentation_items')
    .update({
      title,
      description,
      allow_duplicate: allowDuplicate,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) folderRedirect(folderSlug, 'error=' + encodeURIComponent(error.message))

  revalidateDocs()
  folderRedirect(folderSlug, 'ok=updated')
}

export async function deleteDocumentationItemAction(formData: FormData) {
  const { supabase, db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const folderSlug = String(formData.get('folder_slug') || '')
  if (!id) folderRedirect(folderSlug, 'error=invalid')

  const { data: item } = await db
    .from('documentation_items')
    .select('file_path, storage_bucket')
    .eq('id', id)
    .maybeSingle()

  const { error } = await db.from('documentation_items').delete().eq('id', id)
  if (error) folderRedirect(folderSlug, 'error=' + encodeURIComponent(error.message))

  if (item?.file_path && item.storage_bucket) {
    await supabase.storage.from(item.storage_bucket).remove([item.file_path])
  }

  revalidateDocs()
  folderRedirect(folderSlug, 'ok=deleted')
}

export async function setDocumentationItemPublishedAction(formData: FormData) {
  const { db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const folderSlug = String(formData.get('folder_slug') || '')
  const published = String(formData.get('published') || '') === '1'
  if (!id) folderRedirect(folderSlug, 'error=invalid')

  const { error } = await db
    .from('documentation_items')
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) folderRedirect(folderSlug, 'error=' + encodeURIComponent(error.message))

  revalidateDocs()
  folderRedirect(folderSlug, `ok=${published ? 'published' : 'unpublished'}`)
}

export async function previewDocumentationItemAction(formData: FormData) {
  const { supabase, db } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const folderSlug = String(formData.get('folder_slug') || '')
  if (!id) folderRedirect(folderSlug, 'error=invalid')

  const { data: item } = await db
    .from('documentation_items')
    .select('file_path, storage_bucket')
    .eq('id', id)
    .maybeSingle()

  if (!item?.file_path || !item.storage_bucket) {
    folderRedirect(folderSlug, 'error=' + encodeURIComponent('Fichier manquant'))
  }

  const { data, error } = await supabase.storage
    .from(item.storage_bucket)
    .createSignedUrl(item.file_path, 3600)
  if (error || !data?.signedUrl) {
    folderRedirect(folderSlug, 'error=' + encodeURIComponent(error?.message || 'Preview impossible'))
  }
  redirect(data.signedUrl)
}
