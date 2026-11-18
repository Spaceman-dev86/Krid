'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import type { DriveQuietResult } from '@/src/app/drive/actions'
import { useOptionalDriveFeedback } from '@/src/components/drive/DriveFeedbackContext'

/** Formulaire mutation Drive → quiet action + refresh / soft-flash. */
export function DriveQuietForm({
  action,
  successMsg,
  className,
  children,
  onSuccess,
}: {
  action: (fd: FormData) => Promise<DriveQuietResult>
  successMsg?: string
  className?: string
  children: ReactNode
  onSuccess?: () => void
}) {
  const feedback = useOptionalDriveFeedback()
  const router = useRouter()

  async function formAction(fd: FormData) {
    if (feedback) {
      await feedback.runQuiet(async () => {
        const res = await action(fd)
        if (res.ok) onSuccess?.()
        return res
      }, successMsg)
      return
    }
    const res = await action(fd)
    if (!res.ok) {
      if (typeof window !== 'undefined') window.alert(res.error)
      return
    }
    onSuccess?.()
    if (res.navigateTo != null) router.push(res.navigateTo || '/drive')
    else router.refresh()
  }

  return (
    <form action={formAction} className={className}>
      {children}
    </form>
  )
}
