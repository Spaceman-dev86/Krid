'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePlatformAdmin } from '../../../lib/auth/requirePlatformAdmin'

export async function updateAdminFullNameAction(formData: FormData) {
  const { supabase, user } = await requirePlatformAdmin()
  const fullName = String(formData.get('full_name') || '').trim()
  if (fullName.length < 2) {
    redirect('/admin/settings?error=' + encodeURIComponent('Nom trop court'))
  }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) redirect('/admin/settings?error=' + encodeURIComponent(error.message))
  revalidatePath('/admin/settings')
  redirect('/admin/settings?ok=name')
}

export async function requestAdminEmailChangeAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    redirect('/admin/settings?error=' + encodeURIComponent('E-mail invalide'))
  }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) redirect('/admin/settings?error=' + encodeURIComponent(error.message))

  revalidatePath('/admin/settings')
  redirect('/admin/settings?ok=email_pending')
}

export async function updateAdminPasswordAction(formData: FormData) {
  const { supabase } = await requirePlatformAdmin()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('password_confirm') || '')

  if (password.length < 8) {
    redirect('/admin/settings?error=' + encodeURIComponent('Mot de passe : 8 caractères min.'))
  }
  if (password !== confirm) {
    redirect('/admin/settings?error=' + encodeURIComponent('Les mots de passe ne correspondent pas'))
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/admin/settings?error=' + encodeURIComponent(error.message))

  redirect('/admin/settings?ok=password')
}
