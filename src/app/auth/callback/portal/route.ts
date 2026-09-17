import { NextResponse } from 'next/server'

import { attachClearAuthNextCookie, readAuthNextPath } from '../../../../lib/auth/authNextCookie'
import { completeAuthCallback } from '../../../../lib/auth/completeAuthCallback'
import { ensureAuthUserIsClient } from '../../../../lib/auth/ensureClientRole'
import { buildSetPasswordUrl, hasPasswordSet } from '../../../../lib/auth/password'
import { resolveClientPortalHome } from '../../../../lib/client-portal/context'

function isPortalPath(path: string): boolean {
  return /^\/c\/[^/]+\/(home|profil|coach|historique|seance|onboarding)(\/|$)/.test(path)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const result = await completeAuthCallback(request)

  if (result.kind === 'error') {
    return attachClearAuthNextCookie(
      NextResponse.redirect(
        new URL(`/login/client?error=${encodeURIComponent(result.message)}`, url.origin)
      )
    )
  }

  await ensureAuthUserIsClient(result.supabase, result.userId)

  const storedNext = await readAuthNextPath()
  let target: string | null = null

  if (storedNext?.startsWith('/invite/')) {
    target = storedNext
  } else if (storedNext && isPortalPath(storedNext)) {
    target = storedNext
  } else {
    target = await resolveClientPortalHome(result.supabase, result.userId)
  }

  const finalTarget = target ?? '/invite/ok'

  const {
    data: { user },
  } = await result.supabase.auth.getUser()

  if (user && !(await hasPasswordSet(result.supabase, user))) {
    return attachClearAuthNextCookie(
      NextResponse.redirect(buildSetPasswordUrl(url.origin, finalTarget))
    )
  }

  return attachClearAuthNextCookie(NextResponse.redirect(new URL(finalTarget, url.origin)))
}
