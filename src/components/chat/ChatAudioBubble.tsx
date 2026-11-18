'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Props = {
  src: string
  durationMs?: number | null
  mine: boolean
  coachUi: boolean
  seed?: string
}

function barsFromSeed(seed: string, count = 28): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    h = (h * 1664525 + 1013904223) >>> 0
    out.push(0.25 + (h % 75) / 100)
  }
  return out
}

function formatDur(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} className={className} aria-hidden fill="currentColor">
      <path d="M8 5.14v13.72L19 12 8 5.14z" />
    </svg>
  )
}

function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={12} height={12} className={className} aria-hidden fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

export function ChatAudioBubble({ src, durationMs, mine, coachUi: _coachUi, seed = src }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(0)
  const bars = useMemo(() => barsFromSeed(seed), [seed])
  const totalSec = (durationMs && durationMs > 0 ? durationMs / 1000 : null) ?? null

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    function onTime() {
      const dur = a.duration || totalSec || 1
      setCurrent(a.currentTime)
      setProgress(Math.min(1, a.currentTime / dur))
    }
    function onEnd() {
      setPlaying(false)
      setProgress(0)
      setCurrent(0)
    }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [totalSec])

  async function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
      return
    }
    try {
      await a.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const barColor = mine ? 'bg-[var(--brand-fg)]/55' : 'bg-[color:var(--brand)]/70'
  const barPlayed = mine ? 'bg-[var(--brand-fg)]' : 'bg-[color:var(--brand)]'
  const micBg = mine
    ? 'bg-[var(--brand-fg)] text-[var(--brand)]'
    : 'bg-[color:var(--brand)] text-[var(--brand-fg)]'

  const displayDur =
    totalSec != null ? formatDur(playing || current > 0 ? current : totalSec) : formatDur(current)

  return (
    <div className="mb-1 flex min-w-[14rem] max-w-full items-center gap-2.5 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <div className="relative shrink-0">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full ${
            mine ? 'bg-[var(--brand-fg)]/15' : 'bg-[var(--accent)]'
          }`}
        >
          <span className="text-lg" aria-hidden>
            🎧
          </span>
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${micBg}`}
          aria-hidden
        >
          🎤
        </span>
      </div>

      <button
        type="button"
        onClick={toggle}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          mine
            ? 'bg-[var(--brand-fg)]/15 text-[var(--brand-fg)] hover:bg-[var(--brand-fg)]/25'
            : 'bg-[color:var(--brand)] text-[var(--brand-fg)] hover:brightness-105'
        }`}
        aria-label={playing ? 'Pause' : 'Lecture'}
      >
        {playing ? <PauseGlyph /> : <PlayGlyph className="ml-0.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-end gap-[2px]">
          {bars.map((h, i) => {
            const filled = i / bars.length <= progress
            return (
              <span
                key={i}
                className={`w-[3px] rounded-full ${filled ? barPlayed : barColor}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            )
          })}
        </div>
        <p
          className={`mt-0.5 text-[10px] font-semibold tabular-nums ${
            mine ? 'text-[var(--brand-fg)]/70' : 'text-[color:var(--muted)]'
          }`}
        >
          {displayDur}
        </p>
      </div>
    </div>
  )
}
