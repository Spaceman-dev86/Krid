'use client'

import { buildPreviewExerciseMetaLine } from '../lib/previewExerciseMeta'
import type { PreviewBlockExerciseRow, PreviewSessionBlockRow } from '../lib/fetchProgramPreviewStructure'
import PreviewExerciseCard from './PreviewExerciseCard'

type Props = {
  block: PreviewSessionBlockRow
  exercises: PreviewBlockExerciseRow[]
  openBlockExerciseId: string | null
  onToggleBlockExercise: (blockExerciseId: string) => void
}

function blockTypeLabel(type: string | null | undefined) {
  const t = String(type ?? '').trim().toLowerCase()
  if (t === 'crosstraining' || t === 'crossfit') return 'Crossfit'
  if (t === 'warmup' || t === 'échauffement') return 'Warm-up'
  if (t === 'superset' || t === 'strength' || t === 'powerlifting') return 'Superset'
  if (t === 'circuit') return 'Circuit'
  return null
}

export default function PreviewBlockCard({
  block,
  exercises,
  openBlockExerciseId,
  onToggleBlockExercise,
}: Props) {
  const title = String(block.title ?? '').trim() || blockTypeLabel(block.type) || 'Bloc'
  const blockNotes = String(block.notes ?? '').trim()

  const openExercise = exercises.find((be) => be.id === openBlockExerciseId) ?? null

  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
      <div className="border-b border-black/5 bg-[#fafafa] px-3 py-2">
        <div className="text-sm font-extrabold text-[var(--brand)]">{title}</div>
        {blockNotes ? <p className="mt-0.5 text-xs font-semibold leading-snug text-black/65">{blockNotes}</p> : null}
      </div>

      {exercises.length === 0 ? (
        <div className="px-3 py-3 text-xs font-semibold text-black/50">Aucun exercice dans ce bloc.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 p-2">
            {exercises.map((be) => {
              const displayName = be.exercise_library?.name ?? be.exercise_name ?? 'Exercice'
              const note = String(be.notes ?? '').trim()
              const metaLine = buildPreviewExerciseMetaLine({
                sets: be.sets,
                reps: be.reps,
                restSeconds: be.rest_seconds,
                loadText: be.load_text,
              })
              const active = be.id === openBlockExerciseId

              return (
                <button
                  key={be.id}
                  type="button"
                  onClick={() => onToggleBlockExercise(be.id)}
                  className={[
                    'min-w-[7rem] max-w-full flex-[1_1_7rem] rounded-lg px-3 py-2 text-left transition',
                    active
                      ? 'bg-[var(--brand)] text-white shadow-sm'
                      : 'bg-[#f5f5f5] text-[var(--brand)] hover:bg-white',
                  ].join(' ')}
                >
                  <div className="truncate text-xs font-extrabold">{displayName}</div>
                  {!active && note ? (
                    <p
                      className={[
                        'mt-0.5 truncate text-[11px] font-semibold',
                        active ? 'text-white/85' : 'text-black/60',
                      ].join(' ')}
                    >
                      {note}
                    </p>
                  ) : !active && metaLine ? (
                    <p
                      className={[
                        'mt-0.5 line-clamp-2 text-[11px] font-semibold',
                        active ? 'text-white/85' : 'text-black/60',
                      ].join(' ')}
                    >
                      {metaLine}
                    </p>
                  ) : null}
                </button>
              )
            })}
          </div>

          {openExercise ? (
            <PreviewExerciseCard
              displayName={openExercise.exercise_library?.name ?? openExercise.exercise_name ?? 'Exercice'}
              sets={openExercise.sets}
              reps={openExercise.reps}
              restSeconds={openExercise.rest_seconds}
              loadText={openExercise.load_text}
              notes={openExercise.notes}
              demoMediaUrl={openExercise.demo_media_url}
              demoMediaPath={openExercise.exercise_library?.demo_media_path ?? openExercise.demo_media_url}
              isOpen
              onToggle={() => onToggleBlockExercise(openExercise.id)}
              embedded
            />
          ) : null}
        </>
      )}
    </div>
  )
}
