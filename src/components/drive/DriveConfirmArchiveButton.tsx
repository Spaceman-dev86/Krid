'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  label?: string
}

export function DriveConfirmArchiveButton({ label = 'Archiver' }: Props) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-semibold text-[var(--danger)] hover:underline disabled:opacity-60"
      onClick={(e) => {
        if (!window.confirm('Archiver cet élément ? Il disparaîtra de la liste (contenu inclus pour un dossier).')) {
          e.preventDefault()
        }
      }}
    >
      {pending ? 'Archivage…' : label}
    </button>
  )
}
