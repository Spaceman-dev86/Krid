'use client'

import { useEffect, useId, useRef, useState } from 'react'

import { createFolderAction } from '@/src/app/drive/actions'
import { DrivePendingSubmit } from '@/src/components/drive/DrivePendingSubmit'
import { IconButton, IconClose, IconPlus, daFieldClass } from '@/src/components/ui'

type Props = {
  folderId: string | null
}

export function DriveAddPopup({ folderId }: Props) {
  const titleId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  function close() {
    setOpen(false)
    setPicked([])
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function onPick(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const list = Array.from(files)
    const tooHeavy = list.find((f) => f.size > 200 * 1024 * 1024)
    if (tooHeavy) {
      setError(`« ${tooHeavy.name} » dépasse 200 Mo`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setPicked(list)
  }

  return (
    <>
      <IconButton
        type="button"
        label="Nouveau dossier"
        tone="solid"
        size="md"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={20} />
      </IconButton>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
        >
          <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Fermer" onClick={close} />
          <div className="relative z-[1] w-full max-w-md rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Nouveau dossier
              </p>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                aria-label="Fermer"
              >
                <IconClose size={16} />
              </button>
            </div>

            <form action={createFolderAction} className="grid gap-3">
              {folderId ? <input type="hidden" name="parent_id" value={folderId} /> : null}
              <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
                Nom
                <input name="name" required autoFocus placeholder="Nom du dossier" className={daFieldClass} />
              </label>

              <div className="grid gap-1">
                <p className="text-xs font-semibold text-[color:var(--fg)]">Fichiers dans ce dossier (optionnel)</p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] px-4 py-6 text-center">
                  <span className="text-sm font-bold text-[color:var(--fg)]">
                    {picked.length
                      ? `${picked.length} fichier${picked.length > 1 ? 's' : ''} sélectionné${picked.length > 1 ? 's' : ''}`
                      : 'Choisir des fichiers'}
                  </span>
                  <span className="text-xs text-[color:var(--muted)]">PDF, images, MP4 · max 200 Mo</span>
                  <input
                    ref={fileRef}
                    type="file"
                    name="file"
                    multiple
                    accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,video/mp4,video/quicktime,.doc,.docx"
                    className="sr-only"
                    onChange={(e) => onPick(e.target.files)}
                  />
                </label>
                {picked.length ? (
                  <ul className="max-h-24 overflow-auto text-[11px] text-[color:var(--muted)]">
                    {picked.map((f) => (
                      <li key={`${f.name}-${f.size}`} className="truncate">
                        {f.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {error ? <p className="text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
              </div>

              <DrivePendingSubmit
                idle="Créer"
                pending="Création…"
                className="rounded-xl bg-[var(--brand)] px-4 py-2 text-xs font-bold text-[var(--brand-fg)]"
              />
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
