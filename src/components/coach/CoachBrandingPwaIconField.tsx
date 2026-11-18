'use client'

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'

import { saveCoachPwaIconAction } from '../../app/home/actions'

export function CoachBrandingPwaIconField({
  pwaIconUrl,
  appName,
  primaryColor,
}: {
  pwaIconUrl: string | null
  appName: string
  primaryColor: string
}) {
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    if (!file) {
      setLocalPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setLocalPreview(url)

    const fd = new FormData()
    fd.set('return_to', '/profile/mon-app')
    fd.set('pwa_icon', file)
    startTransition(() => {
      void saveCoachPwaIconAction(fd)
    })
  }

  // Jamais le logo showroom ici — uniquement l’icône PWA dédiée
  const display = localPreview ?? pwaIconUrl ?? null

  return (
    <div className="grid gap-2 text-sm sm:col-span-2">
      <span className="font-semibold">Icône PWA (écran d’accueil)</span>
      <p className="text-[11px] text-[color:var(--muted)]">
        Indépendante du logo showroom. Si vide → lettre sur couleur (pas le logo showroom).
      </p>
      <p className="text-[11px] leading-relaxed text-[color:var(--muted)]">
        Conseil : image <strong className="font-semibold text-[color:var(--fg)]">carrée</strong> (ex.
        1024×1024), dessin simple, peu de petit texte — sinon iOS la réduit mal.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt=""
            className="h-14 w-14 rounded-[22%] border border-[var(--border)] bg-[var(--surface)] object-cover shadow-da-sm"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-[22%] text-lg font-bold text-[var(--brand-fg)] shadow-da-sm"
            style={{ background: primaryColor }}
          >
            {appName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            disabled={pending}
            className="block w-full text-sm text-[color:var(--muted)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[color:var(--brand)] disabled:opacity-60"
          />
          <p className="text-[11px] text-[color:var(--muted)]">
            JPG, PNG, WebP ou GIF · max 5 Mo
            {pending ? ' · enregistrement…' : localPreview ? ' · aperçu · sauvegarde auto' : ''}
          </p>
          {pwaIconUrl && !pending ? (
            <button
              type="submit"
              form="clear-coach-pwa-icon"
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Supprimer l’icône PWA
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
