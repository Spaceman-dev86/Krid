import { NextResponse } from 'next/server'

import { attachClearAuthNextCookie, readAuthNextPath } from '../../../../lib/auth/authNextCookie'
import { canAccessCoachApp, isPlatformAdmin } from '../../../../lib/auth/roles'
import { completeAuthCallback } from '../../../../lib/auth/completeAuthCallback'

function isCoachAppPath(path: string): boolean {
  return (
    path === '/home' ||
    path.startsWith('/home/') ||
    path === '/clients' ||
    path.startsWith('/clients/') ||
    path === '/payments' ||
    path.startsWith('/payments/') ||
    path === '/dashboard' ||
    path.startsWith('/dashboard/')
  )
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = await completeAuthCallback(request)

  if (result.kind === 'error') {
    return attachClearAuthNextCookie(
      NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(result.message)}`, url.origin)
      )
    )
  }

  const { role } = result

  if (role === 'client') {
    return attachClearAuthNextCookie(
      NextResponse.redirect(new URL('/login/client?error=client_sur_coach_login', url.origin))
    )
  }

  const storedNext = await readAuthNextPath()
  if (storedNext && isCoachAppPath(storedNext)) {
    return attachClearAuthNextCookie(NextResponse.redirect(new URL(storedNext, url.origin)))
  }

  if (isPlatformAdmin(role)) {
    return attachClearAuthNextCookie(NextResponse.redirect(new URL('/admin', url.origin)))
  }

  if (canAccessCoachApp(role)) {
    return attachClearAuthNextCookie(NextResponse.redirect(new URL('/home', url.origin)))
  }

  return attachClearAuthNextCookie(NextResponse.redirect(new URL('/login', url.origin)))
}
