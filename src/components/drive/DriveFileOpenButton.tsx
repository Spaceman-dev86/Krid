'use client'

import { useState, useTransition } from 'react'

import { getDriveFileSignedUrlAction } from '@/src/app/drive/actions'
import { Button } from '@/src/components/ui'
import { isPreviewableMime } from '@/src/lib/drive/drive'

type Props = {
  fileId: string
  mimeType: string | null
  fileName: string
}

export function DriveFileOpenButton({ fileId, mimeType, fileName }: Props) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const canPreview = isPreviewableMime(mimeType, fileName)

  function open(mode: 'view' | 'download') {
    setError(null)
    startTransition(async () => {
      const res = await getDriveFileSignedUrlAction(fileId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      if (mode === 'download') {
        const a = document.createElement('a')
        a.href = res.url
        a.download = res.name
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        return
      }
      window.open(res.url, '_blank', 'noopener,noreferrer')
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {canPreview ? (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => open('view')}>
            {pending ? '…' : 'Ouvrir'}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => open('download')}>
          {pending ? '…' : 'Télécharger'}
        </Button>
      </div>
      {error ? <p className="text-[11px] font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
