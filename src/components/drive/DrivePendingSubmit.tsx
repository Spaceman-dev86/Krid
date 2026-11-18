'use client'

import { useFormStatus } from 'react-dom'

type Props = {
  idle: string
  pending: string
  className?: string
  title?: string
}

export function DrivePendingSubmit({ idle, pending, className, title }: Props) {
  const { pending: busy } = useFormStatus()
  return (
    <button type="submit" disabled={busy} title={title} className={className}>
      {busy ? pending : idle}
    </button>
  )
}
