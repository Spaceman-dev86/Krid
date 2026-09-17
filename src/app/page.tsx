import { redirect } from 'next/navigation'

import { canAccessCoachApp } from '../lib/auth/roles'
import { createClient } from '../lib/supabase/server'
import { siteUrl } from '../lib/urls'

/** Product app root — coaches go to /home, everyone else to the marketing site. */
export default async function ProductRootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (canAccessCoachApp(profile?.role)) {
      redirect('/home')
    }
  }

  redirect(siteUrl('/'))
}
