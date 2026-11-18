'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { chatDb } from '../../lib/chat/chat'
import { storageSafeName } from '../../lib/admin/trainlyMedia'
import { canFitInQuota, getCoachDriveQuota } from '../../lib/drive/quota'
import { createClient } from '../../lib/supabase/server'
import { createServiceRoleClient } from '../../lib/supabase/serviceRole'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, db: chatDb(supabase), userId: user.id }
}

/** Signed URL lecture seule — ouverte côté client en nouvelle fenêtre. */
export async function getDocumentationSignedUrlAction(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) return { ok: false, error: 'Accès refusé' }
  if (!id) return { ok: false, error: 'Document invalide' }

  const db = chatDb(supabase)
  const { data: item } = await db
    .from('documentation_items')
    .select('file_path, storage_bucket, published')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!item?.file_path || !item.storage_bucket) {
    return { ok: false, error: 'Document indisponible' }
  }

  const { data, error } = await supabase.storage
    .from(item.storage_bucket)
    .createSignedUrl(item.file_path, 3600)

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message || 'Lecture impossible' }
  }
  return { ok: true, url: data.signedUrl }
}

/** Copie dans le Drive perso du coach si allow_duplicate (+ garde-fou quota). */
export async function recoverDocumentationItemAction(formData: FormData) {
  const { supabase, db, userId } = await requireCoach()
  const id = String(formData.get('id') || '')
  const folderSlug = String(formData.get('folder_slug') || '')

  const backBase = folderSlug
    ? `/documentation?folder=${encodeURIComponent(folderSlug)}`
    : '/documentation'
  const withQs = (qs: string) =>
    backBase.includes('?') ? `${backBase}&${qs}` : `${backBase}?${qs}`

  if (!id) redirect(withQs('error=' + encodeURIComponent('Document invalide')))

  const { data: item } = await db
    .from('documentation_items')
    .select(
      'file_path, storage_bucket, published, allow_duplicate, original_name, mime_type, size_bytes, title, media_type',
    )
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()

  if (!item?.file_path || !item.storage_bucket || item.allow_duplicate === false) {
    redirect(withQs('error=' + encodeURIComponent('Récupération non autorisée ou document dépublié')))
  }

  // Lecture Storage : service role après contrôle published (évite faux échecs RLS path)
  const admin = createServiceRoleClient()
  const reader = admin ? chatDb(admin) : db
  const { data: blob, error: dlErr } = await reader.storage
    .from(item.storage_bucket)
    .download(item.file_path)
  if (dlErr || !blob) {
    redirect(withQs('error=' + encodeURIComponent(dlErr?.message || 'Lecture impossible')))
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const sizeBytes = item.size_bytes ?? buffer.length

  const quota = await getCoachDriveQuota(supabase, userId)
  if (!canFitInQuota(quota, sizeBytes)) {
    redirect(
      withQs(
        'error=quota_full&quota=' +
          encodeURIComponent(String(quota.quotaGo)) +
          '&plan=' +
          encodeURIComponent(quota.planTier),
      ),
    )
  }

  // Nom Drive = titre admin (pas le nom de fichier uploadé)
  const titleBase = String(item.title || 'Document').trim().slice(0, 200) || 'Document'
  const fromOriginal = item.original_name?.includes('.')
    ? item.original_name.slice(item.original_name.lastIndexOf('.'))
    : ''
  const extFromMedia =
    item.media_type === 'pdf'
      ? '.pdf'
      : item.media_type === 'video'
        ? '.mp4'
        : item.media_type === 'image'
          ? '.jpg'
          : ''
  const ext = (fromOriginal || extFromMedia).slice(0, 20)
  const fileName = `${titleBase}${ext}`.slice(0, 240)
  const fileId = crypto.randomUUID()
  const safeName = storageSafeName(fileName)
  const storagePath = `${userId}/${fileId}/${safeName}`

  const { error: upErr } = await db.storage.from('drive').upload(storagePath, buffer, {
    contentType: item.mime_type || 'application/octet-stream',
    upsert: false,
  })
  if (upErr) redirect(withQs('error=' + encodeURIComponent(upErr.message)))

  const { error } = await db.from('drive_files').insert({
    id: fileId,
    coach_id: userId,
    folder_id: null,
    name: fileName,
    storage_path: storagePath,
    mime_type: item.mime_type || 'application/octet-stream',
    size_bytes: sizeBytes,
  })

  if (error) {
    await db.storage.from('drive').remove([storagePath])
    redirect(withQs('error=' + encodeURIComponent(error.message)))
  }

  revalidatePath('/drive')
  revalidatePath('/documentation')
  // Atterrit sur le Drive racine pour que le fichier soit visible tout de suite
  redirect(`/drive?ok=recovered&name=${encodeURIComponent(fileName)}`)
}
