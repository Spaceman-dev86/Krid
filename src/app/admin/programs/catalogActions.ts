'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from '../../../lib/auth/roles'
import type { CatalogStatus } from '../../../lib/catalog/workflow'
import { createClient } from '../../../lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/loginadmin')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin(profile?.role)) redirect('/home')
  return { supabase }
}

function parseStatus(raw: string): CatalogStatus | null {
  if (raw === 'draft' || raw === 'review' || raw === 'published') return raw
  return null
}

function revalidateCatalog(programId?: string) {
  revalidatePath('/admin/programs')
  revalidatePath('/admin/catalog')
  revalidatePath('/admin')
  revalidatePath('/programs')
  if (programId) {
    revalidatePath(`/admin/programs/${programId}`)
    revalidatePath(`/programme/${programId}`)
  }
}

/** Preserve ?week=&day= when setting ok/error on return_to. */
function withQueryFlag(returnTo: string, key: 'ok' | 'error', value: string) {
  const path = returnTo.startsWith('/') ? returnTo : `/${returnTo}`
  const url = new URL(path, 'http://local.invalid')
  url.searchParams.delete(key === 'ok' ? 'error' : 'ok')
  url.searchParams.set(key, value)
  return `${url.pathname}${url.search}`
}

/** Transitions Brouillon ↔ Review ↔ Publié (is_published syncé en SQL). */
export async function setProgramCatalogStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const status = parseStatus(String(formData.get('status') || ''))
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/programs'

  if (!id || !status) redirect('/admin/programs?error=' + encodeURIComponent('Données invalides'))

  const { error } = await supabase
    .from('programs')
    .update({
      catalog_status: status,
      is_trainly_catalog: true,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) {
    redirect(withQueryFlag(returnTo, 'error', error.message))
  }

  revalidateCatalog(id)
  const ok =
    status === 'published' ? 'published' : status === 'review' ? 'review' : 'draft'
  redirect(withQueryFlag(returnTo, 'ok', ok))
}

export async function updateProgramCatalogRightsAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const allowDownload = formData.get('allow_download') === 'on'
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/programs'

  if (!id) redirect('/admin/programs?error=' + encodeURIComponent('Programme introuvable'))

  const { error } = await supabase
    .from('programs')
    .update({
      allow_duplicate: allowDuplicate,
      allow_download: allowDownload,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) {
    redirect(withQueryFlag(returnTo, 'error', error.message))
  }

  revalidateCatalog(id)
  redirect(withQueryFlag(returnTo, 'ok', 'rights'))
}

/** Déplacer un programme entre catalogue Trainly et biblio coach. */
export async function setProgramTrainlyFlagAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const trainly = String(formData.get('trainly') || '') === '1'
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/programs'

  if (!id) redirect('/admin/programs?error=' + encodeURIComponent('Programme introuvable'))

  const patch: Record<string, unknown> = {
    is_trainly_catalog: trainly,
    updated_at: new Date().toISOString(),
  }
  // Sortie du catalogue plateforme → brouillon catalogue
  if (!trainly) {
    patch.catalog_status = 'draft'
    patch.is_published = false
  }

  const { error } = await supabase.from('programs').update(patch as never).eq('id', id)
  if (error) {
    redirect(withQueryFlag(returnTo, 'error', error.message))
  }

  revalidateCatalog(id)
  if (trainly) {
    redirect(withQueryFlag(returnTo, 'ok', 'to_trainly'))
  }
  const coachTo = withQueryFlag(returnTo, 'ok', 'to_coach')
  const coachUrl = new URL(coachTo, 'http://local.invalid')
  coachUrl.searchParams.set('view', 'coach')
  redirect(`${coachUrl.pathname}${coachUrl.search}`)
}

/** Soft-delete programme catalogue Trainly (corbeille). */
export async function deleteTrainlyProgramAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/programs'
  if (!id) redirect('/admin/programs?error=' + encodeURIComponent('Programme introuvable'))

  const { error } = await supabase
    .from('programs')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('is_trainly_catalog', true)

  if (error) {
    redirect(withQueryFlag(returnTo, 'error', error.message))
  }

  revalidateCatalog(id)
  redirect(withQueryFlag(returnTo, 'ok', 'deleted'))
}
