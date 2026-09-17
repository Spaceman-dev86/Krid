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
  if (raw === 'draft' || raw === 'published') return raw
  // review legacy → treat as draft target if somehow sent
  if (raw === 'review') return 'draft'
  return null
}

/** Preserve query string (mode/view/q) and set ok / error. */
function redirectToList(returnTo: string, flash: { ok?: string; error?: string }) {
  const base = returnTo.trim() || '/admin/exercises'
  const url = new URL(base, 'http://local.invalid')
  url.searchParams.delete('ok')
  url.searchParams.delete('error')
  if (flash.error) url.searchParams.set('error', flash.error)
  else if (flash.ok) url.searchParams.set('ok', flash.ok)
  redirect(`${url.pathname}${url.search}`)
}

function revalidateExerciseCatalog(id?: string) {
  revalidatePath('/admin/exercises')
  revalidatePath('/admin/catalog')
  revalidatePath('/exercises')
  if (id) {
    revalidatePath(`/admin/exercises/${id}`)
    revalidatePath(`/exercises/${id}`)
  }
}

/** Statut catalogue Trainly (coach_id null uniquement). */
export async function setExerciseCatalogStatusAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const status = parseStatus(String(formData.get('status') || ''))
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/exercises'

  if (!id || !status) {
    redirectToList(returnTo, { error: 'Données invalides' })
  }

  if (status === 'published') {
    const { data: row } = await supabase
      .from('exercise_library')
      .select('name, exercise_type_id, sport_id')
      .eq('id', id)
      .is('coach_id', null)
      .is('deleted_at', null)
      .maybeSingle()

    const ex = row as {
      name?: string | null
      exercise_type_id?: string | null
      sport_id?: string | null
    } | null

    if (!ex?.name?.trim() || !ex.exercise_type_id || !ex.sport_id) {
      redirectToList(returnTo, {
        error: 'Publication : nom + type + sport requis',
      })
    }
  }

  const { error } = await supabase
    .from('exercise_library')
    .update({
      status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .is('coach_id', null)

  if (error) {
    redirectToList(returnTo, { error: error.message })
  }

  revalidateExerciseCatalog(id)
  redirectToList(returnTo, { ok: status === 'published' ? 'published' : 'draft' })
}

export async function updateExerciseCatalogRightsAction(formData: FormData) {
  const { supabase } = await requireAdmin()
  const id = String(formData.get('id') || '').trim()
  const allowDuplicate = formData.get('allow_duplicate') === 'on'
  const returnTo = String(formData.get('return_to') || '').trim() || '/admin/exercises'

  if (!id) {
    redirectToList(returnTo, { error: 'Exercice introuvable' })
  }

  const { error } = await supabase
    .from('exercise_library')
    .update({
      allow_duplicate: allowDuplicate,
      allow_download: false,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .is('coach_id', null)

  if (error) {
    redirectToList(returnTo, { error: error.message })
  }

  revalidateExerciseCatalog(id)
  redirectToList(returnTo, { ok: 'rights' })
}
