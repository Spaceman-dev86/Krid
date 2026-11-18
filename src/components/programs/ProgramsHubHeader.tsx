'use client'

import type { ReactNode } from 'react'

import { PageTitle, Muted } from '@/src/components/ui'
import { ProgramsHubAddButton } from './ProgramsHubAddButton'
import { ProgramsPrimaryNav } from './ProgramsPrimaryNav'

/** Chrome hub Programmes — même pattern qu’Exercices. */
export function ProgramsHubHeader({
  title,
  subtitle,
  showAdd = true,
}: {
  title: string
  subtitle?: ReactNode
  showAdd?: boolean
}) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 sm:flex-1">
        <PageTitle className="text-2xl">{title}</PageTitle>
        {subtitle ? <Muted className="mt-1">{subtitle}</Muted> : null}
      </div>

      <div
        className="flex w-full shrink-0 flex-nowrap items-center justify-end gap-2 sm:w-auto"
        data-builder-chrome
      >
        {showAdd ? <ProgramsHubAddButton /> : null}
        <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
          <ProgramsPrimaryNav />
        </div>
      </div>
    </header>
  )
}
