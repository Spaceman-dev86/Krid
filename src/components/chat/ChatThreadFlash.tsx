'use client'

import { useState } from 'react'

import { EphemeralFlash, type FlashItem } from '@/src/components/ui'

export function ChatThreadFlash({
  error,
  cleared,
}: {
  error?: string | null
  cleared?: boolean
}) {
  // Figé au premier rendu client (avant nettoyage URL par EphemeralFlash)
  const [items] = useState<FlashItem[]>(() => {
    let err = error || null
    let clearedFlag = Boolean(cleared)
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href)
        if (url.searchParams.get('ok') === 'cleared') clearedFlag = true
        const qErr = url.searchParams.get('error')
        if (qErr) err = qErr
      } catch {
        // ignore
      }
    }
    const list: FlashItem[] = []
    if (err) list.push({ id: 'error', tone: 'danger', message: err })
    if (clearedFlag) {
      list.push({ id: 'cleared', tone: 'success', message: 'Historique effacé.' })
    }
    return list
  })

  if (!items.length) return null

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <EphemeralFlash items={items} />
    </div>
  )
}
