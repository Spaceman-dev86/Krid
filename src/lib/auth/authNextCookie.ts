import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const AUTH_NEXT_COOKIE = 'trainly_auth_next'
export const AUTH_NEXT_MAX_AGE = 600

export function isSafeAuthNextPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export async function readAuthNextPath(): Promise<string | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(AUTH_NEXT_COOKIE)?.value?.trim()
  if (!value || !isSafeAuthNextPath(value)) return null
  return value
}

export function attachClearAuthNextCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_NEXT_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
