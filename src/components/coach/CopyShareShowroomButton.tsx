'use client'

import { useState } from 'react'

export function CopyShareShowroomButton({
  message,
  showroomUrl,
}: {
  message: string
  showroomUrl: string
}) {
  const [copied, setCopied] = useState(false)
  const text = [message.trim(), showroomUrl].filter(Boolean).join('\n\n')

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
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
      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[color:var(--brand)] hover:bg-[var(--accent)]"
    >
      {copied ? 'Copié' : 'Copier message + lien'}
    </button>
  )
}
