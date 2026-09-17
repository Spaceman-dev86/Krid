'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isPlatformAdmin } from '../../../lib/auth/roles'
import { markPasswordSet } from '../../../lib/auth/password'
import { createClient } from '../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../components/ui'

type LoginVariant = 'coach' | 'admin'

type Props = {
  variant: LoginVariant
}

type CoachMode = 'login' | 'signup'

const MIN_LEN = 8

export default function LoginClient({ variant }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [coachMode, setCoachMode] = useState<CoachMode>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'coach' | 'platform_admin' | 'client' | null>(null)

  const redirectTo = searchParams.get('redirectTo')
  const authError = searchParams.get('error')
  const isAdmin = variant === 'admin'

  async function resolveClientHome(userId: string) {
    const { data: client } = await supabase
      .from('clients')
      .select('coach_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()
    if (!client) return null
    const { data: branding } = await supabase
      .from('coach_branding')
      .select('slug')
      .eq('coach_id', client.coach_id)
      .maybeSingle()
    return branding?.slug ? `/c/${branding.slug}/home` : null
  }

  const [clientPortalHref, setClientPortalHref] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUserEmail(data.user?.email ?? null)

      if (!data.user) {
        setUserRole(null)
        setClientPortalHref(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      const typedProfile = profile as unknown as { role: string | null } | null
      const role = typedProfile?.role
      const normalizedRole =
        role === 'admin' || role === 'platform_admin' || role === 'coach' || role === 'client'
          ? role
          : null
      setUserRole(normalizedRole as 'admin' | 'coach' | 'platform_admin' | 'client' | null)

      if (normalizedRole === 'client') {
        const home = await resolveClientHome(data.user.id)
        if (mounted) setClientPortalHref(home)
      } else {
        setClientPortalHref(null)
      }
    }

    load()

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  async function onSignOut() {
    window.location.href = `/auth/signout?next=${isAdmin ? '/loginadmin' : '/login'}`
  }

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
      setError('Compte suspendu. Contacte le support Trainly si besoin.')
      setLoading(false)
      return
    }

    if (role === 'client') {
      window.location.replace('/login/client?error=client_sur_coach_login')
      return
    }

    const next =
      redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : null

    if (isPlatformAdmin(role)) {
      // Même compte : /loginadmin → admin · /login → app coach
      if (isAdmin) {
        window.location.replace(next?.startsWith('/admin') ? next : '/admin')
        return
      }
      if (next?.startsWith('/admin')) {
        window.location.replace(next)
        return
      }
      window.location.replace(next ?? '/home')
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
        setError(signInError?.message ?? 'Connexion impossible.')
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

    // Coach: signup ou login email + mdp
    if (coachMode === 'signup') {
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

      const origin = window.location.origin
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback/coach`,
          data: { role: 'coach', password_set: true },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
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
      setError(signInError?.message ?? 'Email ou mot de passe incorrect.')
      setLoading(false)
      return
    }

    setLoading(false)
    await redirectAfterCoachAuth(data.user.id)
  }

  const title = isAdmin ? 'Connexion admin' : coachMode === 'signup' ? 'Créer un compte coach' : 'Connexion coach'
  const description = isAdmin
    ? 'Accès réservé à l’administration — email et mot de passe uniquement.'
    : null

  const forgotAudience = isAdmin ? 'admin' : 'coach'

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[color:var(--fg)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">{title}</h1>
                {description ? <p className="text-sm text-[color:var(--muted)]">{description}</p> : null}
                {!isAdmin ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    Espace coach — email et mot de passe. Les clients :{' '}
                    <Link href="/login/client" className="font-semibold underline">
                      connexion client
                    </Link>
                    .
                  </p>
                ) : null}
              </div>

              {authError === 'client_sur_coach_login' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
                  Ce compte est un client — pas l’app coach. Déconnecte-toi puis reconnecte-toi avec l’email coach.
                </div>
              ) : authError === 'magic_link_disabled' ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-100">
                  Les anciens liens magiques ne fonctionnent plus. Connecte-toi avec email + mot de passe (ou « Mot de
                  passe oublié »).
                </div>
              ) : authError ? (
                <div className="mt-4 rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-100">
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

                  {!isAdmin && userRole === 'client' ? (
                    <div className="mt-3 text-sm text-amber-800">
                      Tu es connecté en tant que <strong>client</strong>. Pour l’app coach, déconnecte-toi puis
                      connecte-toi avec ton email coach (ex. remi.sarro@gmail.com).
                    </div>
                  ) : null}

                  {isAdmin && isPlatformAdmin(userRole) ? (
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      Même email : tu peux aussi ouvrir l’{' '}
                      <Link href="/home" className="font-semibold underline">
                        espace coach
                      </Link>
                      .
                    </div>
                  ) : null}

                  {!isAdmin && isPlatformAdmin(userRole) ? (
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      Compte admin plateforme —{' '}
                      <Link href="/admin" className="font-semibold underline">
                        ouvrir /admin
                      </Link>
                      .
                    </div>
                  ) : null}

                  {isAdmin && userRole === 'coach' ? (
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      Ce compte coach n’a pas accès à l’administration.
                    </div>
                  ) : null}

                  {!isAdmin && userRole === 'admin' ? (
                    <div className="mt-3 text-sm text-[color:var(--muted)]">
                      Compte admin détecté —{' '}
                      <Link
                        href="/loginadmin"
                        className="font-semibold text-[var(--brand)] underline underline-offset-2"
                      >
                        connexion admin
                      </Link>
                      .
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {redirectTo &&
                    (isAdmin
                      ? isPlatformAdmin(userRole)
                      : userRole === 'coach' || isPlatformAdmin(userRole)) ? (
                      <Button href={redirectTo} variant="secondary" className="h-12 px-6 text-sm">
                        Continuer
                      </Button>
                    ) : null}

                    {!redirectTo && (userRole === 'coach' || (!isAdmin && isPlatformAdmin(userRole))) ? (
                      <Button href="/home" variant="primary" className="h-12 px-6 text-sm">
                        Aller à l’app coach
                      </Button>
                    ) : null}

                    {!redirectTo && userRole === 'client' && clientPortalHref ? (
                      <Button href={clientPortalHref} variant="secondary" className="h-12 px-6 text-sm">
                        Aller au portail client
                      </Button>
                    ) : null}

                    {!redirectTo && isPlatformAdmin(userRole) ? (
                      <Button
                        href="/admin"
                        variant={isAdmin || userRole === 'coach' ? 'primary' : 'secondary'}
                        className="h-12 px-6 text-sm"
                      >
                        Aller à l’admin
                      </Button>
                    ) : null}

                    <Button type="button" variant="ghost" className="h-12 px-6 text-sm" onClick={onSignOut}>
                      Se déconnecter
                    </Button>
                  </div>
                </div>
              ) : null}

              {!userEmail ? (
                <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                  {!isAdmin ? (
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        className={`rounded-[var(--radius-md)] px-3 py-2 font-semibold ${
                          coachMode === 'login'
                            ? 'on-brand'
                            : 'bg-[var(--accent)] text-[color:var(--brand)]'
                        }`}
                        onClick={() => {
                          setCoachMode('login')
                          setError(null)
                          setMessage(null)
                        }}
                      >
                        Se connecter
                      </button>
                      <button
                        type="button"
                        className={`rounded-[var(--radius-md)] px-3 py-2 font-semibold ${
                          coachMode === 'signup'
                            ? 'on-brand'
                            : 'bg-[var(--accent)] text-[color:var(--brand)]'
                        }`}
                        onClick={() => {
                          setCoachMode('signup')
                          setError(null)
                          setMessage(null)
                        }}
                      >
                        Créer un compte
                      </button>
                    </div>
                  ) : null}

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Email</span>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="toi@exemple.com"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Mot de passe</span>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={MIN_LEN}
                      autoComplete={coachMode === 'signup' && !isAdmin ? 'new-password' : 'current-password'}
                    />
                  </label>

                  {!isAdmin && coachMode === 'signup' ? (
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-[var(--brand)]">Confirmer le mot de passe</span>
                      <Input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={MIN_LEN}
                        autoComplete="new-password"
                      />
                    </label>
                  ) : null}

                  <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
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

                  <div className="text-sm text-[color:var(--muted)]">
                    <Link
                      href={`/auth/forgot-password?audience=${forgotAudience}`}
                      className="font-semibold text-[var(--brand)] underline underline-offset-2"
                    >
                      Mot de passe oublié ?
                    </Link>
                  </div>

                  {error ? (
                    <div className="rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-100">
                      {error}
                    </div>
                  ) : message ? (
                    <div className="rounded-[var(--radius-md)] bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      {message}
                    </div>
                  ) : null}
                </form>
              ) : null}

              <div className="mt-6 text-sm text-[color:var(--muted)]">
                En continuant, tu acceptes d’utiliser l’app en accès privé.
              </div>
            </div>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm font-semibold text-[var(--brand)] underline underline-offset-2">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </Container>
    </main>
  )
}
