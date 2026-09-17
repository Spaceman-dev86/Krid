import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { canAccessCoachApp, isPlatformAdmin } from './src/lib/auth/roles'

export async function proxy(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isClientPortalPath =
    /^\/c\/[^/]+\/(home|profil|coach|historique|seance|programme|messages|calendrier|drive)(\/|$)/.test(pathname)

  const isCoachProgramEditor =
    pathname === '/programs/new' || /^\/programs\/[^/]+(\/|$)/.test(pathname)

  const isCoachChat = pathname === '/chat' || pathname.startsWith('/chat/')
  const isCoachCalendar = pathname === '/calendar' || pathname.startsWith('/calendar/')
  const isCoachNutrition = pathname === '/nutrition' || pathname.startsWith('/nutrition/')
  const isCoachExercises = pathname === '/exercises' || pathname.startsWith('/exercises/')
  const isCoachDrive = pathname === '/drive' || pathname.startsWith('/drive/')

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

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = !error ? profile?.role : null

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
    isCoachDrive

  if (isCoachArea && !canAccessCoachApp(role)) {
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

  if (pathname.startsWith('/admin') && !isPlatformAdmin(role)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? '/home' : '/loginadmin'
    if (!role) redirectUrl.searchParams.set('redirectTo', pathname)
    else redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
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
