'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

import { markPasswordSet } from '../../../lib/auth/password'
import { createClient } from '../../../lib/supabase/client'
import { Button, Card, Container, Input } from '../../../components/ui'

const MIN_LEN = 8

function ageToBirthDate(age: number): string {
  const year = new Date().getFullYear() - age
  return `${year}-01-01`
}

function birthDateToAge(birthDate: string | null | undefined): string {
  if (!birthDate) return ''
  const y = Number.parseInt(birthDate.slice(0, 4), 10)
  if (!Number.isFinite(y)) return ''
  return String(new Date().getFullYear() - y)
}

export default function UpdatePasswordClient() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') === 'set' ? 'set' : 'reset'
  const nextParam = searchParams.get('next')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState('')
  const [age, setAge] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [role, setRole] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)
  const [coachId, setCoachId] = useState<string | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setHasSession(Boolean(data.user))
      setReady(true)
      if (!data.user) return

      setEmail(data.user.email ?? '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()
      const roleValue = (profile as { role?: string } | null)?.role ?? null
      setRole(roleValue)

      if (roleValue === 'client' || mode === 'set') {
        const { data: client } = await supabase
          .from('clients')
          .select('id, coach_id, email, first_name, last_name, sex, birth_date')
          .eq('user_id', data.user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (client) {
          setClientId(client.id)
          setCoachId(client.coach_id)
          if (!data.user.email && client.email) setEmail(client.email)
          setFirstName(client.first_name ?? '')
          setLastName(client.last_name ?? '')
          setSex(client.sex ?? '')
          setAge(birthDateToAge(client.birth_date))
          const incomplete =
            !client.first_name?.trim() ||
            !client.last_name?.trim() ||
            !client.sex?.trim() ||
            !client.birth_date
          setNeedsProfile(mode === 'set' && incomplete)
        } else if (mode === 'set' && roleValue === 'client') {
          setNeedsProfile(true)
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase, mode])

  function resolveNext(roleValue: string | null) {
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) return nextParam
    if (roleValue === 'client') return '/login/client'
    if (roleValue === 'admin' || roleValue === 'platform_admin') return '/admin'
    return '/home'
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const askProfile = needsProfile

    if (askProfile) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Indique ton prénom et ton nom.')
        return
      }
      if (!sex.trim()) {
        setError('Indique ton sexe.')
        return
      }
      const ageNum = Number.parseInt(age, 10)
      if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 100) {
        setError('Indique un âge valide.')
        return
      }
    }

    if (password.length < MIN_LEN) {
      setError(`Le mot de passe doit faire au moins ${MIN_LEN} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      data: {
        password_set: true,
        full_name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
      },
    })

    if (updateError || !data.user) {
      setLoading(false)
      setError(updateError?.message ?? 'Impossible de mettre à jour le mot de passe.')
      return
    }

    await markPasswordSet(supabase, data.user.id)

    if (askProfile) {
      const ageNum = Number.parseInt(age, 10)
      const patch = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sex: sex.trim(),
        birth_date: ageToBirthDate(ageNum),
        updated_at: new Date().toISOString(),
      }

      if (clientId) {
        await supabase.from('clients').update(patch).eq('id', clientId)
      } else if (coachId) {
        await supabase.from('clients').update(patch).eq('user_id', data.user.id).eq('coach_id', coachId)
      } else {
        await supabase.from('clients').update(patch).eq('user_id', data.user.id)
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()
    const roleValue = (profile as { role?: string } | null)?.role ?? role

    setLoading(false)
    window.location.replace(resolveNext(roleValue))
  }

  const askProfile = needsProfile
  const title = mode === 'set' ? (askProfile ? 'Compléter mon compte' : 'Choisir un mot de passe') : 'Nouveau mot de passe'
  const subtitle =
    mode === 'set'
      ? askProfile
        ? 'Renseigne tes infos puis choisis un mot de passe pour accéder à ton espace.'
        : 'Dernière étape : choisis un mot de passe pour tes prochaines connexions.'
      : 'Choisis un nouveau mot de passe pour ton compte.'

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg)] text-[color:var(--fg)]">
      <Container className="py-10 md:py-14">
        <div className="mx-auto max-w-xl">
          <Card className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--border)]">
            <div className="bg-[var(--surface)] p-8 sm:p-10">
              <div className="grid gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-[var(--brand)]">{title}</h1>
                <p className="text-sm text-[color:var(--muted)]">{subtitle}</p>
              </div>

              {ready && !hasSession ? (
                <div className="mt-6 rounded-[var(--radius-md)] bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-100">
                  Session expirée. Demande un nouveau lien depuis{' '}
                  <Link href="/auth/forgot-password" className="font-semibold underline">
                    Mot de passe oublié
                  </Link>{' '}
                  ou reconnecte-toi.
                </div>
              ) : null}

              {hasSession ? (
                <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                  {askProfile ? (
                    <>
                      <label className="grid gap-2">
                        <span className="text-sm font-semibold text-[var(--brand)]">Email *</span>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          autoComplete="email"
                          readOnly={Boolean(email)}
                          className={email ? 'bg-black/[0.03]' : undefined}
                        />
                        {email ? (
                          <span className="text-xs text-[color:var(--muted)]">
                            Email du compte (non modifiable ici).
                          </span>
                        ) : null}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-[var(--brand)]">Prénom *</span>
                          <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            autoComplete="given-name"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-[var(--brand)]">Nom *</span>
                          <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            autoComplete="family-name"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-[var(--brand)]">Sexe *</span>
                          <select
                            required
                            value={sex}
                            onChange={(e) => setSex(e.target.value)}
                            className="h-11 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 text-sm"
                          >
                            <option value="">Choisir…</option>
                            <option value="F">Femme</option>
                            <option value="M">Homme</option>
                            <option value="Autre">Autre</option>
                          </select>
                        </label>
                        <label className="grid gap-2">
                          <span className="text-sm font-semibold text-[var(--brand)]">Âge *</span>
                          <Input
                            type="number"
                            min={10}
                            max={100}
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            required
                            inputMode="numeric"
                          />
                        </label>
                      </div>
                    </>
                  ) : null}

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Mot de passe *</span>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={MIN_LEN}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[var(--brand)]">Confirmer *</span>
                    <Input
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={MIN_LEN}
                      autoComplete="new-password"
                    />
                  </label>

                  <Button type="submit" disabled={loading} className="h-14 rounded-[var(--radius-md)]">
                    {loading ? 'Enregistrement…' : 'Continuer'}
                  </Button>

                  {error ? (
                    <div className="rounded-[var(--radius-md)] bg-red-50 p-4 text-sm font-semibold text-red-800 ring-1 ring-red-100">
                      {error}
                    </div>
                  ) : null}

                  <p className="text-xs text-[color:var(--muted)]">
                    Mauvaise session ?{' '}
                    <Link href="/auth/signout?next=/login/client" className="font-semibold underline">
                      Se déconnecter
                    </Link>
                  </p>
                </form>
              ) : null}
            </div>
          </Card>
        </div>
      </Container>
    </main>
  )
}
