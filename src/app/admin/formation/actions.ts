'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import {
  detectFormationMediaType,
  isUploadFile,
  storageSafeName,
} from '../../../lib/admin/trainlyMedia'
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

export async function createFormationItemAction(formData: FormData) {
  const { supabase, userId } = await requireAdmin()
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const publishNow = formData.get('publish_now') === 'on'
  const file = formData.get('file')

  if (title.length < 2) redirect('/admin/formation?error=' + encodeURIComponent('Titre requis'))
  if (!isUploadFile(file) || file.size === 0) {
    redirect('/admin/formation?error=' + encodeURIComponent('Fichier requis'))
  }
  if (file.size > 200 * 1024 * 1024) {
    redirect('/admin/formation?error=' + encodeURIComponent('Max 200 Mo'))
  }

  const mediaType = detectFormationMediaType(file.type || '', file.name)
  if (!mediaType) {
    redirect('/admin/formation?error=' + encodeURIComponent('PDF, image ou vidéo uniquement'))
  }

  const itemId = crypto.randomUUID()
  const safeName = storageSafeName(file.name)
  const storagePath = `${itemId}/${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await supabase.storage.from('trainly-formation').upload(storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) redirect('/admin/formation?error=' + encodeURIComponent(upErr.message))

  const { error } = await supabase.from('trainly_formation_items').insert({
    id: itemId,
    title,
    description,
    media_type: mediaType,
    file_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    original_name: file.name.slice(0, 240),
    published: publishNow,
    created_by: userId,
  })

  if (error) {
    await supabase.storage.from('trainly-formation').remove([storagePath])
    redirect('/admin/formation?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/admin/formation')
  revalidatePath('/formation')
  redirect('/admin/formation?ok=created')
}

export async function updateFormationItemAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim() || null
  const published = formData.get('published') === 'on'

  if (!id || title.length < 2) redirect('/admin/formation?error=invalid')

  const { error } = await supabase
    .from('trainly_formation_items')
    .update({
      title,
      description,
      published,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) redirect('/admin/formation?error=' + encodeURIComponent(error.message))

  revalidatePath('/admin/formation')
  revalidatePath('/formation')
  redirect('/admin/formation?ok=updated')
}

export async function deleteFormationItemAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/formation?error=invalid')

  const { data: item } = await supabase
    .from('trainly_formation_items')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('trainly_formation_items').delete().eq('id', id)
  if (error) redirect('/admin/formation?error=' + encodeURIComponent(error.message))

  if (item?.file_path) {
    await supabase.storage.from('trainly-formation').remove([item.file_path])
  }

  revalidatePath('/admin/formation')
  revalidatePath('/formation')
  redirect('/admin/formation?ok=deleted')
}

export async function setFormationPublishedAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  const published = String(formData.get('published') || '') === '1'
  if (!id) redirect('/admin/formation?error=invalid')

  const { error } = await supabase
    .from('trainly_formation_items')
    .update({ published, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirect('/admin/formation?error=' + encodeURIComponent(error.message))

  revalidatePath('/admin/formation')
  revalidatePath('/formation')
  redirect(`/admin/formation?ok=${published ? 'published' : 'unpublished'}`)
}

export async function previewFormationItemAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/admin/formation?error=invalid')

  const { data: item } = await supabase
    .from('trainly_formation_items')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  if (!item?.file_path) redirect('/admin/formation?error=' + encodeURIComponent('Fichier manquant'))

  const { data, error } = await supabase.storage.from('trainly-formation').createSignedUrl(item.file_path, 3600)
  if (error || !data?.signedUrl) {
    redirect('/admin/formation?error=' + encodeURIComponent(error?.message || 'Preview impossible'))
  }
  redirect(data.signedUrl)
}
