import type { ReactNode } from 'react'

import { PageTitle, Muted } from '@/src/components/ui'
import { ExercisesHubAddButton } from './ExercisesHubAddButton'
import { ExercisesPrimaryNav } from './ExercisesPrimaryNav'

/**
 * Chrome hub Exercices — même pattern que Clients :
 *   [ titre… ] ………… [ + ] [ Exercices · Blocs · Tags ]
 */
export function ExercisesHubHeader({
  title,
  subtitle,
  actions,
  showAdd = true,
}: {
  title: string
  subtitle?: ReactNode
  /** Actions supplémentaires à gauche du + (rare). */
  actions?: ReactNode
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
        {actions ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-2">{actions}</div>
        ) : null}
        {showAdd ? <ExercisesHubAddButton /> : null}
        <div className="min-w-0 max-w-[min(100%,28rem)] overflow-x-auto">
          <ExercisesPrimaryNav />
        </div>
      </div>
    </header>
  )
}
