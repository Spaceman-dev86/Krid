'use client'

import { useEffect, useState } from 'react'

import {
  resolveInterestDiscussBody,
  resolveInterestDiscussTitle,
} from '@/src/lib/coach/interestDiscussCopy'
import {
  resolveShowroomRefAction,
  submitTrackedLeadAction,
} from '@/src/lib/tracking/trackActions'
import type { TrackedChannel } from '@/src/lib/tracking/trackedLinks'

type Props = {
  coachId: string
  refCode: string | null
  brand: string
  brandFg: string
  discussTitle?: string | null
  discussBody?: string | null
  prestationId?: string | null
  prestationName?: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ShowroomInterestCta({
  coachId,
  refCode,
  brand,
  brandFg,
  discussTitle = null,
  discussBody = null,
  prestationId = null,
}: Props) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [linkId, setLinkId] = useState<string | null>(null)
  const [channel, setChannel] = useState<TrackedChannel | string>('other')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const emailOk = EMAIL_RE.test(email.trim())
  const canSend = Boolean(firstName.trim()) && Boolean(lastName.trim()) && emailOk

  useEffect(() => {
    let cancelled = false
    void resolveShowroomRefAction({ coachId, ref: refCode }).then((res) => {
      if (cancelled) return
      setReady(true)
      if (!res.ok) return
      setLinkId(res.linkId)
      setChannel(res.channel)
    })
    return () => {
      cancelled = true
    }
  }, [coachId, refCode])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend || !linkId) return
    setError(null)
    setPending(true)
    const res = await submitTrackedLeadAction({
      linkId,
      coachId,
      channel,
      firstName,
      lastName,
      email,
      prestationId: prestationId ?? undefined,
      note: note.trim() || undefined,
    })
    setPending(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
  }

  const title = resolveInterestDiscussTitle(discussTitle)
  const body = resolveInterestDiscussBody(discussBody)

  return (
    <>
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={() => {
            if (!linkId && ready) return
            setDone(false)
            setError(null)
            setOpen(true)
          }}
          disabled={ready && !linkId}
          className="inline-flex w-full max-w-sm justify-center rounded-full px-5 py-2.5 text-sm font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: brand, color: brandFg }}
        >
          Je suis intéressé
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="showroom-interest-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:rounded-2xl">
            {done ? (
              <div className="grid gap-3">
                <h2
                  id="showroom-interest-title"
                  className="text-base font-extrabold text-[color:var(--fg)]"
                >
                  Merci, c’est noté
                </h2>
                <p className="text-sm text-[color:var(--muted)]">
                  Tes infos sont bien enregistrées. Le coach te recontactera bientôt.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-flex justify-center rounded-full px-4 py-2 text-sm font-bold shadow-md"
                  style={{ background: brand, color: brandFg }}
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <h2
                  id="showroom-interest-title"
                  className="text-base font-extrabold text-[color:var(--fg)]"
                >
                  {title}
                </h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--muted)]">{body}</p>
                <form onSubmit={onSend} className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">Prénom</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">Nom</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">Email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    />
                    {email.trim() && !emailOk ? (
                      <span className="text-xs text-red-600">Email invalide</span>
                    ) : null}
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold text-[color:var(--fg)]">
                      Note <span className="font-normal text-[color:var(--muted)]">(optionnel)</span>
                    </span>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value.slice(0, 500))}
                      rows={3}
                      placeholder="Ton objectif, une question…"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                    />
                  </label>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)]"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={pending || !canSend}
                      className="inline-flex flex-1 justify-center rounded-full px-4 py-2 text-sm font-bold shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ background: brand, color: brandFg }}
                    >
                      {pending ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
