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
    redirect(`${returnTo}?error=` + encodeURIComponent(error.message))
  }

  revalidateCatalog(id)
  const ok =
    status === 'published' ? 'published' : status === 'review' ? 'review' : 'draft'
  redirect(`${returnTo.split('?')[0]}?ok=${ok}`)
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
    redirect(`${returnTo}?error=` + encodeURIComponent(error.message))
  }

  revalidateCatalog(id)
  redirect(`${returnTo.split('?')[0]}?ok=rights`)
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
    redirect(`${returnTo}?error=` + encodeURIComponent(error.message))
  }

  revalidateCatalog(id)
  const base = returnTo.split('?')[0] || '/admin/programs'
  if (trainly) {
    redirect(`${base}?ok=to_trainly`)
  }
  redirect(`${base}?view=coach&ok=to_coach`)
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
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=` + encodeURIComponent(error.message))
  }

  revalidateCatalog(id)
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}ok=deleted`)
}
