'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../../lib/auth/roles'
import { createClient } from '../../lib/supabase/server'

async function requireCoach() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')
  return { supabase, user }
}

export async function updateCoachFullNameAction(formData: FormData) {
  const { supabase, user } = await requireCoach()
  const fullName = String(formData.get('full_name') || '').trim()
  if (fullName.length < 2) redirect('/settings?error=' + encodeURIComponent('Nom trop court'))

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: fullName, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) redirect('/settings?error=' + encodeURIComponent(error.message))
  revalidatePath('/settings')
  redirect('/settings?ok=name')
}

export async function requestCoachEmailChangeAction(formData: FormData) {
  const { supabase } = await requireCoach()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    redirect('/settings?error=' + encodeURIComponent('E-mail invalide'))
  }

  const { error } = await supabase.auth.updateUser({ email })
  if (error) redirect('/settings?error=' + encodeURIComponent(error.message))

  revalidatePath('/settings')
  redirect('/settings?ok=email_pending')
}

export async function updateCoachPasswordAction(formData: FormData) {
  const { supabase } = await requireCoach()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('password_confirm') || '')

  if (password.length < 8) {
    redirect('/settings?error=' + encodeURIComponent('Mot de passe : 8 caractères min.'))
  }
  if (password !== confirm) {
    redirect('/settings?error=' + encodeURIComponent('Les mots de passe ne correspondent pas'))
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/settings?error=' + encodeURIComponent(error.message))

  redirect('/settings?ok=password')
}
