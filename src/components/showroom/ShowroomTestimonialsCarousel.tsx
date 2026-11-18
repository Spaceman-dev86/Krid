'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { ShowroomTestimonial } from '@/src/lib/coach/showroomTestimonials'

type Props = {
  items: ShowroomTestimonial[]
  compact?: boolean
  className?: string
}

const INTERVAL_MS = 4000

/** Carrousel témoignages : auto 4s · flèche · swipe. */
export function ShowroomTestimonialsCarousel({ items, compact = false, className = '' }: Props) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const paused = useRef(false)

  const count = items.length
  const go = useCallback(
    (dir: 1 | -1) => {
      if (count < 2) return
      setIndex((i) => (i + dir + count) % count)
    },
    [count],
  )

  useEffect(() => {
    setIndex(0)
  }, [count])

  useEffect(() => {
    if (count < 2) return
    const id = window.setInterval(() => {
      if (paused.current) return
      setIndex((i) => (i + 1) % count)
    }, INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [count])

  if (!count) return null

  const current = items[index]!

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-black text-white ${className}`}
      onMouseEnter={() => {
        paused.current = true
      }}
      onMouseLeave={() => {
        paused.current = false
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
        paused.current = true
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        touchX.current = null
        paused.current = false
        if (start == null) return
        const end = e.changedTouches[0]?.clientX
        if (end == null) return
        const dx = end - start
        if (Math.abs(dx) < 40) return
        go(dx < 0 ? 1 : -1)
      }}
    >
      <div
        className={`relative w-full overflow-hidden bg-black ${
          compact ? 'aspect-[5/4]' : 'aspect-[5/4] sm:aspect-[4/3]'
        }`}
      >
        {current.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.photo_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-700 to-neutral-950" />
        )}
      </div>

      <div className={compact ? 'px-2.5 pb-2.5 pt-2' : 'px-4 pb-4 pt-3 sm:px-5'}>
        <div className="flex items-start justify-between gap-2">
          <p
            className={`min-w-0 flex-1 font-extrabold uppercase tracking-wide ${
              compact ? 'text-[11px] leading-tight' : 'text-base sm:text-lg'
            }`}
          >
            {current.name}
          </p>
          {count > 1 ? (
            <button
              type="button"
              onClick={() => go(1)}
              className={`shrink-0 font-bold text-white/90 hover:text-white ${
                compact ? 'px-1 text-sm' : 'px-1.5 text-lg'
              }`}
              aria-label="Témoignage suivant"
            >
              ›
            </button>
          ) : null}
        </div>
        {current.quote.trim() ? (
          <p
            className={`mt-1.5 whitespace-pre-wrap leading-snug text-white/90 ${
              compact ? 'text-[10px]' : 'text-sm'
            }`}
          >
            {current.quote}
          </p>
        ) : null}
        {count > 1 ? (
          <div className={`flex justify-center gap-1 ${compact ? 'mt-2' : 'mt-3'}`}>
            {items.map((t, i) => (
              <button
                key={t.id}
                type="button"
                aria-label={`Témoignage ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`rounded-full transition ${
                  i === index ? 'bg-white' : 'bg-white/35'
                } ${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
