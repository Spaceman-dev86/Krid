'use client'

import { useRef, useState, useTransition } from 'react'

import { uploadFileAction } from '../../app/drive/actions'

type Props = {
  folderId: string | null
}

export function DriveUploadZone({ folderId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)

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
        : `Import de ${list.length} fichiers…`
    )

    const fd = new FormData()
    if (folderId) fd.set('folder_id', folderId)
    for (const f of list) fd.append('file', f)

    startTransition(() => {
      void uploadFileAction(fd)
    })
  }

  return (
    <div className="rounded-2xl border border-dashed border-emerald-700/30 bg-emerald-50/40 p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-900/50">Ajouter des fichiers</p>
      <label
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-emerald-700/20 bg-white px-4 py-6 text-center transition hover:border-emerald-700/40 ${
          pending ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <span className="text-sm font-bold text-emerald-900">
          {pending ? 'Upload en cours…' : 'Choisir un ou plusieurs fichiers'}
        </span>
        <span className="text-xs text-black/45">
          Ils s’ajoutent tout seuls dans ce dossier · PDF, images, vidéo · max 200 Mo
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          disabled={pending}
          onChange={(e) => onPick(e.target.files)}
        />
      </label>
      {hint && pending ? <p className="mt-2 text-xs font-semibold text-emerald-800">{hint}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  )
}
