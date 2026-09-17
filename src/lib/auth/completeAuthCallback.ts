import { createClient } from '../supabase/server'

type UntypedInsertResult = { error: { message?: string } | null }
type UntypedInsertQuery = {
  insert: (values: Record<string, unknown>) => Promise<UntypedInsertResult>
}

/** Password-era email links only — magic link / legacy invite OTP are rejected. */
type SupportedOtpType = 'signup' | 'recovery' | 'email_change'

function isSupportedOtpType(value: string): value is SupportedOtpType {
  return value === 'signup' || value === 'recovery' || value === 'email_change'
}

export type AuthCallbackSuccess = {
  kind: 'ok'
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string | null
  role: string | null
}

export type AuthCallbackError = {
  kind: 'error'
  message: string
}

export async function completeAuthCallback(request: Request): Promise<AuthCallbackSuccess | AuthCallbackError> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  const errorCode = url.searchParams.get('error_code')
  const errorParam = url.searchParams.get('error')

  const supabase = await createClient()

  if (!code && !tokenHash) {
    if (errorCode === 'otp_expired' || errorParam === 'access_denied') {
      return { kind: 'error', message: 'otp_expired' }
    }
    if (errorParam || errorCode) {
      return { kind: 'error', message: errorCode || errorParam || 'auth_callback_error' }
    }
    return { kind: 'error', message: 'missing_callback_params' }
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return { kind: 'error', message: exchangeError.message }
    }
  } else if (tokenHash && type) {
    if (type === 'magiclink' || type === 'invite') {
      return { kind: 'error', message: 'magic_link_disabled' }
    }
    if (!isSupportedOtpType(type)) {
      return { kind: 'error', message: 'unsupported_otp_type' }
    }
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (verifyError) {
      return { kind: 'error', message: verifyError.message }
    }
  } else {
    return { kind: 'error', message: 'missing_callback_params' }
  }

  const { data } = await supabase.auth.getUser()
  const userId = data?.user?.id
  if (!userId) {
    return { kind: 'error', message: 'session_not_created' }
  }

  const email = data.user?.email ?? null

  try {
    await (supabase as unknown as { from: (t: string) => UntypedInsertQuery }).from('login_logs').insert({
      user_id: userId,
      email,
      context: 'app',
      login_at: new Date().toISOString(),
    })
  } catch {
    // ignore
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const typedProfile = profile as unknown as { role: string | null } | null
  const role = typedProfile?.role ?? null

  return { kind: 'ok', supabase, userId, email, role }
}
