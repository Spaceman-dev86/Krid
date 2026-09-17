'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/client'
import { selectFieldClass, selectFieldStyle } from '../../../../lib/ui/selectField'
import {
  confirmClientEmailForLogin,
  linkAuthenticatedUserToCoach,
  provisionConfirmedClientUser,
  syncClientSignupProfile,
} from './actions'

type Props = {
  slug: string
  coachId: string
  prestaId: string | null
  nextPath?: string | null
  brand: string
  appName: string
  initialEmail?: string | null
}

const MIN_LEN = 8

export function RejoindreClient({
  slug,
  coachId,
  prestaId,
  nextPath,
  brand,
  appName,
  initialEmail,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [view, setView] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [sex, setSex] = useState('')
  const [age, setAge] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const backHref = prestaId ? `/c/${slug}/showroom/${prestaId}` : `/c/${slug}/showroom`

  async function patchClientProfile(_userId: string) {
    const ageNum = Number.parseInt(age, 10)
    const synced = await syncClientSignupProfile({
      slug,
      coachId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      sex: sex.trim(),
      age: Number.isFinite(ageNum) ? ageNum : 0,
    })
    if (!synced.ok) {
      setError(synced.error)
      return false
    }
    return true
  }

  async function linkToCoach(opts?: { withProfile: boolean }) {
    if (opts?.withProfile) {
      return patchClientProfile('')
    }

    const linked = await linkAuthenticatedUserToCoach({
      slug,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
    })
    if (!linked.ok) {
      setError(linked.error)
      return false
    }
    return true
  }

  async function goNext() {
    if (nextPath) {
      router.replace(nextPath)
      return
    }
    if (prestaId) {
      router.replace(`/c/${slug}/showroom/${prestaId}`)
      return
    }
    router.replace(`/c/${slug}/home`)
  }

  async function signInAndEnter(withProfile: boolean) {
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError || !data.user) {
      const msg = signInError?.message ?? 'Email ou mot de passe incorrect.'
      if (/not confirmed|email not confirmed/i.test(msg)) {
        const provisioned = await confirmClientEmailForLogin({
          email: email.trim().toLowerCase(),
          password,
        })
        if (provisioned.ok) {
          const retry = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
          })
          if (!retry.error && retry.data.user) {
            const ok = await linkToCoach({ withProfile })
            if (ok) {
              await goNext()
              return true
            }
            return false
          }
        }
      }
      setError(msg)
      return false
    }

    const ok = await linkToCoach({ withProfile })
    if (!ok) return false
    await goNext()
    return true
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    await signInAndEnter(false)
    setLoading(false)
  }

  async function onSignup(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (!firstName.trim() || !lastName.trim()) {
      setError('Indique ton prénom et ton nom.')
      setLoading(false)
      return
    }
    if (!sex.trim()) {
      setError('Indique ton sexe.')
      setLoading(false)
      return
    }
    const ageNum = Number.parseInt(age, 10)
    if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 100) {
      setError('Indique un âge valide.')
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

    const provisioned = await provisionConfirmedClientUser({
      email: email.trim().toLowerCase(),
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    })

    if (!provisioned.ok) {
      if (provisioned.code === 'already_exists') {
        setView('login')
        setError('Un compte existe déjà — connecte-toi avec ton mot de passe.')
      } else {
        setError(provisioned.error)
      }
      setLoading(false)
      return
    }

    await signInAndEnter(true)
    setLoading(false)
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Link href={backHref} className="text-sm font-semibold text-black/45 hover:underline">
        ← Retour à l’offre
      </Link>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold" style={{ color: brand }}>
          {view === 'login' ? 'Me connecter' : 'Créer un compte'}
        </h1>
        <p className="mt-1 text-sm text-black/55">
          {view === 'login'
            ? `Accède à ton espace ${appName}.`
            : `Rejoins ${appName} — renseigne tes infos puis ton mot de passe.`}
        </p>

        {view === 'login' ? (
          <form onSubmit={onLogin} className="mt-5 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Mot de passe</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2"
                autoComplete="current-password"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: brand }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>

            <p className="pt-1 text-center text-sm text-black/55">
              Pas encore de compte ?{' '}
              <button
                type="button"
                className="font-bold underline"
                style={{ color: brand }}
                onClick={() => {
                  setView('signup')
                  setError(null)
                  setMessage(null)
                  setPassword('')
                  setConfirm('')
                }}
              >
                Créer un compte
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={onSignup} className="mt-5 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-semibold">Prénom *</span>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="min-w-0 w-full rounded-lg border border-black/15 px-3 py-2"
                  autoComplete="given-name"
                />
              </label>
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-semibold">Nom *</span>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="min-w-0 w-full rounded-lg border border-black/15 px-3 py-2"
                  autoComplete="family-name"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-semibold">Sexe *</span>
                <select
                  required
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className={`${selectFieldClass} min-w-0 w-full`}
                  style={selectFieldStyle}
                >
                  <option value="">Choisir…</option>
                  <option value="F">Femme</option>
                  <option value="M">Homme</option>
                  <option value="X">Autre</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm">
                <span className="font-semibold">Âge *</span>
                <input
                  required
                  type="number"
                  min={10}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="min-w-0 w-full rounded-lg border border-black/15 px-3 py-2"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Email *</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2"
                autoComplete="email"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Mot de passe *</span>
              <input
                type="password"
                required
                minLength={MIN_LEN}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2"
                autoComplete="new-password"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Confirmer le mot de passe *</span>
              <input
                type="password"
                required
                minLength={MIN_LEN}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="rounded-lg border border-black/15 px-3 py-2"
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: brand }}
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>

            <p className="pt-1 text-center text-sm text-black/55">
              Déjà un compte ?{' '}
              <button
                type="button"
                className="font-bold underline"
                style={{ color: brand }}
                onClick={() => {
                  setView('login')
                  setError(null)
                  setMessage(null)
                }}
              >
                Me connecter
              </button>
            </p>
          </form>
        )}

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {message}
          </p>
        ) : null}

        <p className="mt-4 text-center text-xs text-black/40">
          <Link href={`/auth/forgot-password?audience=client`} className="underline">
            Mot de passe oublié ?
          </Link>
        </p>
      </div>
    </div>
  )
}
