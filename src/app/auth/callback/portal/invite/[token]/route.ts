import { NextResponse } from 'next/server'

import { attachClearAuthNextCookie } from '../../../../../../lib/auth/authNextCookie'
import { completeAuthCallback } from '../../../../../../lib/auth/completeAuthCallback'
import { ensureAuthUserIsClient } from '../../../../../../lib/auth/ensureClientRole'
import { buildSetPasswordUrl, hasPasswordSet } from '../../../../../../lib/auth/password'

type RouteContext = { params: Promise<{ token: string }> | { token: string } }

/** Après confirmation email (signup invite) : set MDP si besoin, sinon /invite/[token] pour redeem. */
export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url)
  const { token } = await Promise.resolve(context.params)

  if (!token || token.length < 16) {
    return NextResponse.redirect(new URL('/login/client?error=invalid_invite', url.origin))
  }

  const invitePath = `/invite/${token}`
  const result = await completeAuthCallback(request)

  if (result.kind === 'error') {
    // Lien email expiré / déjà utilisé → revenir sur l’invite durable (14j)
    const back =
      result.message === 'otp_expired' || result.message === 'missing_callback_params'
        ? `${invitePath}?error=otp_expired`
        : `${invitePath}?error=${encodeURIComponent(result.message)}`
    return attachClearAuthNextCookie(NextResponse.redirect(new URL(back, url.origin)))
  }

  await ensureAuthUserIsClient(result.supabase, result.userId)

  const {
    data: { user },
  } = await result.supabase.auth.getUser()

  if (user && !(await hasPasswordSet(result.supabase, user))) {
    return attachClearAuthNextCookie(
      NextResponse.redirect(buildSetPasswordUrl(url.origin, invitePath))
    )
  }

  return attachClearAuthNextCookie(NextResponse.redirect(new URL(invitePath, url.origin)))
}
