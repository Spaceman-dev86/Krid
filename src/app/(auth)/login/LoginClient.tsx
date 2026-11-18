'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isPlatformAdmin } from '../../../lib/auth/roles'
import { markPasswordSet } from '../../../lib/auth/password'
import { createClient } from '../../../lib/supabase/client'
import { appUrl, siteUrl } from '../../../lib/urls'
import { Button, Input } from '../../../components/ui'

type LoginVariant = 'coach' | 'admin'

type Props = {
  variant: LoginVariant
  /** Page /signup (depuis le site) : libellés + retour site. */
  entry?: 'default' | 'signup'
}

type CoachMode = 'login' | 'signup'

const MIN_LEN = 8

function authErrorMessage(err: { message?: string } | null | undefined, fallback: string) {
  const msg = String(err?.message ?? '').trim()
  if (!msg) return fallback
  if (/failed to fetch|fetch failed|network|timeout|connect/i.test(msg)) {
    return 'Impossible de joindre Supabase (réseau / timeout). Vérifie ta connexion puis réessaie.'
  }
  return msg
}

export default function LoginClient({ variant, entry = 'default' }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')
  const planParam = searchParams.get('plan')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [coachMode, setCoachMode] = useState<CoachMode>(
    modeParam === 'signup' || (entry === 'signup' && modeParam !== 'login') ? 'signup' : 'login',
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const redirectTo = searchParams.get('redirectTo')
  const authError = searchParams.get('error')
  const isAdmin = variant === 'admin'
  const fromSite = entry === 'signup'
  const showBusinessBadge = fromSite && (planParam === 'business' || !planParam)
  const signOutHref = `/auth/signout?next=${encodeURIComponent(isAdmin ? '/loginadmin' : '/login')}`

  useEffect(() => {
    if (isAdmin) return
    if (modeParam === 'signup') setCoachMode('signup')
    else if (modeParam === 'login') setCoachMode('login')
  }, [modeParam, isAdmin])

  // Filet : session déjà ouverte → hard nav (admin → /admin, coach → /home). Pas de carte.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const user = data.session?.user
        if (!user || cancelled) return
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        if (cancelled) return
        const role = (profile as { role?: string } | null)?.role ?? null
        const next =
          redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null
        if (isPlatformAdmin(role)) {
          window.location.replace(next?.startsWith('/admin') ? next : '/admin')
          return
        }
        if (role === 'coach' && !isAdmin) {
          window.location.replace(next ?? '/home')
        }
      } catch {
        // ignore — formulaire reste utilisable
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, redirectTo, isAdmin])

  async function redirectAfterCoachAuth(userId: string) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, suspended_at')
      .eq('id', userId)
      .maybeSingle()
    const role = (profile as { role?: string; suspended_at?: string | null } | null)?.role ?? null
    const suspendedAt = (profile as { suspended_at?: string | null } | null)?.suspended_at ?? null

    if (suspendedAt && role === 'coach') {
      await supabase.auth.signOut()
      setError('Compte suspendu. Contacte le support Krid si besoin.')
      setLoading(false)
      return
    }

    if (role === 'client') {
      // Ne pas envoyer vers /login/client : le message y était inversé et
      // renvoyait en boucle. Rester sur la page coach avec un vrai feedback.
      await supabase.auth.signOut()
      setError(
        fromSite
          ? 'Ce compte est un compte client, pas coach. Connecte-toi avec ton email coach pour l’app Krid (ou ouvre la connexion client pour le portail).'
          : 'Ce compte est un client — pas l’app coach. Utilise la connexion client, ou un email coach.',
      )
      setLoading(false)
      return
    }

    const next =
      redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null

    if (isPlatformAdmin(role)) {
      window.location.replace(next?.startsWith('/admin') ? next : '/admin')
      return
    }

    window.location.replace(next ?? '/home')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isAdmin) {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data.user) {
        setError(authErrorMessage(signInError, 'Connexion impossible.'))
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()
      const role = (profile as { role?: string } | null)?.role ?? null

      if (!isPlatformAdmin(role)) {
        await supabase.auth.signOut()
        setError('Ce compte n’a pas accès à l’administration.')
        setLoading(false)
        return
      }

      setLoading(false)
      window.location.replace('/admin')
      return
    }

    if (coachMode === 'signup') {
      if (!acceptedTerms) {
        setError('Tu dois accepter les conditions d’utilisation et la politique de confidentialité.')
        setLoading(false)
        return
      }
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: appUrl('/auth/callback/coach'),
          data: { role: 'coach', password_set: true, accepted_terms_at: new Date().toISOString() },
        },
      })

      if (signUpError) {
        setError(authErrorMessage(signUpError, 'Inscription impossible.'))
        setLoading(false)
        return
      }

      if (data.user) {
        await markPasswordSet(supabase, data.user.id)
      }

      if (data.session && data.user) {
        setLoading(false)
        await redirectAfterCoachAuth(data.user.id)
        return
      }

      setMessage('Compte créé. Vérifie ton email pour confirmer, puis connecte-toi.')
      setCoachMode('login')
      setLoading(false)
      return
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError || !data.user) {
      setError(authErrorMessage(signInError, 'Email ou mot de passe incorrect.'))
      setLoading(false)
      return
    }

    setLoading(false)
    await redirectAfterCoachAuth(data.user.id)
  }

  const title = isAdmin ? 'Connexion admin' : coachMode === 'signup' ? 'Inscription' : 'Connexion'
  const description = isAdmin
    ? 'Accès réservé à l’administration — email et mot de passe uniquement.'
    : coachMode === 'signup'
      ? 'Crée ton compte coach en moins d’une minute.'
      : 'Connecte-toi à ton espace coach Krid.'

  const forgotAudience = isAdmin ? 'admin' : 'coach'

  return (
    <main className="auth-split">
      {/* Colonne formulaire — largeur forcée via .auth-split (globals.css) */}
      <section className="auth-split__form">
            <div className="flex items-center justify-between gap-3">
          <div className="text-base font-extrabold tracking-tight text-[var(--brand)]">Krid</div>
          {fromSite ? (
            <a
              href={siteUrl('/')}
              className="text-sm font-semibold text-white/50 underline-offset-2 hover:text-white hover:underline"
            >
              ← Retour au site
            </a>
          ) : (
            <a
              href={siteUrl('/')}
              className="text-sm font-semibold text-white/50 underline-offset-2 hover:text-white hover:underline"
            >
              ← Site Krid
            </a>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-1 flex-col justify-center py-8">
          <div className="grid gap-1.5">
            {showBusinessBadge ? (
              <div className="mb-2 inline-flex w-fit rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--brand)] ring-1 ring-[color-mix(in_srgb,var(--brand)_35%,transparent)]">
                Essai Business
              </div>
            ) : null}
            <h1 className="text-[2rem] font-extrabold tracking-tight text-white">{title}</h1>
            <p className="text-[15px] text-white/55">{description}</p>
            {!isAdmin && !fromSite ? (
              <p className="text-sm text-white/45">
                Les clients :{' '}
                <Link href="/login/client" className="font-semibold text-[var(--brand)] underline underline-offset-2">
                  connexion client
                </Link>
                .
              </p>
            ) : null}
          </div>

          {authError === 'client_sur_coach_login' ? (
            <div className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm font-semibold text-amber-200 ring-1 ring-amber-500/30">
              Ce compte est un client — pas l’app coach. Déconnecte-toi puis reconnecte-toi avec l’email coach.
              <div className="mt-3">
                <a href={signOutHref} className="font-semibold underline underline-offset-2">
                  Se déconnecter
                </a>
              </div>
            </div>
          ) : authError === 'magic_link_disabled' ? (
            <div className="mt-5 rounded-xl bg-amber-500/10 p-4 text-sm font-semibold text-amber-200 ring-1 ring-amber-500/30">
              Les anciens liens magiques ne fonctionnent plus. Connecte-toi avec email + mot de passe.
            </div>
          ) : authError ? (
            <div className="mt-5 rounded-xl bg-red-500/10 p-4 text-sm font-semibold text-red-300 ring-1 ring-red-500/30">
              {authError}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-7 grid gap-4">
            {!isAdmin ? (
              <p className="text-sm text-white/50">
                {coachMode === 'signup' ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
                <button
                  type="button"
                  className="font-semibold text-[var(--brand)] underline underline-offset-2"
                  onClick={() => {
                    setCoachMode(coachMode === 'signup' ? 'login' : 'signup')
                    setError(null)
                    setMessage(null)
                  }}
                >
                  {coachMode === 'signup' ? 'Connexion' : 'Inscription'}
                </button>
              </p>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-white">
                Email <span className="text-[#f07178]">*</span>
              </span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="prenom@entreprise.com"
                className="h-12 rounded-xl bg-[#0e0e10] px-4 ring-1 ring-white/10"
              />
            </label>

            <label className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-white">
                  Mot de passe <span className="text-[#f07178]">*</span>
                </span>
                <span className="text-xs text-white/40">{MIN_LEN} caractères minimum</span>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={MIN_LEN}
                  autoComplete={coachMode === 'signup' && !isAdmin ? 'new-password' : 'current-password'}
                  className="h-12 rounded-xl bg-[#0e0e10] px-4 pr-12 ring-1 ring-white/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/45 hover:text-white"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? 'Masquer' : 'Voir'}
                </button>
              </div>
            </label>

            {!isAdmin && coachMode === 'signup' ? (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-white">Confirmer le mot de passe</span>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={MIN_LEN}
                    autoComplete="new-password"
                    className="h-12 rounded-xl bg-[#0e0e10] px-4 ring-1 ring-white/10"
                  />
                </label>

                <label className="flex items-start gap-3 pt-1">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                    className="mt-1 h-4 w-4 rounded accent-[var(--brand-mid)]"
                  />
                  <span className="text-sm leading-relaxed text-white/55">
                    J’accepte les{' '}
                    <Link href="/legal/cgu" target="_blank" className="font-semibold text-white underline underline-offset-2">
                      conditions d’utilisation
                    </Link>{' '}
                    et la{' '}
                    <Link
                      href="/legal/politique-de-confidentialite"
                      target="_blank"
                      className="font-semibold text-white underline underline-offset-2"
                    >
                      politique de confidentialité
                    </Link>
                    .
                  </span>
                </label>
              </>
            ) : null}

            <Button
              type="submit"
              disabled={loading || (!isAdmin && coachMode === 'signup' && !acceptedTerms)}
              className="mt-1 h-12 w-full rounded-xl text-[15px] font-extrabold"
            >
              {loading
                ? coachMode === 'signup' && !isAdmin
                  ? 'Création…'
                  : 'Connexion…'
                : isAdmin
                  ? 'Se connecter'
                  : coachMode === 'signup'
                    ? 'Créer mon compte'
                    : 'Se connecter'}
            </Button>

            {coachMode === 'signup' && !isAdmin ? (
              <p className="text-center text-xs text-white/40">
                Accès immédiat. Vérifie ton email pour confirmer le compte.
              </p>
            ) : (
              <div className="text-sm text-white/45">
                <Link
                  href={`/auth/forgot-password?audience=${forgotAudience}`}
                  className="font-semibold text-[var(--brand)] underline underline-offset-2"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            )}

            {error ? (
              <div className="rounded-xl bg-red-500/10 p-4 text-sm font-semibold text-red-300 ring-1 ring-red-500/30">
                {error}
              </div>
            ) : message ? (
              <div className="rounded-xl bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                {message}
              </div>
            ) : null}
          </form>
        </div>
      </section>

      {/* Panneau marketing 50% — vignette app + copy site, 1 viewport */}
      {!isAdmin ? (
        <aside className="auth-split__marketing">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_35%,color-mix(in_srgb,var(--brand)_26%,transparent),transparent_62%)]"
          />

          <div className="relative z-10 flex h-full flex-col justify-between px-10 py-10 lg:px-14 lg:py-12">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                Une app à ton image
              </div>
              <h2 className="mt-5 max-w-xl text-[1.75rem] font-extrabold leading-[1.2] tracking-tight text-white lg:text-[2.15rem]">
                Crée ton application de coaching.
                <br />
                <span className="mt-2 inline-block rounded-md bg-[var(--brand)] px-2.5 py-1 text-[var(--brand-fg)]">
                  Vends tes programmes en ligne.
                </span>
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/55 lg:text-[15px]">
                Un dashboard complet pour coachs : crée, personnalise et monétise tes programmes.
              </p>
            </div>

            <div className="relative mx-auto my-6 w-full max-w-[420px]">
              <div aria-hidden className="absolute inset-6 rounded-[2rem] bg-[var(--brand)]/30 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.35rem] bg-[#141416] p-4 shadow-[0_0_70px_color-mix(in_srgb,var(--brand)_38%,transparent)] ring-1 ring-white/10">
                {/* Top bar card */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[var(--brand-soft)] to-[var(--brand-mid)] text-[10px] font-extrabold text-[var(--brand-fg)]">
                      TK
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-white">Ton Coaching</div>
                      <div className="text-[11px] text-white/45">App client · branding perso</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-[var(--brand)]/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--brand)]">
                    Live
                  </div>
                </div>

                {/* Résumé fonctionnalités (compact, sans nutrition / gamification) */}
                <ul className="mt-3 grid gap-1.5">
                  {[
                    { title: 'Création de programmes', body: 'Semaines & séances en quelques clics.' },
                    { title: 'Bibliothèque d’exercices', body: 'Catalogue réutilisable, prêt à scaler.' },
                    { title: 'Chat client', body: 'Messagerie intégrée, simple et réactive.' },
                    { title: 'Gestion RDV', body: 'Créneaux, confirmations, planning.' },
                  ].map((item) => (
                    <li
                      key={item.title}
                      className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] px-2.5 py-2 ring-1 ring-white/10"
                    >
                      <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[9px] font-extrabold text-[var(--brand-fg)]">
                        ✓
                      </span>
                      <div className="min-w-0 leading-tight">
                        <span className="text-[13px] font-extrabold text-white">{item.title}</span>
                        <span className="text-[12px] text-white/45"> — {item.body}</span>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-2.5 rounded-xl bg-gradient-to-r from-[var(--brand-soft)] to-[var(--brand-mid)] px-3 py-2.5 text-[var(--brand-fg)]">
                  <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-70">
                    Une app à ton image
                  </div>
                  <div className="mt-0.5 text-[13px] font-extrabold leading-snug">
                    Tes clients accèdent à leurs programmes avec une expérience pro.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  )
}
