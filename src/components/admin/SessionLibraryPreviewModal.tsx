'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { isPngOrGifMedia } from '@/src/lib/exerciseMedia'
import type { SessionLibraryPreviewPayload } from '@/src/lib/sessions/fetchSessionLibraryPreview'
import { Button, IconClose, IconOpen, IconPlus, IconRest } from '@/src/components/ui'

export type CatalogPreviewKind = 'session' | 'block' | 'exercise'

export type CatalogPreviewTarget = {
  kind: CatalogPreviewKind
  id: string
  /** Nom déjà connu dans la liste — affiché tout de suite pendant le fetch. */
  nameHint?: string | null
} | null

type BlockPreview = {
  id: string
  name: string
  status: string
  notes: string | null
  timerSummary: string | null
  expectedResultLabel: string | null
  sportLabel: string | null
  exercises: { id: string; name: string; rxLines: string[] }[]
}

type ExercisePreview = {
  id: string
  name: string
  status: string | null
  description: string | null
  muscleGroup: string | null
  difficulty: string | null
  namedNotes: { title: string; body: string }[]
  sportLabel: string | null
  typeLabel: string | null
  demoMediaPath?: string | null
  demoMediaUrl?: string | null
  videoUrl?: string | null
}

type PreviewPayload = SessionLibraryPreviewPayload | BlockPreview | ExercisePreview

const previewCache = new Map<string, PreviewPayload>()
const previewInflight = new Map<string, Promise<PreviewPayload | null>>()

function previewCacheKey(kind: CatalogPreviewKind, id: string) {
  return `${kind}:${id}`
}

function previewUrl(kind: CatalogPreviewKind, id: string) {
  if (kind === 'session') return `/api/admin/session-library/${id}/preview`
  if (kind === 'block') return `/api/admin/blocks/${id}/preview`
  return `/api/admin/exercises/${id}/preview`
}

/** Charge (ou rejoint) l’aperçu — partagé entre survol, pointerdown et ouverture modale. */
export function loadCatalogPreview(
  kind: CatalogPreviewKind,
  id: string,
): Promise<PreviewPayload | null> {
  const key = previewCacheKey(kind, id)
  const cached = previewCache.get(key)
  if (cached) return Promise.resolve(cached)
  const inflight = previewInflight.get(key)
  if (inflight) return inflight

  const promise = fetch(previewUrl(kind, id))
    .then(async (res) => {
      const json = (await res.json().catch(() => ({}))) as {
        preview?: PreviewPayload
        error?: string
      }
      if (!res.ok || !json.preview) {
        throw new Error(json.error || 'Impossible de charger l’aperçu')
      }
      previewCache.set(key, json.preview)
      return json.preview
    })
    .finally(() => {
      previewInflight.delete(key)
    })

  previewInflight.set(key, promise)
  return promise
}

/** Prefetch au survol / pointerdown du « i » pour ouvrir l’aperçu plus vite. */
export function prefetchCatalogPreview(kind: CatalogPreviewKind, id: string) {
  void loadCatalogPreview(kind, id).catch(() => {})
}

/** Prefetch des premiers items visibles (catalogue ouvert). */
export function prefetchCatalogPreviewBatch(
  kind: CatalogPreviewKind,
  ids: string[],
  limit = 8,
) {
  for (const id of ids.slice(0, limit)) prefetchCatalogPreview(kind, id)
}

function isDirectVideoUrl(url: string) {
  const path = url.split('?')[0] ?? url
  return /\.(mp4|webm|ogg)$/i.test(path)
}

function ficheHref(kind: 'session' | 'block' | 'exercise', id: string) {
  if (kind === 'session') return `/admin/sessions/${id}/edit`
  if (kind === 'block') return `/admin/blocks/${id}/edit`
  return `/admin/exercises/${id}/edit`
}

function ficheLabel(kind: 'session' | 'block' | 'exercise') {
  if (kind === 'session') return 'Ouvrir la fiche séance'
  if (kind === 'block') return 'Ouvrir la fiche bloc'
  return 'Ouvrir la fiche exercice'
}

function kindEyebrow(kind: 'session' | 'block' | 'exercise') {
  if (kind === 'session') return 'Séance catalogue'
  if (kind === 'block') return 'Bloc catalogue'
  return 'Exercice catalogue'
}

function MetaLine({ bits }: { bits: (string | null | undefined)[] }) {
  const clean = bits.map((b) => String(b ?? '').trim()).filter(Boolean)
  if (!clean.length) return null
  return (
    <p className="mt-0.5 text-[11px] font-semibold text-[color:var(--muted)]">
      {clean.join(' · ')}
    </p>
  )
}

