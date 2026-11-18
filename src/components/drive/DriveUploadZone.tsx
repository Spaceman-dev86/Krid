'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { uploadFileAction } from '../../app/drive/actions'
import { useOptionalDriveFeedback } from '@/src/components/drive/DriveFeedbackContext'

type Props = {
  folderId: string | null
}

export function DriveUploadZone({ folderId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const feedback = useOptionalDriveFeedback()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  function onPick(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    const list = Array.from(files)
    const tooHeavy = list.find((f) => f.size > 200 * 1024 * 1024)
    if (tooHeavy) {
      setError(`« ${tooHeavy.name} » dépasse 200 Mo`)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    setHint(
      list.length === 1
        ? `Import de « ${list[0].name} »…`
        : `Import de ${list.length} fichiers…`,
    )

    const fd = new FormData()
    if (folderId) fd.set('folder_id', folderId)
    for (const f of list) fd.append('file', f)

    const run = async () => {
      const res = await uploadFileAction(fd)
      if (!res.ok) {
        setError(res.error)
        setHint(null)
        if (inputRef.current) inputRef.current.value = ''
        return res
      }
      setHint(null)
      if (inputRef.current) inputRef.current.value = ''
      return res
    }

    if (feedback) {
      feedback.runQuiet(run, 'Fichiers ajoutés')
    } else {
      startTransition(async () => {
        const res = await run()
        if (res.ok) router.refresh()
      })
    }
  }

  const busy = pending

  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-dashed p-3 sm:p-4 ${
        dragOver
          ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--surface))]'
          : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        onPick(e.dataTransfer.files)
      }}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
        Ajouter des fichiers
      </p>
      <label
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-4 py-6 text-center transition hover:border-[color-mix(in_srgb,var(--brand)_40%,var(--border))] ${
          busy ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <span className="text-sm font-bold text-[color:var(--fg)]">
          {busy ? 'Upload en cours…' : 'Choisir ou déposer des fichiers'}
        </span>
        <span className="text-xs text-[color:var(--muted)]">
          PDF, images, MP4 · max 200 Mo · dans ce dossier
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,video/mp4,video/quicktime,.doc,.docx"
          className="sr-only"
          disabled={busy}
          onChange={(e) => onPick(e.target.files)}
        />
      </label>
      {hint && busy ? (
        <p className="mt-2 text-xs font-semibold text-[var(--brand)]">{hint}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
