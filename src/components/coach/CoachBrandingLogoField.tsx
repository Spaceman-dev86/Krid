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
    <div className="grid gap-1.5 text-sm">
      <span className="text-xs font-semibold text-[color:var(--fg)]">Logo de l’app</span>
      <div className="flex flex-wrap items-center gap-3">
        {display ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt=""
            className="h-11 w-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] object-cover"
          />
        ) : (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
            style={{ background: primaryColor, color: '#fff' }}
          >
            {appName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            disabled={pending}
            className="block w-full text-xs text-[color:var(--muted)] file:mr-2 file:rounded-md file:border-0 file:bg-[var(--accent)] file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-[color:var(--brand)] disabled:opacity-60"
          />
          <p className="text-[10px] text-[color:var(--muted)]">
            Portail · showroom
            {pending ? ' · enregistrement…' : localPreview ? ' · sauvegarde auto' : ''}
            {logoUrl && !pending ? (
              <>
                {' · '}
                <button
                  type="submit"
                  form="clear-coach-logo"
                  className="font-semibold text-red-700 hover:underline"
                >
                  Supprimer
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  )
}
