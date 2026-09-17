'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import { isUploadFile, storageSafeName } from '../../../lib/admin/trainlyMedia'
import { createClient } from '../../../lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase, userId: user.id }
}

export async function createDriveLibraryPackAction(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const allowDownload = formData.get('allow_download') === 'on'
  const publishNow = formData.get('publish_now') === 'on'
  const file = formData.get('file')

  if (title.length < 2) redirect('/admin/drive-packs?error=' + encodeURIComponent('Titre requis'))
  if (!isUploadFile(file) || file.size === 0) {
    redirect('/admin/drive-packs?error=' + encodeURIComponent('PDF requis'))
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    redirect('/admin/drive-packs?error=' + encodeURIComponent('PDF uniquement'))
  }
  if (file.size > 50 * 1024 * 1024) {
    redirect('/admin/drive-packs?error=' + encodeURIComponent('Max 50 Mo'))
  }

  const packId = crypto.randomUUID()
  const safeName = storageSafeName(file.name)
  const storagePath = `${packId}/${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('trainly-library').upload(storagePath, buffer, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (upErr) redirect('/admin/drive-packs?error=' + encodeURIComponent(upErr.message))

  const { error } = await supabase.from('trainly_drive_library').insert({
    id: packId,
    title,
    description,
    file_path: storagePath,
    mime_type: 'application/pdf',
    size_bytes: file.size,
    original_name: file.name.slice(0, 240),
    allow_duplicate: allowDuplicate,
    allow_download: allowDownload,
    published: publishNow,
    created_by: userId,
  })

  if (error) {
    await supabase.storage.from('trainly-library').remove([storagePath])
    redirect('/admin/drive-packs?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/admin/drive-packs')
  revalidatePath('/drive')
  redirect('/admin/drive-packs?ok=created')
}

export async function updateDriveLibraryPackAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const allowDownload = formData.get('allow_download') === 'on'
  const published = formData.get('published') === 'on'

  if (!id || title.length < 2) redirect('/admin/drive-packs?error=invalid')

  const { error } = await supabase
    .from('trainly_drive_library')
    .update({
      title,
      description,
      allow_duplicate: allowDuplicate,
      allow_download: allowDownload,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) redirect('/admin/drive-packs?error=' + encodeURIComponent(error.message))

  revalidatePath('/admin/drive-packs')
  revalidatePath('/drive')
  redirect('/admin/drive-packs?ok=updated')
}

export async function deleteDriveLibraryPackAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/drive-packs?error=invalid')

  const { data: pack } = await supabase
    .from('trainly_drive_library')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('trainly_drive_library').delete().eq('id', id)
  if (error) redirect('/admin/drive-packs?error=' + encodeURIComponent(error.message))

  if (pack?.file_path) {
    await supabase.storage.from('trainly-library').remove([pack.file_path])
  }

  revalidatePath('/admin/drive-packs')
  revalidatePath('/drive')
  redirect('/admin/drive-packs?ok=deleted')
}

/** Publier / dépublier en un clic */
export async function setDriveLibraryPublishedAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const published = String(formData.get('published') || '') === '1'
  if (!id) redirect('/admin/drive-packs?error=invalid')

  const { error } = await supabase
    .from('trainly_drive_library')
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirect('/admin/drive-packs?error=' + encodeURIComponent(error.message))

  revalidatePath('/admin/drive-packs')
  revalidatePath('/drive')
  redirect(`/admin/drive-packs?ok=${published ? 'published' : 'unpublished'}`)
}

export async function previewDriveLibraryPackAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/drive-packs?error=invalid')

  const { data: pack } = await supabase
    .from('trainly_drive_library')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  if (!pack?.file_path) redirect('/admin/drive-packs?error=' + encodeURIComponent('Fichier manquant'))

  const { data, error } = await supabase.storage.from('trainly-library').createSignedUrl(pack.file_path, 3600)
  if (error || !data?.signedUrl) {
    redirect('/admin/drive-packs?error=' + encodeURIComponent(error?.message || 'Preview impossible'))
  }
  redirect(data.signedUrl)
}
