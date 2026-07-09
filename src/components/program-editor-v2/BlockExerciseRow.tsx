'use client'

import { memo } from 'react'

import { useApplyCommand, useBlockExercise } from '../../store/program-editor'
import InlineCommitField from './ui/InlineCommitField'

type Props = {
  blockExerciseId: string
  index: number
}

/** @deprecated Use BlockExerciseInlineRow in TimelineItemView — kept for compatibility */
function BlockExerciseRowInner({ blockExerciseId }: Props) {
  const row = useBlockExercise(blockExerciseId)
  const applyCommand = useApplyCommand()
  if (!row) return null

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <InlineCommitField
        value={row.exerciseName ?? ''}
        placeholder="Exercice"
        dense
        onCommit={(exerciseName) =>
          applyCommand({
            type: 'blockExercise.update',
            blockExerciseId,
            patch: { exerciseName: exerciseName || null },
          })
        }
      />
      <InlineCommitField
        value={row.notes ?? ''}
        placeholder="Notes"
        dense
        onCommit={(notes) =>
          applyCommand({
            type: 'blockExercise.update',
            blockExerciseId,
            patch: { notes: notes || null },
          })
        }
      />
    </div>
  )
}

export default memo(BlockExerciseRowInner)
