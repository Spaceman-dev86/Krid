import { redirect } from 'next/navigation'

import { isPlatformAdmin } from './roles'
import { createClient } from '../supabase/server'

export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/loginadmin')
  }

  const { data: profile } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).maybeSingle()

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
}
