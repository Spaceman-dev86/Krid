'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  clientId: string
  createSessionAction: (formData: FormData) => Promise<void>
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function isoDateOnly(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export default function ScheduleSessionFromChatClient({ clientId, createSessionAction }: Props) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [date, setDate] = useState(() => isoDateOnly(new Date()))
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [notes, setNotes] = useState('')

  const disabled = useMemo(() => !date || !time || duration < 15 || isPending, [date, duration, isPending, time])

  function changeDuration(delta: number) {
    setDuration((prev) => {
      const next = Math.round((prev + delta) / 15) * 15
      return Math.max(15, next)
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Planifier une séance"
        title="Planifier une séance"
        className="group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#341c44] text-white shadow-sm hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#341c44]/30"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M7 3v2M17 3v2M4 8h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="pointer-events-none absolute right-full top-1/2 mr-2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#341c44] px-3 py-1 text-xs font-extrabold text-white shadow-sm group-hover:block">
          Planifier une séance
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (isPending) return
              setIsOpen(false)
            }}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-extrabold text-[#341c44]">Demande de séance</div>
                <div className="mt-1 text-xs font-semibold text-black/50">Elle sera ajoutée au calendrier et envoyée au client.</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isPending) return
                  setIsOpen(false)
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#341c44] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <div className="text-xs font-extrabold text-black/60">Date</div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                  />
                </label>

                <label className="grid gap-1">
                  <div className="text-xs font-extrabold text-black/60">Heure</div>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 rounded-2xl bg-white px-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                  />
                </label>
              </div>

              <div className="grid gap-1">
                <div className="text-xs font-extrabold text-black/60">Durée</div>
                <div className="flex h-11 items-stretch overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
                  <div className="flex flex-1 items-center px-3 text-sm font-semibold text-[#341c44]">{duration} min</div>
                  <div className="grid grid-rows-2">
                    <button
                      type="button"
                      onClick={() => changeDuration(15)}
                      className="inline-flex w-10 items-center justify-center border-l border-black/10 text-[#341c44] hover:bg-[#f5f5f5]"
                      aria-label="Augmenter la durée"
                      title="+15 min"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 14l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDuration(-15)}
                      className="inline-flex w-10 items-center justify-center border-l border-t border-black/10 text-[#341c44] hover:bg-[#f5f5f5]"
                      aria-label="Diminuer la durée"
                      title="-15 min"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                        <path d="M6 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <label className="grid gap-1">
                <div className="text-xs font-extrabold text-black/60">Note</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-[#341c44] ring-1 ring-black/10"
                />
              </label>

              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const fd = new FormData()
                  fd.set('client_id', clientId)
                  fd.set('date', date)
                  fd.set('time', time)
                  fd.set('duration_min', String(duration))
                  fd.set('notes', notes)

                  startTransition(async () => {
                    await createSessionAction(fd)
                    router.refresh()
                    setIsOpen(false)
                  })
                }}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#341c44] px-4 text-sm font-extrabold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                Envoyer la demande de séance
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
