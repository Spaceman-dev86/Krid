'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState, type ComponentProps, type ReactNode } from 'react'

import {
  flushProgramEditorPersistence,
  hasPendingProgramEditorPersistence,
} from '../../../persistence/startProgramEditorPersistence'

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onClick'> & {
  href: string
  children: ReactNode
  onNavigate?: () => void
}

/** Navigue après avoir vidé la file de persistance (aperçu, retour, etc.). */
export default function ProgramEditorFlushLink({ href, children, onNavigate, ...rest }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const onClick = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (busy) {
        event.preventDefault()
        return
      }
      if (!hasPendingProgramEditorPersistence()) {
        onNavigate?.()
        return
      }

      event.preventDefault()
      setBusy(true)
      try {
        await flushProgramEditorPersistence()
        onNavigate?.()
        router.push(href)
      } catch {
        setBusy(false)
      }
    },
    [busy, href, onNavigate, router]
  )

  return (
    <Link href={href} onClick={onClick} aria-busy={busy || undefined} {...rest}>
      {children}
    </Link>
  )
}
