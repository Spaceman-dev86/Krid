'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import { storageSafeName } from '../../lib/admin/trainlyMedia'
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

export async function openTrainlyLibraryFileAction(formData: FormData) {
  const { supabase } = await requireCoach()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/drive?error=' + encodeURIComponent('Fichier invalide'))

  const { data: pack } = await supabase
    .from('trainly_drive_library')
    .select('file_path, published, original_name')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!pack?.file_path) redirect('/drive?error=' + encodeURIComponent('Document indisponible'))

  const { data, error } = await supabase.storage
    .from('trainly-library')
    .createSignedUrl(pack.file_path, 3600)

  if (error || !data?.signedUrl) {
    redirect('/drive?error=' + encodeURIComponent(error?.message || 'URL impossible'))
  }

  redirect(data.signedUrl)
}

export async function downloadTrainlyLibraryFileAction(formData: FormData) {
  const { supabase } = await requireCoach()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/drive?error=invalid')

  const { data: pack } = await supabase
    .from('trainly_drive_library')
    .select('file_path, published, allow_download, original_name')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!pack?.file_path || !pack.allow_download) {
    redirect('/drive?error=' + encodeURIComponent('Téléchargement non autorisé'))
  }

  const { data, error } = await supabase.storage
    .from('trainly-library')
    .createSignedUrl(pack.file_path, 3600, { download: pack.original_name || true })

  if (error || !data?.signedUrl) {
    redirect('/drive?error=' + encodeURIComponent(error?.message || 'URL impossible'))
  }

  redirect(data.signedUrl)
}

/** Copie le PDF publié dans le Drive perso du coach (quota). */
export async function duplicateTrainlyLibraryFileAction(formData: FormData) {
  const { supabase, userId } = await requireCoach()
  const id = String(formData.get('id') || '')
  if (!id) redirect('/drive?error=invalid')

  const { data: pack } = await supabase
    .from('trainly_drive_library')
    .select('file_path, published, allow_duplicate, original_name, mime_type, size_bytes, title')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!pack?.file_path || !pack.allow_duplicate) {
    redirect('/drive?error=' + encodeURIComponent('Duplication non autorisée ou dépublié'))
  }

  const { data: blob, error: dlErr } = await supabase.storage.from('trainly-library').download(pack.file_path)
  if (dlErr || !blob) {
    redirect('/drive?error=' + encodeURIComponent(dlErr?.message || 'Lecture impossible'))
  }

  const fileId = crypto.randomUUID()
  const safeName = storageSafeName(pack.original_name || `${pack.title}.pdf`)
  const storagePath = `${userId}/${fileId}/${safeName}`
  const buffer = Buffer.from(await blob.arrayBuffer())

  const db = chatDb(supabase)
  const { error: upErr } = await db.storage.from('drive').upload(storagePath, buffer, {
    contentType: pack.mime_type || 'application/pdf',
    upsert: false,
  })
  if (upErr) redirect('/drive?error=' + encodeURIComponent(upErr.message))

  const { error } = await db.from('drive_files').insert({
    id: fileId,
    coach_id: userId,
    folder_id: null,
    name: (pack.original_name || `${pack.title}.pdf`).slice(0, 240),
    storage_path: storagePath,
    mime_type: pack.mime_type || 'application/pdf',
    size_bytes: pack.size_bytes ?? buffer.length,
  })

  if (error) {
    await db.storage.from('drive').remove([storagePath])
    redirect('/drive?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/drive')
  redirect('/drive?uploaded=1')
}
