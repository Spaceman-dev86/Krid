'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import {
  clampOffsets,
  coverScale,
  exportCroppedJpeg,
  loadImage,
} from '../../lib/client/cropImage'

type Props = {
  source: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

/** Recadrage cover plein bandeau — pas de pop-up, boutons toujours visibles. */
export function CoverPanEditor({ source, onCancel, onConfirm }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMetrics, setHasMetrics] = useState(false)
  const imgSize = useRef({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      if (w < 8 || h < 8) return
      setFrame((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const t = window.setTimeout(measure, 32)
    return () => {
      ro.disconnect()
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (frame.w < 8 || frame.h < 8) return
    let alive = true
    setReady(false)
    setHasMetrics(false)
    setError(null)
    void loadImage(source)
      .then((img) => {
        if (!alive) return
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (!iw || !ih) {
          setError('Image invalide.')
          setReady(true)
          return
        }
        imgSize.current = { w: iw, h: ih }
        const base = coverScale(iw, ih, frame.w, frame.h)
        setMinScale(base)
        setScale(base)
        setOffsetX((frame.w - iw * base) / 2)
        setOffsetY((frame.h - ih * base) / 2)
        setHasMetrics(true)
        setReady(true)
      })
      .catch(() => {
        if (alive) {
          setError('Chargement métriques échoué — réessaie Annuler puis Recadrer.')
          setReady(true)
        }
      })
    return () => {
      alive = false
    }
  }, [source, frame.w, frame.h])

  function applyScale(next: number) {
    const { w, h } = imgSize.current
    if (!w || !h || frame.w < 8) return
    const clamped = Math.max(minScale, Math.min(minScale * 3, next))
    const cx = -offsetX + frame.w / 2
    const cy = -offsetY + frame.h / 2
    const ratio = clamped / scale
    const nx = -(cx * ratio - frame.w / 2)
    const ny = -(cy * ratio - frame.h / 2)
    const c = clampOffsets(w, h, frame.w, frame.h, clamped, nx, ny)
    setScale(clamped)
    setOffsetX(c.offsetX)
    setOffsetY(c.offsetY)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    const { w, h } = imgSize.current
    if (!w || !h) {
      // sans métriques : décalage libre limité
      setOffsetX(drag.current.ox + (e.clientX - drag.current.x))
      setOffsetY(drag.current.oy + (e.clientY - drag.current.y))
      return
    }
    const nx = drag.current.ox + (e.clientX - drag.current.x)
    const ny = drag.current.oy + (e.clientY - drag.current.y)
    const c = clampOffsets(w, h, frame.w, frame.h, scale, nx, ny)
    setOffsetX(c.offsetX)
    setOffsetY(c.offsetY)
  }

  function onPointerUp() {
    drag.current = null
  }

  async function confirm() {
    if (frame.w < 8 || frame.h < 8) {
      setError('Zone trop petite.')
      return
    }
    if (!imgSize.current.w) {
      setError('Image pas encore prête — réessaie.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const blob = await exportCroppedJpeg({
        source,
        frameW: frame.w,
        frameH: frame.h,
        offsetX,
        offsetY,
        scale,
        outputWidth: 1600,
        quality: 0.82,
      })
      onConfirm(new File([blob], 'cover.jpg', { type: 'image/jpeg' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recadrage.')
      setBusy(false)
    }
  }

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 z-40 flex min-h-[220px] flex-col bg-[#1a1220] sm:min-h-[260px]"
    >
      <div
        className={`relative min-h-0 flex-1 touch-none overflow-hidden ${
          hasMetrics ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => {
          e.preventDefault()
          if (hasMetrics) applyScale(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
        }}
      >
        {/* Toujours une image visible (évite fond blanc) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
          style={
            hasMetrics
              ? {
                  width: imgSize.current.w * scale,
                  height: imgSize.current.h * scale,
                  transform: `translate(${offsetX}px, ${offsetY}px)`,
                }
              : {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }
          }
        />
      </div>

      <div className="absolute inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
        <p className="text-[11px] font-semibold text-white">Glisse pour recadrer la cover</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#1a1220] shadow"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || !ready || !hasMetrics}
            className="rounded-md bg-white px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand)] shadow disabled:opacity-50"
          >
            {busy ? '…' : 'Valider'}
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-50 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
        <label className="flex items-center gap-2 text-[11px] font-semibold text-white">
          Zoom
          <input
            type="range"
            min={minScale || 0.01}
            max={(minScale || 0.01) * 3}
            step={0.01}
            value={scale}
            disabled={!hasMetrics || busy}
            onChange={(e) => applyScale(Number(e.target.value))}
            className="flex-1"
          />
        </label>
        {error ? <p className="mt-1 text-[11px] font-semibold text-red-200">{error}</p> : null}
      </div>
    </div>
  )
}
