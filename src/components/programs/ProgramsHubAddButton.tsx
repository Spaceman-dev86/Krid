'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

import IconButton from '@/src/components/ui/IconButton'
import { IconPlus } from '@/src/components/ui/icons'
import { CreateCoachProgramDialogTrigger } from '@/src/components/programs/CreateCoachProgramDialog'

function AddInner() {
  const pathname = usePathname() || '/programs'
  const searchParams = useSearchParams()
  const isSessions = pathname.startsWith('/programs/sessions')
  const autoCreate = searchParams.get('create') === '1'

  if (isSessions) {
    return (
      <IconButton href="/programs/sessions/new" label="Nouvelle séance" tone="solid" size="sm">
        <IconPlus size={18} />
      </IconButton>
    )
  }

  return <CreateCoachProgramDialogTrigger autoOpen={autoCreate} />
}

export function ProgramsHubAddButton() {
  return (
    <Suspense
      fallback={
        <IconButton href="/programs/brouillon?create=1" label="Nouveau programme" tone="solid" size="sm">
          <IconPlus size={18} />
        </IconButton>
      }
    >
      <AddInner />
    </Suspense>
  )
}
