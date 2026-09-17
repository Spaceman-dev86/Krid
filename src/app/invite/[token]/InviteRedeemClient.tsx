'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { markPasswordSet } from '../../../lib/auth/password'
import { createClient } from '../../../lib/supabase/client'

type Props = {
  token: string
  inviteEmail: string
  appName: string | null
  alreadyLinked: boolean
  expired: boolean
}

const MIN_LEN = 8

export function InviteRedeemClient({ token, inviteEmail, appName, alreadyLinked, expired }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const qErr = searchParams.get('error')
    if (qErr === 'otp_expired') {
      setError('Le lien email a expiré. Crée ou saisis ton mot de passe sur cette page.')
    } else if (qErr) {
      setError(qErr)
    }
  }, [searchParams])

  async function goToPortal() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/invite/ok')
      return
    }
    const { data: clients } = await supabase
      .from('clients')
      .select('coach_id, email')
      .eq('user_id', user.id)
      .is('deleted_at', null)

    const authEmail = user.email?.trim().toLowerCase()
    const client =
      clients?.find((c) => authEmail && c.email?.trim().toLowerCase() === authEmail) ?? clients?.[0]

    if (!client) {
      router.replace('/invite/ok')
      return
    }
    const { data: branding } = await supabase
      .from('coach_branding')
      .select('slug')
      .eq('coach_id', client.coach_id)
      .maybeSingle()
    if (branding?.slug) {
      router.replace(`/c/${branding.slug}/home`)
      return
    }
    router.replace('/invite/ok')
  }

  async function redeem() {
    const { error: rpcError } = await supabase.rpc('redeem_client_invite', { p_token: token })
    if (rpcError) {
      setError(rpcError.message)
      return false
    }
    return true
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (!data.user) return
      setHasSession(true)
      if (expired || alreadyLinked) {
        if (alreadyLinked) await goToPortal()
        return
      }
      setLoading(true)
      const ok = await redeem()
      if (cancelled) return
      setLoading(false)
      if (ok) await goToPortal()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, expired, alreadyLinked])

  async function onRedeemLoggedIn() {
    setLoading(true)
    setError(null)
    const ok = await redeem()
    setLoading(false)
    if (ok) await goToPortal()
  }

  async function onCreateWithPassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (password.length < MIN_LEN) {
      setError(`Le mot de passe doit faire au moins ${MIN_LEN} caractères.`)
      setLoading(false)
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    const email = inviteEmail.trim()
    const origin = window.location.origin

    const { data: signedUp, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback/portal/invite/${token}`,
        data: { role: 'client', password_set: true },
      },
    })

    if (signUpError) {
      if (/already|registered|exists/i.test(signUpError.message)) {
        const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError || !signedIn.user) {
          setError(
            'Un compte existe déjà pour cet email. Connecte-toi avec ton mot de passe, ou utilise « Mot de passe oublié » sur /login/client.'
          )
          setLoading(false)
          return
        }
        await markPasswordSet(supabase, signedIn.user.id)
        const ok = await redeem()
        setLoading(false)
        if (ok) await goToPortal()
        return
      }
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (signedUp.user) {
      await markPasswordSet(supabase, signedUp.user.id)
    }

    if (signedUp.session && signedUp.user) {
      const ok = await redeem()
      setLoading(false)
      if (ok) await goToPortal()
      return
    }

    setLoading(false)
    setMessage(
      'Compte créé. Si une confirmation email est demandée, ouvre le mail. Sinon reconnecte-toi ici avec ton mot de passe.'
    )
  }

  if (expired) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        Cette invitation a expiré ou a été révoquée. Demande un nouveau lien à ton coach — ou passe par son showroom.
      </p>
    )
  }

  if (alreadyLinked) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Ce compte client est déjà lié.{' '}
        <Link href="/login/client" className="font-semibold underline">
          Se connecter
        </Link>
      </p>
    )
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-[#341c44]">Rejoindre {appName || 'ton coach'}</h1>
        <p className="mt-1 text-sm text-black/55">
          Invitation pour <strong>{inviteEmail}</strong>. Crée ton mot de passe pour accéder au portail.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {hasSession ? (
        <button
          type="button"
          disabled={loading}
          onClick={onRedeemLoggedIn}
          className="rounded-lg bg-[#341c44] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? 'Validation…' : 'Valider l’invitation'}
        </button>
      ) : (
        <form onSubmit={onCreateWithPassword} className="grid gap-3 rounded-2xl border border-black/10 bg-white p-5">
          <p className="text-xs text-black/50">
            Email verrouillé sur l’invitation : <strong>{inviteEmail}</strong>
          </p>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Mot de passe</span>
            <input
              type="password"
              required
              minLength={MIN_LEN}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Confirmer</span>
            <input
              type="password"
              required
              minLength={MIN_LEN}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="rounded-lg border border-black/15 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[#341c44] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
          <p className="text-xs text-black/45">
            Déjà un compte ?{' '}
            <Link href="/login/client" className="font-semibold underline">
              Connexion client
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
