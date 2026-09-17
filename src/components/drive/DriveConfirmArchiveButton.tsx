'use client'

type Props = {
  label?: string
}

export function DriveConfirmArchiveButton({ label = 'Archiver' }: Props) {
  return (
    <button
      type="submit"
      className="text-xs font-semibold text-red-700 hover:underline"
      onClick={(e) => {
        if (!window.confirm('Archiver cet élément ? Il disparaîtra de la liste.')) {
          e.preventDefault()
        }
      }}
    >
      {label}
    </button>
  )
}
