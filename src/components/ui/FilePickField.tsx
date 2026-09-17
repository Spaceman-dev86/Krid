'use client'

import { useId, useState } from 'react'

type Props = {
  name?: string
  accept?: string
  required?: boolean
  label?: string
  hint?: string
}

/** Champ fichier visible (le `<input type="file">` natif est trop discret sous Windows). */
export function FilePickField({
  name = 'file',
  accept,
  required,
  label = 'Choisir un fichier depuis mon ordinateur',
  hint,
}: Props) {
  const id = useId()
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <div className="grid gap-2">
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          setFileName(f?.name ?? null)
        }}
      />
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-[color-mix(in_srgb,var(--brand)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] px-4 py-6 text-center transition hover:bg-[color-mix(in_srgb,var(--brand)_14%,var(--surface))]"
      >
        <span className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-bold text-[var(--brand-fg)]">
          {label}
        </span>
        <span className="text-xs text-[color:var(--muted)]">
          {fileName ? (
            <span className="font-semibold text-[color:var(--fg)]">Sélectionné : {fileName}</span>
          ) : (
            hint || 'Clique pour ouvrir l’explorateur de fichiers'
          )}
        </span>
      </label>
    </div>
  )
}
