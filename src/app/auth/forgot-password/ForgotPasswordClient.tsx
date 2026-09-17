'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { createClient } from '../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../components/ui'

type Audience = 'coach' | 'client' | 'admin'

function loginPathFor(audience: Audience) {
  if (audience === 'admin') return '/loginadmin'
  if (audience === 'client') return '/login/client'
  return '/login'
}

export default function ForgotPasswordClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const audience = (searchParams.get('audience') as Audience | null) ?? 'coach'
  const urlError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(urlError)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const origin = window.location.origin
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/auth/callback/recovery`,
    })

    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setMessage('Si un compte existe pour cet email, un lien de réinitialisation a été envoyé.')
  }

  const backHref = loginPathFor(audience)

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[color:var(--fg)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">
                  Mot de passe oublié
                </h1>
                <p className="text-sm text-[color:var(--muted)]">
                  Entre ton email : tu recevras un lien pour choisir un nouveau mot de passe.
                </p>
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

                <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </Button>

                {error ? (
                  <div className="rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-100">
                    {error}
                  </div>
                ) : null}
                {message ? (
                  <div className="rounded-[var(--radius-md)] bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
                    {message}
                  </div>
                ) : null}
              </form>

              <div className="mt-6 text-sm text-[color:var(--muted)]">
                <Link href={backHref} className="font-semibold text-[var(--brand)] underline underline-offset-2">
                  Retour à la connexion
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
