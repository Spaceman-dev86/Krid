'use client'

import { useState } from 'react'

import { Button } from '@/src/components/ui'

export function InviteLinkBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      <p className="font-semibold">Lien d’invitation (14 jours)</p>
      <p className="mt-1 break-all font-mono text-xs">{url}</p>
      <Button
        type="button"
        size="sm"
        className="mt-2 !rounded-lg !px-3 !py-1.5 text-xs"
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