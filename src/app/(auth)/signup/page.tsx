import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { isSafeAuthNextPath } from '../../../lib/auth/authNextCookie'
import { canAccessCoachApp, isPlatformAdmin } from '../../../lib/auth/roles'
import { createClient } from '../../../lib/supabase/server'
import LoginClient from '../login/LoginClient'

type Props = {
  searchParams?:
    | Promise<{ redirectTo?: string; mode?: string; plan?: string }>
    | { redirectTo?: string; mode?: string; plan?: string }
}

function destinationForRole(role: string | null | undefined, redirectTo: string | undefined) {
  const next = typeof redirectTo === 'string' && isSafeAuthNextPath(redirectTo) ? redirectTo : null
  if (isPlatformAdmin(role)) {
    if (next?.startsWith('/admin')) return next
    return '/admin'
  }
  if (canAccessCoachApp(role)) return next ?? '/home'
  return null
}

/** Page auth coach (depuis le site) — inscription / connexion, pas de collecte sur le site. */
export default async function SignupPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const dest = destinationForRole(profile?.role, typeof q.redirectTo === 'string' ? q.redirectTo : undefined)
    if (dest) redirect(dest)
  }

  return (
    <Suspense>
      <LoginClient variant="coach" entry="signup" />
    </Suspense>
  )
}
