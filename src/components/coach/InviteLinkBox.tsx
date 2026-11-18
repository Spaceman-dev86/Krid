'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'

export function InviteLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-4 py-3">
      <p className="text-sm font-extrabold text-[color:var(--fg)]">Lien prêt · 30 jours</p>
      <p className="mt-1 break-all font-mono text-xs text-[color:var(--muted)]">{url}</p>
      <Button
        type="button"
        size="sm"
        className="mt-3 !rounded-lg !px-3 !py-1.5 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? 'Copié' : 'Copier le lien'}
      </Button>
    </div>
  )
}
