import { NextResponse } from 'next/server'

import { attachClearAuthNextCookie } from '../../../../lib/auth/authNextCookie'
import { completeAuthCallback } from '../../../../lib/auth/completeAuthCallback'

/** Après email « reset password » Supabase → page de choix du nouveau MDP. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = await completeAuthCallback(request)

  if (result.kind === 'error') {
    return attachClearAuthNextCookie(
      NextResponse.redirect(
        new URL(`/auth/forgot-password?error=${encodeURIComponent(result.message)}`, url.origin)
      )
    )
  }

  return attachClearAuthNextCookie(
    NextResponse.redirect(new URL('/auth/update-password?mode=reset', url.origin))
  )
}
