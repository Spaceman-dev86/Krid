'use client'

import { useEffect, useRef, useState, useTransition, type ChangeEvent } from 'react'

import { saveCoachLogoAction } from '../../app/home/actions'

export function CoachBrandingLogoField({
  logoUrl,
  appName,
  primaryColor,
}: {
  logoUrl: string | null
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
    fd.set('logo', file)
    startTransition(() => {
      void saveCoachLogoAction(fd)
    })
  }

  const display = localPreview ?? logoUrl

  return (
    <div className="grid gap-2 text-sm sm:col-span-2">
      <span className="font-semibold">Logo</span>
      <div className="flex flex-wrap items-center gap-4">
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt=""
            className="h-14 w-14 rounded-full border border-[var(--border)] bg-[var(--surface)] object-cover"
          />
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
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
          {logoUrl && !pending ? (
            <button
              type="submit"
              form="clear-coach-logo"
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
            >
              Supprimer le logo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
