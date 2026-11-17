import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import LoginClient from './LoginClient'

type Props = {
  searchParams?:
    | Promise<{ mode?: string; redirectTo?: string; error?: string }>
    | { mode?: string; redirectTo?: string; error?: string }
}

export default async function LoginPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  if (q.mode === 'signup') {
    const params = new URLSearchParams()
    params.set('mode', 'signup')
    params.set('plan', 'business')
    if (typeof q.redirectTo === 'string' && q.redirectTo) params.set('redirectTo', q.redirectTo)
    redirect(`/signup?${params.toString()}`)
  }

  return (
    <Suspense>
      <LoginClient variant="coach" />
    </Suspense>
  )
}
