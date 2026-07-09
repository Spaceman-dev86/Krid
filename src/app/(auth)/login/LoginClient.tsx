'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../components/ui'

type LoginVariant = 'coach' | 'admin'

type Props = {
  variant: LoginVariant
}

export default function LoginClient({ variant }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'coach' | null>(null)

  const redirectTo = searchParams.get('redirectTo')
  const isAdmin = variant === 'admin'

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUserEmail(data.user?.email ?? null)

      if (!data.user) {
        setUserRole(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      const typedProfile = profile as unknown as { role: string | null } | null
      const role = typedProfile?.role
      const normalizedRole = role === 'admin' || role === 'coach' ? role : null
      setUserRole(normalizedRole)

      if (isAdmin && normalizedRole === 'admin') {
        window.location.replace('/admin')
        return
      }

      if (!isAdmin && normalizedRole === 'coach') {
        window.location.replace('/dashboard')
        return
      }

      if (!isAdmin && normalizedRole === 'admin') {
        window.location.replace('/admin')
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
  }, [supabase, isAdmin])

  async function onSignOut() {
    await supabase.auth.signOut()
    setUserEmail(null)
    setUserRole(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (isAdmin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      setMessage('Connexion admin réussie.')
      setLoading(false)
      window.location.replace('/admin')
      return
    }

    const origin = window.location.origin

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    setMessage('Lien magique envoyé. Vérifie ta boîte mail.')
    setLoading(false)
  }

  const title = isAdmin
    ? 'Connexion admin'
    : 'Connecte-toi et accède à une démo gratuite d’une application de coach sportif'
  const description = isAdmin
    ? 'Accès réservé à l’administration de la plateforme.'
    : 'Pas besoin de mot de passe, ton mail suffit.'
  const defaultDestination = isAdmin ? '/admin' : '/dashboard'
  const destinationLabel = isAdmin ? 'Aller à l’admin' : 'Aller au dashboard'

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--text)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">{title}</h1>
                <p className="text-sm text-[var(--muted)]">{description}</p>
              </div>

              {userEmail ? (
                <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--accent)] p-5 ring-1 ring-[var(--border)]">
                  <div className="text-sm font-semibold text-[var(--brand)]">Connecté</div>
                  <div className="mt-1 text-sm text-[var(--text)]">{userEmail}</div>

                  {isAdmin && userRole === 'coach' ? (
                    <div className="mt-3 text-sm text-[var(--muted)]">
                      Ce compte coach n’a pas accès à l’administration.
                    </div>
                  ) : null}

                  {!isAdmin && userRole === 'admin' ? (
                    <div className="mt-3 text-sm text-[var(--muted)]">
                      Compte admin détecté —{' '}
                      <Link href="/loginadmin" className="font-semibold text-[var(--brand)] underline underline-offset-2">
                        connexion admin
                      </Link>
                      .
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {redirectTo && (isAdmin ? userRole === 'admin' : userRole === 'coach' || userRole === 'admin') ? (
                      <Button href={redirectTo} variant="secondary" className="h-12 px-6 text-sm">
                        Continuer
                      </Button>
                    ) : null}

                    {!redirectTo && (isAdmin ? userRole === 'admin' : userRole === 'coach' || userRole === 'admin') ? (
                      <Button
                        href={userRole === 'admin' && !isAdmin ? '/admin' : defaultDestination}
                        variant="primary"
                        className="h-12 px-6 text-sm"
                      >
                        {userRole === 'admin' && !isAdmin ? 'Aller à l’admin' : destinationLabel}
                      </Button>
                    ) : null}

                    <Button type="button" variant="ghost" className="h-12 px-6 text-sm" onClick={onSignOut}>
                      Se déconnecter
                    </Button>
                  </div>
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
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

                {isAdmin ? (
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
                ) : (
                  <div className="text-sm text-[var(--muted)]">Un lien de connexion sera envoyé par email.</div>
                )}

                <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
                  {loading
                    ? isAdmin
                      ? 'Connexion…'
                      : 'Envoi…'
                    : isAdmin
                      ? 'Se connecter'
                      : 'Envoyer le lien magique'}
                </Button>

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

              <div className="mt-6 text-sm text-[var(--muted)]">
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
