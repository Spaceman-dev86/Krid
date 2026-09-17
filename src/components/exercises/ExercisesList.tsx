import Link from 'next/link'

import { Button } from '@/src/components/ui'
import type { CoachExerciseRow } from '../../lib/exercises/library'
import { softDeleteCoachExerciseAction, transferTrainlyExerciseAction } from '../../app/exercises/actions'

type Props = {
  items: CoachExerciseRow[]
  mode: 'trainly' | 'mine' | 'brouillon'
  emptyHint: string
}

export function ExercisesList({ items, mode, emptyHint }: Props) {
  if (!items.length) {
    return <p className="text-sm text-black/45">{emptyHint}</p>
  }

  return (
    <ul className="grid gap-2">
      {items.map((ex) => {
        const href =
          mode === 'trainly'
            ? `/exercises/${ex.id}`
            : mode === 'mine'
              ? `/exercises/mine/${ex.id}`
              : `/exercises/brouillon/${ex.id}`

        return (
          <li
            key={ex.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <Link href={href} className="font-extrabold text-[color:var(--brand)] hover:underline">
                {ex.name}
              </Link>
              <p className="text-xs text-black/45">
                {[ex.exercise_type, ex.muscle_group, ex.difficulty].filter(Boolean).join(' · ') ||
                  '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {mode === 'trainly' ? (
                <form action={transferTrainlyExerciseAction}>
                  <input type="hidden" name="id" value={ex.id} />
                  <Button type="submit" variant="secondary" size="sm" className="!rounded-lg !px-3 !py-1.5 text-xs">
                    Transférer
                  </Button>
                </form>
              ) : null}
              <Button href={href} size="sm" className="!rounded-lg !px-3 !py-1.5 text-xs">
                {mode === 'trainly' ? 'Voir' : 'Éditer'}
              </Button>
              {mode !== 'trainly' ? (
                <form action={softDeleteCoachExerciseAction}>
                  <input type="hidden" name="id" value={ex.id} />
                  <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                    Archiver
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
