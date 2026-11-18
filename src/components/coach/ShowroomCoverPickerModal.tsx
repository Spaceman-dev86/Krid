'use client'

import type { MediaLibraryCover } from '@/src/lib/mediaLibrary'

type Props = {
  open: boolean
  covers: MediaLibraryCover[]
  pending?: boolean
  title?: string
  uploadLabel?: string
  onClose: () => void
  onPickLibrary: (cover: MediaLibraryCover) => void
  onPickUpload: () => void
}

/** Choix image : banque Trainly ou import fichier (cover showroom / photo presta). */
export function ShowroomCoverPickerModal({
  open,
  covers,
  pending = false,
  title = 'Changer cover',
  uploadLabel = 'Importer mon image…',
  onClose,
  onPickLibrary,
  onPickUpload,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-md"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <p className="text-sm font-extrabold text-[color:var(--fg)]">{title}</p>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-sm font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)] disabled:opacity-50"
          >
            Fermer
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          <button
            type="button"
            disabled={pending}
            onClick={onPickUpload}
            className="mb-4 w-full rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-sm font-bold text-[color:var(--brand)] hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {uploadLabel}
          </button>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Banque Trainly
          </p>
          {!covers.length ? (
            <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[color:var(--muted)]">
              Aucune image catalogue pour l’instant.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {covers.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onPickLibrary(c)}
                    className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-[var(--border)] transition hover:ring-[var(--brand)] disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.publicUrl}
                      alt={c.label ?? ''}
                      className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                    {c.label ? (
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 text-left text-[10px] font-semibold text-white">
                        {c.label}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
