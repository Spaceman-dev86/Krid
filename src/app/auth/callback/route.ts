import { NextResponse } from 'next/server'

import { canAccessCoachApp, isPlatformAdmin } from '../../../lib/auth/roles'
import { completeAuthCallback } from '../../../lib/auth/completeAuthCallback'
import { resolveClientPortalHome } from '../../../lib/client-portal/context'

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

function isPortalPath(path: string): boolean {
  return /^\/c\/[^/]+\/(home|profil|coach|historique|seance)(\/|$)/.test(path)
}

/** Legacy callback — préférer /auth/callback/coach ou /auth/callback/portal */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next')
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null

  if (safeNext?.startsWith('/invite/')) {
    return NextResponse.redirect(new URL(`/auth/callback/portal${url.search}`, url.origin))
  }

  if (safeNext && isPortalPath(safeNext)) {
    return NextResponse.redirect(new URL(`/auth/callback/portal${url.search}`, url.origin))
  }

  const result = await completeAuthCallback(request)

  if (result.kind === 'error') {
    const loginPath = safeNext && isPortalPath(safeNext) ? '/login/client' : '/login'
    return NextResponse.redirect(
      new URL(`${loginPath}?error=${encodeURIComponent(result.message)}`, url.origin)
    )
  }

  const { role, supabase, userId } = result

  if (safeNext) {
    if (role === 'client' && isCoachAppPath(safeNext)) {
      return NextResponse.redirect(new URL('/login/client?error=client_sur_coach_login', url.origin))
    }
    return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  if (role === 'client') {
    const home = await resolveClientPortalHome(supabase, userId)
    return NextResponse.redirect(new URL(home ?? '/login/client', url.origin))
  }

  if (isPlatformAdmin(role)) {
    return NextResponse.redirect(new URL('/admin', url.origin))
  }

  if (canAccessCoachApp(role)) {
    return NextResponse.redirect(new URL('/home', url.origin))
  }

  return NextResponse.redirect(new URL('/login', url.origin))
}
