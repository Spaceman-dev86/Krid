import { NextResponse } from 'next/server'

import { attachClearAuthNextCookie, readAuthNextPath } from '../../../../lib/auth/authNextCookie'
import { canAccessCoachApp, isPlatformAdmin } from '../../../../lib/auth/roles'
import { completeAuthCallback } from '../../../../lib/auth/completeAuthCallback'

function rewriteLegacyCoachPath(path: string): string {
  if (path === '/dashboard' || path.startsWith('/dashboard/')) return '/home'
  return path
}

function isCoachAppPath(path: string): boolean {
  const p = rewriteLegacyCoachPath(path)
  return (
    p === '/home' ||
    p.startsWith('/home/') ||
    p === '/clients' ||
    p.startsWith('/clients/') ||
    p === '/payments' ||
    p.startsWith('/payments/') ||
    p === '/programs' ||
    p.startsWith('/programs/') ||
    p === '/chat' ||
    p.startsWith('/chat/') ||
    p === '/calendar' ||
    p.startsWith('/calendar/') ||
    p === '/nutrition' ||
    p.startsWith('/nutrition/') ||
    p === '/exercises' ||
    p.startsWith('/exercises/') ||
    p === '/drive' ||
    p.startsWith('/drive/') ||
    p === '/profile' ||
    p.startsWith('/profile/') ||
    p === '/settings' ||
    p.startsWith('/settings/')
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
    const dest = rewriteLegacyCoachPath(storedNext)
    return attachClearAuthNextCookie(NextResponse.redirect(new URL(dest, url.origin)))
  }

  if (isPlatformAdmin(role)) {
    return attachClearAuthNextCookie(NextResponse.redirect(new URL('/admin', url.origin)))
  }

  if (canAccessCoachApp(role)) {
    return attachClearAuthNextCookie(NextResponse.redirect(new URL('/home', url.origin)))
  }

  return attachClearAuthNextCookie(NextResponse.redirect(new URL('/login', url.origin)))
}
