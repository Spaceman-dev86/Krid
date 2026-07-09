'use client'

import Link from 'next/link'

import { isPngOrGifMedia } from '../lib/exerciseMedia'
import { buildPreviewExerciseMetaLine } from '../lib/previewExerciseMeta'
import { IconNote, IconOpen, IconStats } from './ui/icons'

export type PreviewExerciseCardProps = {
  displayName: string
  sets?: number | string | null
  reps?: number | string | null
  restTime?: string | number | null
  restSeconds?: number | null
  rpe?: number | string | null
  tempo?: string | null
  load?: string | null
  loadText?: string | null
  notes?: string | null
  demoMediaUrl?: string | null
  demoMediaPath?: string | null
  exerciseHref?: string | null
  isOpen: boolean
  onToggle: () => void
  /** When true, only renders the expanded demo panel (for use inside block pills). */
  embedded?: boolean
}

function previewDemoImageClassName(pathOrUrl: string | null | undefined, embedded: boolean) {
  if (isPngOrGifMedia(pathOrUrl)) {
    return embedded
      ? 'mx-auto min-h-[240px] max-h-[28rem] w-full object-contain p-4'
      : 'mx-auto min-h-[300px] max-h-[28rem] w-full object-contain p-4'
  }
  return embedded
    ? 'block h-64 w-full object-cover sm:h-80'
    : 'block h-64 w-full object-cover sm:h-80'
}

export default function PreviewExerciseCard({
  displayName,
  sets,
  reps,
  restTime,
  restSeconds,
  rpe,
  tempo,
  load,
  loadText,
  notes,
  demoMediaUrl,
  demoMediaPath,
  exerciseHref,
  isOpen,
  onToggle,
  embedded = false,
}: PreviewExerciseCardProps) {
  const exerciseMetaLine = buildPreviewExerciseMetaLine({
    sets,
    reps,
    restTime,
    restSeconds,
    rpe,
    tempo,
    load,
    loadText,
  })
  const trimmedNotes = String(notes ?? '').trim() || null
  const mediaPath = demoMediaPath ?? demoMediaUrl ?? null

  function renderExpandedDemo() {
    if (!demoMediaUrl) {
      return (
        <div className={embedded ? 'px-3 py-3' : 'px-3 py-3'}>
          {exerciseMetaLine ? (
            <div className="text-xs font-semibold text-black/60">{exerciseMetaLine}</div>
          ) : null}
          {trimmedNotes ? (
            <div className="mt-2 inline-flex items-start gap-2 rounded-xl bg-[#f5f5f5] px-2.5 py-2 text-xs text-black/70">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
                <IconNote size={12} className="text-white" />
              </span>
              <span className="min-w-0">{trimmedNotes}</span>
            </div>
          ) : null}
          {!embedded ? (
            <button type="button" onClick={onToggle} className="mt-3 text-xs font-semibold text-[var(--brand)]">
              Fermer
            </button>
          ) : null}
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={onToggle}
        className="relative block w-full overflow-hidden"
        aria-label={embedded ? 'Fermer la démo' : 'Fermer l\'exercice'}
      >
        <img
          src={demoMediaUrl}
          alt={displayName}
          className={previewDemoImageClassName(mediaPath, embedded)}
          loading="lazy"
        />
        {exerciseHref ? (
          <Link
            href={exerciseHref}
            onClick={(e) => e.stopPropagation()}
            prefetch
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-md ring-1 ring-black/10"
            aria-label="Voir la fiche de l'exercice"
          >
            <IconOpen size={18} className="text-white" />
          </Link>
        ) : null}
        {exerciseMetaLine || trimmedNotes ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div
              className="pointer-events-auto px-3 pb-3 pt-2"
              style={{
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.55) 58%, rgba(0,0,0,0.0) 100%)',
              }}
            >
              <div className="grid gap-2">
                {exerciseMetaLine ? (
                  <div className="inline-flex items-center gap-2 text-sm text-white/90">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
                      <IconStats size={14} className="text-white" />
                    </span>
                    <span className="min-w-0 flex-1">{exerciseMetaLine}</span>
                  </div>
                ) : null}
                {trimmedNotes ? (
                  <div className="inline-flex items-start gap-2 rounded-xl bg-white/10 px-2.5 py-2 text-sm text-white/95 backdrop-blur">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                      <IconNote size={14} className="text-white" />
                    </span>
                    <span className="min-w-0">{trimmedNotes}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </button>
    )
  }

  if (embedded) {
    if (!isOpen) return null
    return <div className="border-t border-black/5 bg-[#fafafa]">{renderExpandedDemo()}</div>
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
      {!isOpen ? (
        <button type="button" onClick={onToggle} className="w-full text-left" aria-label={`Ouvrir ${displayName}`}>
          <div className="border-b border-black/5 bg-[#fafafa] px-3 py-2">
            <span className="truncate text-sm font-extrabold text-[var(--brand)]">{displayName}</span>
          </div>
          <div className="px-3 py-3">
            {exerciseMetaLine ? (
              <p className="text-xs font-semibold text-black/55 line-clamp-2">{exerciseMetaLine}</p>
            ) : (
              <p className="text-xs font-semibold text-black/40">Appuyer pour voir le détail</p>
            )}
          </div>
        </button>
      ) : (
        <div>
          <button
            type="button"
            onClick={onToggle}
            className="w-full border-b border-black/5 bg-[#fafafa] px-3 py-2 text-left"
            aria-label="Fermer l'exercice"
          >
            <span className="truncate text-sm font-extrabold text-[var(--brand)]">{displayName}</span>
          </button>
          {renderExpandedDemo()}
        </div>
      )}
    </div>
  )
}
