'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

/** Bridge popup → fenêtre séance (postMessage puis close). */
export function BlockPopupDoneClient() {
  const params = useSearchParams()
  const attachBlock = params.get('attachBlock')?.trim() ?? ''
  const name = params.get('name')?.trim() || 'Bloc'

  useEffect(() => {
    if (attachBlock && typeof window !== 'undefined' && window.opener) {
      window.opener.postMessage(
        {
          type: 'trainly:session-attach-block',
          blockId: attachBlock,
          name,
          status: 'draft',
        },
        window.location.origin,
      )
    }
    window.setTimeout(() => {
      try {
        window.close()
      } catch {
        /* ignore */
      }
    }, 120)
  }, [attachBlock, name])

  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-sm font-semibold text-[color:var(--fg)]">Bloc rattaché à la séance.</p>
      <p className="mt-1 text-[12px] text-[color:var(--muted)]">Cette fenêtre va se fermer…</p>
    </main>
  )
}
