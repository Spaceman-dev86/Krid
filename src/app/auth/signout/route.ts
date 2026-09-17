import { NextResponse } from 'next/server'

import { createRouteHandlerClient } from '../../../lib/supabase/routeHandler'

function safeRedirectPath(value: string | null, fallback: string): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return fallback
}

export async function GET(request: Request) {
  return POST(request)
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const target = safeRedirectPath(url.searchParams.get('next'), '/login')

  const response = NextResponse.redirect(new URL(target, url.origin), { status: 303 })
  const supabase = createRouteHandlerClient(request, response)

  await supabase.auth.signOut({ scope: 'global' })

  return response
}
