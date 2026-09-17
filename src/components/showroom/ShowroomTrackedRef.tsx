'use client'

import { useEffect, useState } from 'react'

import { submitTrackedLeadAction, trackShowroomRefAction } from '../../lib/tracking/trackActions'
import { TRACKED_CHANNELS } from '../../lib/tracking/trackedLinks'

type Props = {
  coachId: string
  refCode: string | null
  brand: string
}

export function ShowroomTrackedRef({ coachId, refCode, brand }: Props) {
  const [leadOpen, setLeadOpen] = useState(false)
  const [linkId, setLinkId] = useState<string | null>(null)
  const [channel, setChannel] = useState('other')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState('')
  const [phone, setPhone] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    if (!refCode) return
    let cancelled = false
    void trackShowroomRefAction({ coachId, ref: refCode }).then((res) => {
      if (cancelled || !res.ok) return
      if (res.captureLeads) {
        setLinkId(res.linkId)
        setChannel(res.channel)
        setLeadOpen(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [coachId, refCode])

  if (!leadOpen || !linkId || done) return null

  const meta = TRACKED_CHANNELS.find((c) => c.id === channel) ?? TRACKED_CHANNELS[3]

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await submitTrackedLeadAction({
      linkId: linkId!,
      coachId,
      channel,
      handle: channel === 'ig' || channel === 'other' ? handle : undefined,
      phone: channel === 'wa' ? phone : undefined,
      firstName: channel === 'fb' ? firstName : undefined,
      lastName: channel === 'fb' ? lastName : undefined,
    })
    if (!res.ok) {
      setError(res.error)
      return
    }
    setDone(true)
    setLeadOpen(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-extrabold text-[#341c44]">Reste en contact</h3>
        <p className="mt-1 text-sm text-black/55">
          Ton coach a activé la capture de leads pour cette campagne ({meta.label}).
          Les clics seuls restent anonymes — tu choisis ce que tu partages.
        </p>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          {channel === 'ig' || channel === 'other' ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">{meta.leadHint}</span>
              <input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                required={channel === 'ig'}
                placeholder={channel === 'ig' ? '@ton_compte' : 'Email ou info'}
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          ) : null}
          {channel === 'wa' ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Téléphone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                type="tel"
                className="rounded-lg border border-black/15 px-3 py-2"
              />
            </label>
          ) : null}
          {channel === 'fb' ? (
            <>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Prénom</span>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Nom</span>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="rounded-lg border border-black/15 px-3 py-2"
                />
              </label>
            </>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLeadOpen(false)}
              className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold text-black/60"
            >
              Pas maintenant
            </button>
            <button
              type="submit"
              className="rounded-lg px-4 py-2 text-sm font-bold text-white"
              style={{ background: brand }}
            >
              Envoyer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
