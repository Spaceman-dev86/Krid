'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../../components/ui'

const AUTH_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} — délai dépassé. Réessaie.`)), ms)
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export default function ClientLoginClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [portalHref, setPortalHref] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  const redirectTo = searchParams.get('redirectTo')
  const authError = searchParams.get('error')

  async function resolvePortalHome(userId: string) {
    const { data: client } = await withTimeout(
      supabase.from('clients').select('coach_id').eq('user_id', userId).is('deleted_at', null).maybeSingle(),
      AUTH_TIMEOUT_MS,
      'Lecture fiche client'
    )
    if (!client) return null
    const { data: branding } = await withTimeout(
      supabase.from('coach_branding').select('slug').eq('coach_id', client.coach_id).maybeSingle(),
      AUTH_TIMEOUT_MS,
      'Lecture portail coach'
    )
    return branding?.slug ? `/c/${branding.slug}/home` : null
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, 'Session')
        if (!mounted) return
        setUserEmail(data.user?.email ?? null)

        if (!data.user) {
          setUserRole(null)
          setPortalHref(null)
          return
        }

        const { data: profile } = await withTimeout(
          supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
          AUTH_TIMEOUT_MS,
          'Profil'
        )

        const role = (profile as { role?: string } | null)?.role ?? null
        setUserRole(role)

        if (role === 'client') {
          const home =
            redirectTo && redirectTo.startsWith('/')
              ? redirectTo
              : await resolvePortalHome(data.user.id)
          if (mounted) setPortalHref(home)
        } else {
          setPortalHref(null)
        }
      } catch {
        if (mounted) {
          setUserEmail(null)
          setUserRole(null)
          setPortalHref(null)
        }
      } finally {
        if (mounted) setSessionReady(true)
      }
    }

    void load()
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void load()
    })
    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase, redirectTo])

  async function onSignOut() {
    const next = '/login/client' + (redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : '')
    window.location.href = `/auth/signout?next=${encodeURIComponent(next)}`
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fallbackPath =
      redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null

    try {
      // Une session coach (même navigateur) bloque souvent le switch — on la vide d’abord.
      await withTimeout(supabase.auth.signOut(), 8_000, 'Déconnexion session précédente').catch(() => {})

      const { data, error: signInError } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        AUTH_TIMEOUT_MS,
        'Connexion Supabase'
      )

      if (signInError || !data.user) {
        setError(signInError?.message ?? 'Email ou mot de passe incorrect.')
        return
      }

      const { data: profile, error: profileError } = await withTimeout(
        supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle(),
        AUTH_TIMEOUT_MS,
        'Lecture du rôle'
      )

      if (profileError) {
        setError(profileError.message || 'Impossible de lire le profil. Réessaie.')
        return
      }

      const role = (profile as { role?: string } | null)?.role ?? null

      if (role === 'coach' || role === 'admin' || role === 'platform_admin') {
        await supabase.auth.signOut().catch(() => {})
        setError('Ce compte n’est pas un compte client. Utilise /login pour les coaches.')
        return
      }

      const home =
        fallbackPath && fallbackPath.startsWith('/c/')
          ? fallbackPath
          : (await resolvePortalHome(data.user.id)) ?? '/login/client?error=no_portal'

      // Navigation pleine page — ne pas remettre loading à false avant (évite un flash)
      window.location.replace(home)
      return
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion interrompue. Réessaie.')
    } finally {
      setLoading(false)
    }
  }

  const coachSessionBlocking = Boolean(userEmail && userRole === 'coach')
  const showLoginForm = sessionReady && (!userEmail || coachSessionBlocking)

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[color:var(--fg)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Connexion client</h1>
                <p className="text-sm text-[color:var(--muted)]">
                  Email + mot de passe uniquement. Première fois : passe par le{' '}
                  <strong>showroom / rejoindre</strong> de ton coach pour créer ton compte. Coaches :{' '}
                  <Link href="/login" className="font-semibold underline">
                    /login
                  </Link>
                  .
                </p>
              </div>

              {authError === 'missing_callback_params' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Lien email expiré ou incomplet. Utilise « Mot de passe oublié » ou reconnecte-toi avec email +
                  mot de passe.
                </div>
              ) : authError === 'magic_link_disabled' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Les anciens liens magiques ne fonctionnent plus. Connecte-toi avec email + mot de passe, ou crée ton
                  compte via le showroom / rejoindre de ton coach.
                </div>
              ) : authError === 'coach_session' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Une session <strong>coach</strong> est encore ouverte. Clique <strong>Se déconnecter</strong>, puis
                  reconnecte-toi avec l’email client.
                </div>
              ) : authError === 'client_sur_coach_login' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Tu es arrivé ici depuis la connexion <strong>coach</strong> avec un compte{' '}
                  <strong>client</strong>. Tu peux te connecter ici pour le portail, ou revenir à{' '}
                  <Link href="/signup?mode=login" className="font-semibold underline">
                    la connexion coach
                  </Link>{' '}
                  avec l’email coach.
                </div>
              ) : authError === 'no_portal' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Compte client OK, mais aucun coach lié. Ouvre le showroom de ton coach pour rejoindre.
                </div>
              ) : authError ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100">
                  {authError}
                </div>
              ) : null}

              {userEmail ? (
                <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--accent)] p-5 ring-1 ring-[var(--border)]">
                  <div className="text-sm font-semibold text-[var(--brand)]">Session active</div>
                  <div className="mt-1 text-sm text-[color:var(--fg)]">{userEmail}</div>
                  {userRole ? (
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      Rôle : {userRole}
                    </div>
                  ) : null}

                  {userRole === 'coach' ? (
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      Compte <strong>coach</strong> détecté sur ce navigateur. Déconnecte-toi d’abord, sinon la
                      connexion client tourne dans le vide / échoue.
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {userRole === 'client' && portalHref ? (
                      <Button href={portalHref} variant="primary" className="h-12 px-6 text-sm">
                        Aller au portail
                      </Button>
                    ) : null}
                    <Button type="button" variant="primary" className="h-12 px-6 text-sm" onClick={onSignOut}>
                      Se déconnecter
                    </Button>
                  </div>
                </div>
              ) : null}

              {showLoginForm ? (
                <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                  {coachSessionBlocking ? (
                    <p className="text-sm text-[color:var(--muted)]">
                      Déconnecte le coach ci-dessus, puis saisis l’email <strong>client</strong> ci-dessous.
                    </p>
                  ) : null}
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Email client</span>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="client@exemple.com"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Mot de passe</span>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </label>

                  <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
                    {loading ? 'Connexion…' : 'Se connecter'}
                  </Button>

                  <div className="text-sm text-[color:var(--muted)]">
                    <Link
                      href="/auth/forgot-password?audience=client"
                      className="font-semibold text-[var(--brand)] underline underline-offset-2"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>

                  {error ? (
                    <div className="rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-100">
                      {error}
                    </div>
                  ) : null}
                </form>
              ) : null}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
