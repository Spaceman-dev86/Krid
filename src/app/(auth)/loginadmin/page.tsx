import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import { isSafeAuthNextPath } from '../../../lib/auth/authNextCookie'
import { isPlatformAdmin } from '../../../lib/auth/roles'
import { createClient } from '../../../lib/supabase/server'
import LoginClient from '../login/LoginClient'

type Props = {
  searchParams?:
    | Promise<{ redirectTo?: string; error?: string }>
    | { redirectTo?: string; error?: string }
}

export default async function LoginAdminPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (isPlatformAdmin(profile?.role)) {
      const next =
        typeof q.redirectTo === 'string' &&
        isSafeAuthNextPath(q.redirectTo) &&
        q.redirectTo.startsWith('/admin')
          ? q.redirectTo
          : '/admin'
      redirect(next)
    }
  }

  return (
    <Suspense>
      <LoginClient variant="admin" />
    </Suspense>
  )
}
