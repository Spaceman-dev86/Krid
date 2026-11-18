import { cache } from 'react'
import { redirect } from 'next/navigation'

import { isPlatformAdmin } from './roles'
import { createClient } from '../supabase/server'

/** Une seule auth + profile par requête RSC (layout + page). */
export const requirePlatformAdmin = cache(async () => {
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

  if (!user) {
    redirect('/loginadmin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .maybeSingle()

  if (!isPlatformAdmin(profile?.role)) {
    redirect('/home')
  }

  return {
    supabase,
    user,
    profile: {
      role: profile?.role ?? null,
      email: profile?.email ?? user.email ?? null,
      full_name: profile?.full_name ?? null,
    },
  }
})
