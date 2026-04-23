import { NextResponse } from 'next/server'

import { createClient } from '../../../lib/supabase/server'

type UntypedInsertResult = { error: { message?: string } | null }
type UntypedInsertQuery = {
  insert: (values: Record<string, unknown>) => Promise<UntypedInsertResult>
}

type SupportedOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change'

function isSupportedOtpType(value: string): value is SupportedOtpType {
  return (
    value === 'signup' ||
    value === 'invite' ||
    value === 'magiclink' ||
    value === 'recovery' ||
    value === 'email_change'
  )
}

type AppRole = 'admin' | 'coach'

function isAppRole(value: unknown): value is AppRole {
  return value === 'admin' || value === 'coach'
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')

  const supabase = await createClient()

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, url.origin)
      )
    }
  } else if (tokenHash && type) {
    if (!isSupportedOtpType(type)) {
      return NextResponse.redirect(new URL('/login?error=unsupported_otp_type', url.origin))
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (verifyError) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(verifyError.message)}`, url.origin)
      )
    }
  } else {
    return NextResponse.redirect(new URL('/login?error=missing_callback_params', url.origin))
  }

  const { data } = await supabase.auth.getUser()
  const userId = data?.user?.id
  const email = data?.user?.email ?? null

  let role: AppRole | null = null

  if (userId) {
    try {
      await (supabase as unknown as { from: (t: string) => UntypedInsertQuery }).from('login_logs').insert({
        user_id: userId,
        email,
      })
    } catch {
      // ignore
    }
  }

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    const typedProfile = profile as unknown as { role: string | null } | null

    if (isAppRole(typedProfile?.role)) {
      role = typedProfile.role
    }
  }

  if (role === 'admin') {
    return NextResponse.redirect(new URL('/admin', url.origin))
  }

  if (role === 'coach') {
    return NextResponse.redirect(new URL('/dashboard', url.origin))
  }

  return NextResponse.redirect(new URL('/dashboard', url.origin))
}
