'use client'

import { useEffect, useState } from 'react'

export function CopyCreatedLinkEffect({ url, code }: { url: string; code: string }) {
  const [status, setStatus] = useState<'pending' | 'ok' | 'fail'>('pending')

  useEffect(() => {
    let cancelled = false
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        if (!cancelled) setStatus('ok')
      })
      .catch(() => {
        if (!cancelled) setStatus('fail')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      Lien créé · <strong className="font-mono">{code}</strong>
      {status === 'ok' ? <span className="ml-1">· copié dans le presse-papiers</span> : null}
      {status === 'fail' ? (
        <span className="ml-1 text-amber-800">· copie auto impossible, utilise Copier URL</span>
      ) : null}
    </div>
  )
}
