'use client'

import { useEffect, useState } from 'react'

import { formatRestLabel } from '../../lib/client-portal/sessionRuns'

type Props = {
  seconds: number
  primaryColor: string
  onDone: () => void
  onSkip: () => void
}

export function ClientRestTimer({ seconds, primaryColor, onDone, onSkip }: Props) {
  const [left, setLeft] = useState(seconds)

  useEffect(() => {
    setLeft(seconds)
  }, [seconds])

  useEffect(() => {
    if (left <= 0) {
      onDone()
      return
    }
    const t = window.setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left, onDone])

  const pct = seconds > 0 ? Math.max(0, Math.min(100, (left / seconds) * 100)) : 0

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700/70">Repos</p>
          <p className="text-2xl font-extrabold tabular-nums text-sky-900">{formatRestLabel(left)}</p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-800"
        >
          Skip
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: primaryColor }}
        />
      </div>
    </div>
  )
}
