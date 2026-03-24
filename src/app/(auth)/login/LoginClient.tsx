'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

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

      const role = profile?.role
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
    <main style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Connexion</h1>

      {userEmail ? (
        <section style={{ marginBottom: 16, display: 'grid', gap: 10 }}>
          <p>Connecté en tant que: {userEmail}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {redirectTo ? (
              <Link
                href={redirectTo}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #111827',
                  textDecoration: 'none',
                  color: '#111827',
                }}
              >
                Continuer
              </Link>
            ) : null}

            {!redirectTo ? (
              <Link
                href={userRole === 'admin' ? '/admin' : '/dashboard'}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #111827',
                  background: '#111827',
                  textDecoration: 'none',
                  color: '#ffffff',
                }}
              >
                {userRole === 'admin' ? 'Aller à l’admin' : 'Aller au dashboard'}
              </Link>
            ) : null}

            <button
              type="button"
              onClick={onSignOut}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              Se déconnecter
            </button>
          </div>
        </section>
      ) : null}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => {
            setMode('coach')
            setError(null)
            setMessage(null)
          }}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: mode === 'coach' ? '#111827' : '#ffffff',
            color: mode === 'coach' ? '#ffffff' : '#111827',
            cursor: 'pointer',
          }}
        >
          Coach (lien magique)
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('admin')
            setError(null)
            setMessage(null)
          }}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: mode === 'admin' ? '#111827' : '#ffffff',
            color: mode === 'admin' ? '#ffffff' : '#111827',
            cursor: 'pointer',
          }}
        >
          Admin (mot de passe)
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="toi@exemple.com"
            style={{
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
            }}
          />
        </label>

        {mode === 'admin' ? (
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                padding: '10px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
              }}
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #111827',
            background: '#111827',
            color: '#ffffff',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? mode === 'admin'
              ? 'Connexion…'
              : 'Envoi…'
            : mode === 'admin'
              ? 'Se connecter (admin)'
              : 'Envoyer le lien magique'}
        </button>

        {error ? (
          <p style={{ color: '#b91c1c' }}>{error}</p>
        ) : message ? (
          <p style={{ color: '#065f46' }}>{message}</p>
        ) : null}
      </form>
    </main>
  )
}
