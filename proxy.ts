import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { canAccessCoachApp, isPlatformAdmin } from './src/lib/auth/roles'

/**
 * Gate auth stable :
 * - Session cookie d’abord (0 réseau) — évite faux logout si Supabase timeout
 * - getUser() seulement si pas de session
 * - Rôle : ne kick que si le profil a bien répondu avec un rôle non autorisé
 *   (erreur réseau / timeout profil ≠ déconnexion)
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Legacy Auth emails sometimes land on Site URL `/` with ?code= / token_hash.
  // Exchange must happen on /auth/callback/coach, not the product root.
  if (pathname === '/') {
    const hasAuthCode = request.nextUrl.searchParams.has('code')
    const hasTokenHash = request.nextUrl.searchParams.has('token_hash')
    if (hasAuthCode || hasTokenHash) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/auth/callback/coach'
      return NextResponse.redirect(redirectUrl, 307)
    }
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const isClientPortalPath =
    /^\/c\/[^/]+\/(home|profil|coach|historique|seance|programme|messages|calendrier|drive)(\/|$)/.test(
      pathname
    )

  const isCoachProgramEditor =
    pathname === '/programs/new' || /^\/programs\/[^/]+(\/|$)/.test(pathname)

  const isCoachChat = pathname === '/chat' || pathname.startsWith('/chat/')
  const isCoachCalendar = pathname === '/calendar' || pathname.startsWith('/calendar/')
  const isCoachNutrition = pathname === '/nutrition' || pathname.startsWith('/nutrition/')
  const isCoachExercises = pathname === '/exercises' || pathname.startsWith('/exercises/')
  const isCoachDrive = pathname === '/drive' || pathname.startsWith('/drive/')
  const isCoachSettings = pathname === '/settings' || pathname.startsWith('/settings/')
  const isCoachProfile = pathname === '/profile' || pathname.startsWith('/profile/')

  // 1) Cookie session locale (pas d’aller-retour Auth API)
  let user: { id: string } | null = null
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    user = session?.user ?? null
  } catch {
    user = null
  }

  // 2) Fallback getUser seulement si cookie absent
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
    const redirectUrl = request.nextUrl.clone()
    if (isClientPortalPath) {
      redirectUrl.pathname = '/login/client'
    } else {
      redirectUrl.pathname = pathname.startsWith('/admin') ? '/loginadmin' : '/login'
    }
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 3) Rôle — best-effort. Timeout / erreur ≠ kick.
  let role: string | null = null
  let profileOk = false
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!error) {
      profileOk = true
      role = profile?.role ?? null
    }
  } catch {
    profileOk = false
  }

  if (isClientPortalPath) {
    return response
  }

  const isCoachArea =
    pathname.startsWith('/dashboard') ||
    pathname === '/home' ||
    pathname.startsWith('/home/') ||
    pathname === '/clients' ||
    pathname.startsWith('/clients/') ||
    pathname === '/payments' ||
    pathname.startsWith('/payments/') ||
    isCoachProgramEditor ||
    isCoachChat ||
    isCoachCalendar ||
    isCoachNutrition ||
    isCoachExercises ||
    isCoachDrive ||
    isCoachSettings ||
    isCoachProfile

  // Kick coach area seulement si on a lu un rôle et qu’il est refusé
  if (isCoachArea && profileOk && role != null && !canAccessCoachApp(role)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/programs/')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/home'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.startsWith('/admin') && profileOk && role != null && !isPlatformAdmin(role)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/home'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/admin/:path*',
    '/home',
    '/home/:path*',
    '/clients',
    '/clients/:path*',
    '/payments',
    '/payments/:path*',
    '/programs/new',
    '/programs/:id',
    '/programs/:id/:path*',
    '/chat',
    '/chat/:path*',
    '/calendar',
    '/calendar/:path*',
    '/nutrition',
    '/nutrition/:path*',
    '/exercises',
    '/exercises/:path*',
    '/drive',
    '/drive/:path*',
    '/settings',
    '/settings/:path*',
    '/profile',
    '/profile/:path*',
    '/c/:slug/home',
    '/c/:slug/profil',
    '/c/:slug/profil/:path*',
    '/c/:slug/coach',
    '/c/:slug/historique',
    '/c/:slug/historique/:path*',
    '/c/:slug/seance',
    '/c/:slug/seance/:path*',
    '/c/:slug/programme',
    '/c/:slug/programme/:path*',
    '/c/:slug/messages',
    '/c/:slug/messages/:path*',
    '/c/:slug/calendrier',
    '/c/:slug/calendrier/:path*',
    '/c/:slug/drive',
    '/c/:slug/drive/:path*',
  ],
}
