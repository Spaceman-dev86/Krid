'use client'

import { useState } from 'react'

/** Copie une liste d’emails (un par ligne) — pour coller dans une newsletter / BCC. */
export function CopyEmailsListButton({
  emails,
  label = 'Copier les emails',
  emptyLabel = 'Aucun email',
}: {
  emails: string[]
  label?: string
  emptyLabel?: string
}) {
  const [hint, setHint] = useState<string | null>(null)

  const unique = [
    ...new Set(
      emails
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && e.includes('@')),
    ),
  ].sort()

  async function onCopy() {
    if (!unique.length) {
      setHint(emptyLabel)
      window.setTimeout(() => setHint(null), 1800)
      return
    }
    try {
      await navigator.clipboard.writeText(unique.join('\n'))
      setHint(`${unique.length} email${unique.length > 1 ? 's' : ''} copié${unique.length > 1 ? 's' : ''}`)
      window.setTimeout(() => setHint(null), 2000)
    } catch {
      setHint('Copie impossible')
      window.setTimeout(() => setHint(null), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      disabled={!unique.length && !hint}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--brand)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      title={
        unique.length
          ? `Copier ${unique.length} email${unique.length > 1 ? 's' : ''} (un par ligne)`
          : emptyLabel
      }
    >
      {hint ?? `${label}${unique.length ? ` (${unique.length})` : ''}`}
    </button>
  )
}
