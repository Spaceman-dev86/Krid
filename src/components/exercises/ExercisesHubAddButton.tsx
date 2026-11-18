'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'

import { IconButton, IconPlus } from '@/src/components/ui'

function AddInner() {
  const pathname = usePathname() || '/exercises'
  if (pathname.startsWith('/exercises/tags')) return null
  const isBlocks = pathname.startsWith('/exercises/blocks')
  return (
    <IconButton
      href={isBlocks ? '/exercises/blocks/new' : '/exercises/new'}
      label={isBlocks ? 'Nouveau bloc' : 'Nouvel exercice'}
      tone="solid"
      size="sm"
    >
      <IconPlus size={18} />
    </IconButton>
  )
}

export function ExercisesHubAddButton() {
  return (
    <Suspense
      fallback={
        <IconButton href="/exercises/new" label="Nouvel exercice" tone="solid" size="sm">
          <IconPlus size={18} />
        </IconButton>
      }
    >
      <AddInner />
    </Suspense>
  )
}
