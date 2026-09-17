'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { Button } from '@/src/components/ui'
import {
  clampOffsets,
  coverScale,
  exportCroppedJpeg,
  loadImage,
} from '../../lib/client/cropImage'

type Props = {
  source: string
  title?: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

const FRAME = 280

/** Pop-up recadrage photo (cercle) + zoom. */
export function PhotoCropModal({
  source,
  title = 'Recadrer la photo',
  onCancel,
  onConfirm,
}: Props) {
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [minScale, setMinScale] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const imgSize = useRef({ w: 0, h: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    let alive = true
    setReady(false)
    setError(null)
    void loadImage(source)
      .then((img) => {
        if (!alive) return
        const iw = img.naturalWidth || img.width
        const ih = img.naturalHeight || img.height
        if (!iw || !ih) {
          setError('Image invalide.')
          return
        }
        imgSize.current = { w: iw, h: ih }
        const base = coverScale(iw, ih, FRAME, FRAME)
        setMinScale(base)
        setScale(base)
        setOffsetX((FRAME - iw * base) / 2)
        setOffsetY((FRAME - ih * base) / 2)
        setReady(true)
      })
      .catch(() => {
        if (alive) setError('Impossible de charger l’image.')
      })
    return () => {
      alive = false
    }
  }, [source])

  function applyScale(next: number) {
    const { w, h } = imgSize.current
    if (!w || !h) return
    const clamped = Math.max(minScale, Math.min(minScale * 3, next))
    const cx = -offsetX + FRAME / 2
    const cy = -offsetY + FRAME / 2
    const ratio = clamped / scale
    const nx = -(cx * ratio - FRAME / 2)
    const ny = -(cy * ratio - FRAME / 2)
    const c = clampOffsets(w, h, FRAME, FRAME, clamped, nx, ny)
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
    const nx = drag.current.ox + (e.clientX - drag.current.x)
    const ny = drag.current.oy + (e.clientY - drag.current.y)
    const c = clampOffsets(w, h, FRAME, FRAME, scale, nx, ny)
    setOffsetX(c.offsetX)
    setOffsetY(c.offsetY)
  }

  function onPointerUp() {
    drag.current = null
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const blob = await exportCroppedJpeg({
        source,
        frameW: FRAME,
        frameH: FRAME,
        offsetX,
        offsetY,
        scale,
        outputWidth: 800,
        quality: 0.85,
      })
      onConfirm(new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de recadrage.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-crop-title"
        className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-5 shadow-xl"
      >
        <h3 id="photo-crop-title" className="text-sm font-extrabold text-[color:var(--brand)]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[color:var(--muted)]">Glisse pour déplacer · molette ou curseur pour zoomer</p>

        <div className="mt-4 flex justify-center">
          <div
            className={`relative overflow-hidden rounded-full border-4 border-[color-mix(in_srgb,var(--brand)_20%,transparent)] bg-[#1a1220] ${
              ready ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            style={{ width: FRAME, height: FRAME, maxWidth: '100%' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={(e) => {
              e.preventDefault()
              applyScale(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08))
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
              style={
                ready
                  ? {
                      width: imgSize.current.w * scale,
                      height: imgSize.current.h * scale,
                      transform: `translate(${offsetX}px, ${offsetY}px)`,
                    }
                  : { width: '100%', height: '100%', objectFit: 'cover' }
              }
            />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-3 text-xs font-semibold text-[color:var(--muted)]">
          Zoom
          <input
            type="range"
            min={minScale || 0.01}
            max={(minScale || 0.01) * 3}
            step={0.01}
            value={scale}
            disabled={!ready || busy}
            onChange={(e) => applyScale(Number(e.target.value))}
            className="flex-1"
          />
        </label>

        {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy} className="!rounded-lg !px-3 !py-2 text-sm">
            Annuler
          </Button>
          <Button type="button" onClick={() => void confirm()} disabled={!ready || busy} className="!rounded-lg !px-3 !py-2 text-sm">
            {busy ? '…' : 'Valider'}
          </Button>
        </div>
      </div>
    </div>
  )
}
