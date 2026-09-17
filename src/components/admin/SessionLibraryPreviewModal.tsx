'use client'

import { useEffect, useState } from 'react'

import type {
  LibraryPreviewExercise,
  SessionLibraryPreviewPayload,
} from '@/src/lib/sessions/fetchSessionLibraryPreview'
import PreviewBlockCard from '@/src/components/PreviewBlockCard'
import PreviewExerciseCard from '@/src/components/PreviewExerciseCard'
import { Button, IconClose, IconPlus, IconRest } from '@/src/components/ui'
import type { PreviewBlockExerciseRow, PreviewSessionBlockRow } from '@/src/lib/fetchProgramPreviewStructure'

function toBlockExercise(ex: LibraryPreviewExercise, index: number): PreviewBlockExerciseRow {
  return {
    id: ex.id,
    session_block_id: 'preview',
    position: index,
    exercise_id: ex.id,
    exercise_name: ex.name,
    sets: ex.sets,
    reps: ex.reps,
    rest_seconds: ex.restSeconds,
    load_text: ex.loadText,
    notes: ex.notes,
    demo_media_url: ex.demoMediaUrl,
    exercise_library: {
      name: ex.name,
      demo_media_path: ex.demoMediaPath,
    },
  }
}

function LibraryPreviewBody({ preview }: { preview: SessionLibraryPreviewPayload }) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (!preview.slots.length) {
    return <p className="text-sm text-black/50">Aucun exercice dans cette séance.</p>
  }

  return (
    <ul className="grid gap-3">
      {preview.slots.map((slot) => {
        if (slot.kind === 'rest') {
          return (
            <li key={slot.id}>
              <div className="flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/10">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f5f5] text-[var(--brand)]">
                  <IconRest size={14} />
                </span>
                <span className="text-xs font-extrabold text-black/70">Repos {slot.restSeconds}s</span>
              </div>
            </li>
          )
        }

        if (slot.kind === 'exercise') {
          const ex = slot.exercise
          const open = openKey === `ex:${ex.id}`
          return (
            <li key={slot.id}>
              <PreviewExerciseCard
                displayName={ex.name}
                sets={ex.sets}
                reps={ex.reps}
                restSeconds={ex.restSeconds}
                rpe={ex.rpe}
                tempo={ex.tempo}
                loadText={ex.loadText}
                notes={ex.notes}
                demoMediaUrl={ex.demoMediaUrl}
                demoMediaPath={ex.demoMediaPath}
                isOpen={open}
                onToggle={() => setOpenKey(open ? null : `ex:${ex.id}`)}
              />
            </li>
          )
        }

        const block: PreviewSessionBlockRow = {
          id: slot.id,
          program_session_id: preview.id,
          position: 0,
          type: 'block',
          title: slot.title,
          notes: slot.notes,
        }
        const exercises = slot.exercises.map(toBlockExercise)
        const openBlockId = openKey?.startsWith(`blk:${slot.id}:`)
          ? openKey.slice(`blk:${slot.id}:`.length)
          : null

        return (
          <li key={slot.id}>
            <PreviewBlockCard
              block={block}
              exercises={exercises}
              openBlockExerciseId={openBlockId}
              onToggleBlockExercise={(id) => {
                const key = `blk:${slot.id}:${id}`
                setOpenKey((prev) => (prev === key ? null : key))
              }}
            />
          </li>
        )
      })}
    </ul>
  )
}

export function SessionLibraryPreviewModal({
  sessionId,
  onClose,
  onInsert,
  insertLabel,
  insertDisabled,
}: {
  sessionId: string | null
  onClose: () => void
  onInsert?: () => void
  insertLabel?: string | null
  insertDisabled?: boolean
}) {
  const [preview, setPreview] = useState<SessionLibraryPreviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setPreview(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setPreview(null)
    void fetch(`/api/admin/session-library/${sessionId}/preview`)
      .then(async (res) => {
        const json = (await res.json().catch(() => ({}))) as {
          preview?: SessionLibraryPreviewPayload
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Impossible de charger la séance')
          return
        }
        setPreview(json.preview ?? null)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger la séance')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sessionId, onClose])

  if (!sessionId) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu séance"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,720px)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[#f4f4f5] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2 border-b border-black/10 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/45">Aperçu client</p>
            <h2 className="truncate text-base font-extrabold text-[var(--brand)]">
              {preview?.name?.trim() || (loading ? 'Chargement…' : 'Séance')}
            </h2>
            {preview?.notes?.trim() ? (
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-black/55">{preview.notes}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5 text-black/60 hover:bg-black/10"
            aria-label="Fermer"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <p className="py-10 text-center text-sm text-black/50">Chargement de la séance…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-red-600">{error}</p>
          ) : preview ? (
            <LibraryPreviewBody preview={preview} />
          ) : (
            <p className="py-10 text-center text-sm text-black/50">Séance vide.</p>
          )}
        </div>

        {onInsert ? (
          <div className="border-t border-black/10 bg-white px-3 py-2.5">
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
    </div>
  )
}
