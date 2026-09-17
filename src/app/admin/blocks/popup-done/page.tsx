import { Suspense } from 'react'

import { BlockPopupDoneClient } from './BlockPopupDoneClient'

export default function BlockPopupDonePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="text-sm text-[color:var(--muted)]">Rattachement…</p>
        </main>
      }
    >
      <BlockPopupDoneClient />
    </Suspense>
  )
}
