'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../components/ui'

export default function LoginClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'coach' | 'admin'>('coach')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'coach' | null>(null)

  const redirectTo = searchParams.get('redirectTo')

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

      if (normalizedRole === 'admin') {
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
  }, [supabase])

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

    if (mode === 'admin') {
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

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[var(--text)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">Connexion</h1>
                <p className="text-sm text-[var(--muted)]">
                  Accède au dashboard pour créer et consulter tes programmes.
                </p>
              </div>

              {userEmail ? (
                <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--accent)] p-5 ring-1 ring-[var(--border)]">
                  <div className="text-sm font-semibold text-[var(--brand)]">Connecté</div>
                  <div className="mt-1 text-sm text-[var(--text)]">{userEmail}</div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {redirectTo ? (
                      <Button href={redirectTo} variant="secondary" className="h-12 px-6 text-sm">
                        Continuer
                      </Button>
                    ) : null}

                    {!redirectTo ? (
                      <Button
                        href={userRole === 'admin' ? '/admin' : '/dashboard'}
                        variant="primary"
                        className="h-12 px-6 text-sm"
                      >
                        {userRole === 'admin' ? 'Aller à l’admin' : 'Aller au dashboard'}
                      </Button>
                    ) : null}

                    <Button
                      type="button"
                      variant="ghost"
                      className="h-12 px-6 text-sm"
                      onClick={onSignOut}
                    >
                      Se déconnecter
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6">
                <div className="inline-flex rounded-full bg-[var(--accent)] p-1 ring-1 ring-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('coach')
                      setError(null)
                      setMessage(null)
                    }}
                    className={`h-11 rounded-full px-5 text-sm font-semibold transition ${
                      mode === 'coach'
                        ? 'bg-[var(--brand)] text-white'
                        : 'text-[var(--brand)] hover:bg-white/70'
                    }`}
                  >
                    Coach
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('admin')
                      setError(null)
                      setMessage(null)
                    }}
                    className={`h-11 rounded-full px-5 text-sm font-semibold transition ${
                      mode === 'admin'
                        ? 'bg-[var(--brand)] text-white'
                        : 'text-[var(--brand)] hover:bg-white/70'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>

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

                {mode === 'admin' ? (
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
                  <div className="text-sm text-[var(--muted)]">
                    Un lien de connexion sera envoyé par email.
                  </div>
                )}

                <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
                  {loading
                    ? mode === 'admin'
                      ? 'Connexion…'
                      : 'Envoi…'
                    : mode === 'admin'
                      ? 'Se connecter (admin)'
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