function SessionBody({ preview }: { preview: SessionLibraryPreviewPayload }) {
  if (!preview.slots.length) {
    return (
      <p className="py-8 text-center text-[13px] text-[color:var(--muted)]">
        Aucun item dans cette séance.
      </p>
    )
  }
  return (
    <ul className="grid gap-2">
      {preview.slots.map((slot) => {
        if (slot.kind === 'rest') {
          return (
            <li
              key={slot.id}
              className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[color:var(--brand)]">
                <IconRest size={12} />
              </span>
              <span className="text-[12px] font-semibold text-[color:var(--fg)]">
                Pause {slot.restSeconds}s
              </span>
            </li>
          )
        }
        if (slot.kind === 'exercise') {
          const ex = slot.exercise
          const rx = [
            ex.sets ? `${ex.sets} sér.` : null,
            ex.reps ? `${ex.reps} reps` : null,
            ex.loadText ? `Kg ${ex.loadText}` : null,
            ex.rpe ? `RPE ${ex.rpe}` : null,
            ex.restSeconds != null ? `repos ${ex.restSeconds}s` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li
              key={slot.id}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <p className="text-[13px] font-bold text-[color:var(--fg)]">{ex.name}</p>
              {rx ? (
                <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{rx}</p>
              ) : null}
              {ex.notes?.trim() ? (
                <p className="mt-1 text-[11px] text-[color:var(--muted)]">{ex.notes}</p>
              ) : null}
            </li>
          )
        }
        return (
          <li
            key={slot.id}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
          >
            <p className="text-[13px] font-bold text-[color:var(--fg)]">{slot.title}</p>
            {slot.notes?.trim() ? (
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{slot.notes}</p>
            ) : null}
            <ul className="mt-2 space-y-1.5 border-t border-[var(--border)] pt-2">
              {slot.exercises.map((ex) => {
                const rx = [
                  ex.sets ? `${ex.sets} sér.` : null,
                  ex.reps ? `${ex.reps} reps` : null,
                  ex.loadText ? `Kg ${ex.loadText}` : null,
                  ex.rpe ? `RPE ${ex.rpe}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
                return (
                  <li key={ex.id} className="pl-1">
                    <p className="text-[12px] font-semibold text-[color:var(--fg)]">{ex.name}</p>
                    {rx ? (
                      <p className="text-[11px] text-[color:var(--muted)]">{rx}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

function BlockBody({ preview }: { preview: BlockPreview }) {
  return (
    <div className="grid gap-3">
      <MetaLine
        bits={[preview.sportLabel, preview.timerSummary, preview.expectedResultLabel]}
      />
      {preview.notes?.trim() ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-[12px] text-[color:var(--fg)]">
          {preview.notes}
        </p>
      ) : null}
      {preview.exercises.length ? (
        <ul className="grid gap-1.5">
          {preview.exercises.map((ex, i) => (
            <li
              key={`${ex.id}-${i}`}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <p className="text-[13px] font-bold text-[color:var(--fg)]">{ex.name}</p>
              {ex.rxLines.length ? (
                <ul className="mt-1 space-y-0.5">
                  {ex.rxLines.map((line) => (
                    <li key={line} className="text-[11px] text-[color:var(--muted)]">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[13px] text-[color:var(--muted)]">Aucun exercice.</p>
      )}
    </div>
  )
}

function ExerciseBody({ preview }: { preview: ExercisePreview }) {
  const notes = Array.isArray(preview.namedNotes) ? preview.namedNotes : []
  const description = String(preview.description ?? '').trim()
  const demoUrl = String(preview.demoMediaUrl ?? '').trim()
  const videoUrl = String(preview.videoUrl ?? '').trim()
  const mediaRef = preview.demoMediaPath ?? demoUrl
  const gifLike = isPngOrGifMedia(mediaRef)
  const hasMedia = Boolean(demoUrl || videoUrl)

  return (
    <div className="grid gap-3">
      {demoUrl ? (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={demoUrl}
            alt={preview.name}
            className={
              gifLike
                ? 'mx-auto max-h-56 w-full object-contain'
                : 'max-h-56 w-full object-cover'
            }
            loading="lazy"
          />
        </div>
      ) : null}
      {videoUrl ? (
        isDirectVideoUrl(videoUrl) ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="max-h-56 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-black object-contain"
          />
        ) : (
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5 text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--accent)]"
          >
            Ouvrir la vidéo
          </a>
        )
      ) : null}
      <MetaLine bits={[preview.sportLabel, preview.typeLabel, preview.muscleGroup, preview.difficulty]} />
      {description ? (
        <p className="text-[13px] leading-relaxed text-[color:var(--fg)]">{description}</p>
      ) : null}
      {notes.length ? (
        <ul className="grid gap-1.5">
          {notes.map((n, i) => (
            <li
              key={`${n.title}-${i}`}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2"
            >
              {n.title ? (
                <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  {n.title}
                </p>
              ) : (
                <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  Note
                </p>
              )}
              {n.body ? (
                <p className="mt-1 text-[12px] text-[color:var(--fg)]">{n.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {!hasMedia && !description && !notes.length ? (
        <p className="py-6 text-center text-[13px] text-[color:var(--muted)]">
          Pas de détails supplémentaires.
        </p>
      ) : null}
    </div>
  )
}

export function CatalogLibraryPreviewModal({
  target,
  onClose,
  onInsert,
  insertLabel,
  insertDisabled,
}: {
  target: CatalogPreviewTarget
  onClose: () => void
  onInsert?: () => void
  insertLabel?: string | null
  insertDisabled?: boolean
}) {
  const [sessionPreview, setSessionPreview] = useState<SessionLibraryPreviewPayload | null>(null)
  const [blockPreview, setBlockPreview] = useState<BlockPreview | null>(null)
  const [exercisePreview, setExercisePreview] = useState<ExercisePreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const backdropMouseDownRef = useRef(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!target) {
      setSessionPreview(null)
      setBlockPreview(null)
      setExercisePreview(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setError(null)

    const key = previewCacheKey(target.kind, target.id)
    const cached = previewCache.get(key)
    if (cached) {
      if (target.kind === 'session') setSessionPreview(cached as SessionLibraryPreviewPayload)
      else if (target.kind === 'block') setBlockPreview(cached as BlockPreview)
      else setExercisePreview(cached as ExercisePreview)
      setLoading(false)
      return
    }

    setLoading(true)
    setSessionPreview(null)
    setBlockPreview(null)
    setExercisePreview(null)

    void loadCatalogPreview(target.kind, target.id)
      .then((preview) => {
        if (cancelled || !preview) return
        if (target.kind === 'session') {
          setSessionPreview(preview as SessionLibraryPreviewPayload)
        } else if (target.kind === 'block') {
          setBlockPreview(preview as BlockPreview)
        } else {
          setExercisePreview(preview as ExercisePreview)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Impossible de charger l’aperçu')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [target])

  useEffect(() => {
    if (!target) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, onClose])

  if (!target || !mounted) return null

  const title =
    (target.kind === 'session' ? sessionPreview?.name : null) ||
    (target.kind === 'block' ? blockPreview?.name : null) ||
    (target.kind === 'exercise' ? exercisePreview?.name : null) ||
    target.nameHint?.trim() ||
    (loading ? 'Chargement…' : 'Aperçu')

  const subtitleNotes = target.kind === 'session' ? sessionPreview?.notes : null

  return createPortal(
    <div
      className="da-vv-overlay z-[9999] flex items-center justify-center bg-black/55 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Aperçu ${kindEyebrow(target.kind)}`}
      data-builder-chrome=""
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation()
        backdropMouseDownRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose()
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="da-vv-dialog flex w-full max-w-md flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              {kindEyebrow(target.kind)} · lecture seule
            </p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <h2 className="min-w-0 truncate text-base font-bold text-[color:var(--fg)]">
                {title}
              </h2>
              <Link
                href={ficheHref(target.kind, target.id)}
                target="_blank"
                rel="noreferrer"
                title={ficheLabel(target.kind)}
                aria-label={ficheLabel(target.kind)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] transition hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                onClick={(e) => e.stopPropagation()}
              >
                <IconOpen size={14} />
              </Link>
            </div>
            {subtitleNotes?.trim() ? (
              <p className="mt-0.5 line-clamp-2 text-[12px] text-[color:var(--muted)]">
                {subtitleNotes}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[color:var(--muted)] hover:text-[color:var(--fg)]"
            aria-label="Fermer"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="da-scrollbar flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="py-10 text-center text-[13px] text-[color:var(--muted)]">Chargement…</p>
          ) : error ? (
            <p className="py-10 text-center text-[13px] font-semibold text-[var(--danger)]">{error}</p>
          ) : target.kind === 'session' && sessionPreview ? (
            <SessionBody preview={sessionPreview} />
          ) : target.kind === 'block' && blockPreview ? (
            <BlockBody preview={blockPreview} />
          ) : target.kind === 'exercise' && exercisePreview ? (
            <ExerciseBody preview={exercisePreview} />
          ) : (
            <p className="py-10 text-center text-[13px] text-[color:var(--muted)]">Vide.</p>
          )}
        </div>

        {onInsert ? (
          <div className="border-t border-[var(--border)] px-3 py-2.5">
            <Button
              type="button"
              className="!h-9 w-full !rounded-full !text-[13px]"
              disabled={insertDisabled || loading || Boolean(error)}
              onClick={() => {
                onInsert()
                onClose()
              }}
            >
              <IconPlus size={14} />
              {insertLabel ? `Insérer → ${insertLabel}` : 'Insérer dans le programme'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/** Compat palette séances (session-only). */
export function SessionLibraryPreviewModal({
  sessionId,
  nameHint,
  onClose,
  onInsert,
  insertLabel,
  insertDisabled,
}: {
  sessionId: string | null
  nameHint?: string | null
  onClose: () => void
  onInsert?: () => void
  insertLabel?: string | null
  insertDisabled?: boolean
}) {
  return (
    <CatalogLibraryPreviewModal
      target={sessionId ? { kind: 'session', id: sessionId, nameHint } : null}
      onClose={onClose}
      onInsert={onInsert}
      insertLabel={insertLabel}
      insertDisabled={insertDisabled}
    />
  )
}
