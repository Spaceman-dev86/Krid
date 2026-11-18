import { cache } from 'react'
import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { createClient } from '@/src/lib/supabase/server'

/**
 * Auth coach dédupliqué par requête RSC.
 * Stabilité : session cookie d’abord ; getUser / profil en best-effort.
 * Un timeout Supabase ne doit JAMAIS être traité comme une déconnexion.
 */
export const requireCoachAppUser = cache(async () => {
  const supabase = await createClient()

  let user: { id: string; email?: string | null } | null = null

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    user = session?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    try {
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      user = u
    } catch {
      user = null
    }
  }

  if (!user) redirect('/login')

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    // Kick seulement si la lecture a réussi ET le rôle est clairement refusé
    if (!error && profile && !canAccessCoachApp(profile.role)) {
      redirect('/login')
    }
  } catch {
    // Timeout profil : on continue avec la session valide
  }

  return { supabase, userId: user.id, user }
})
