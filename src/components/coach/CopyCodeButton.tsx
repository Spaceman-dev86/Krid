'use client'

import { useState } from 'react'

export function CopyCodeButton({
  code,
  label = 'Copier',
}: {
  code: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)]"
    >
      {copied ? 'Copié' : label}
    </button>
  )
}
