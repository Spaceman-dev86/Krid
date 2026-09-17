import { NextResponse } from 'next/server'

import { AUTH_NEXT_COOKIE, AUTH_NEXT_MAX_AGE, isSafeAuthNextPath } from '../../../lib/auth/authNextCookie'

export async function POST(request: Request) {
  let body: { path?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const path = String(body.path ?? '').trim()
  if (!isSafeAuthNextPath(path)) {
    return NextResponse.json({ error: 'bad_path' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(AUTH_NEXT_COOKIE, path, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_NEXT_MAX_AGE,
    path: '/',
  })
  return response
}
