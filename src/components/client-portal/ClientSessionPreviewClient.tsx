'use client'

import { useMemo, useState } from 'react'

import type {
  PreviewBlockExerciseRow,
  PreviewProgramExerciseRow,
  PreviewSessionBlockRow,
  PreviewSessionItemRow,
  PreviewSessionRow,
} from '../../lib/fetchProgramPreviewStructure'
import PreviewBlockCard from '../PreviewBlockCard'
import PreviewExerciseCard from '../PreviewExerciseCard'

type SessionContentItem =
  | { kind: 'exercise'; programExercise: PreviewProgramExerciseRow }
  | { kind: 'block'; block: PreviewSessionBlockRow; exercises: PreviewBlockExerciseRow[] }

type Props = {
  session: PreviewSessionRow
  programExercises: PreviewProgramExerciseRow[]
  sessionItems?: PreviewSessionItemRow[]
  sessionBlocks?: PreviewSessionBlockRow[]
  blockExercises?: PreviewBlockExerciseRow[]
}

function isSessionItemBlockKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'block' || k === 'session_block' || k === 'bloc' || k === 'circuit' || k === 'crosstraining'
}

function isSessionItemExerciseKind(kind: string | null | undefined): boolean {
  const k = String(kind ?? '').trim().toLowerCase()
  return k === 'exercise' || k === 'program_exercise'
}

export function ClientSessionPreviewClient(props: Props) {
  const sessionItems = props.sessionItems ?? []
  const sessionBlocks = props.sessionBlocks ?? []
  const blockExercises = props.blockExercises ?? []

  const programExerciseById = useMemo(() => {
    const map = new Map<string, PreviewProgramExerciseRow>()
    for (const pe of props.programExercises) map.set(pe.id, pe)
    return map
  }, [props.programExercises])

  const blockById = useMemo(() => {
    const map = new Map<string, PreviewSessionBlockRow>()
    for (const b of sessionBlocks) map.set(b.id, b)
    return map
  }, [sessionBlocks])

  const blockExercisesByBlockId = useMemo(() => {
    const map: Record<string, PreviewBlockExerciseRow[]> = {}
    for (const be of blockExercises) {
      const key = String(be.session_block_id)
      if (!map[key]) map[key] = []
      map[key].push(be)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return map
  }, [blockExercises])

  const sessionItemsForSession = useMemo(() => {
    return sessionItems
      .filter((item) => item.session_id === props.session.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }, [sessionItems, props.session.id])

  const exercisesForSession = useMemo(() => {
    return props.programExercises
      .filter((pe) => pe.session_id === props.session.id)
      .sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
  }, [props.programExercises, props.session.id])

  const contentItems = useMemo((): SessionContentItem[] => {
    if (sessionItemsForSession.length === 0) {
      return exercisesForSession.map((pe) => ({ kind: 'exercise' as const, programExercise: pe }))
    }

    const out: SessionContentItem[] = []
    for (const item of sessionItemsForSession) {
      if (isSessionItemExerciseKind(item.kind) && item.program_exercise_id) {
        const pe = programExerciseById.get(String(item.program_exercise_id))
        if (pe) out.push({ kind: 'exercise', programExercise: pe })
        continue
      }
      if (isSessionItemBlockKind(item.kind) && item.session_block_id) {
        const blockId = String(item.session_block_id)
        const block = blockById.get(blockId)
        if (block) {
          out.push({
            kind: 'block',
            block,
            exercises: blockExercisesByBlockId[blockId] ?? [],
          })
        }
      }
    }
    return out
  }, [
    sessionItemsForSession,
    exercisesForSession,
    programExerciseById,
    blockById,
    blockExercisesByBlockId,
  ])

  const [openPreviewKey, setOpenPreviewKey] = useState<string | null>(null)
  const openBlockExerciseId =
    openPreviewKey?.startsWith('block:') ? openPreviewKey.slice('block:'.length) : null

  function toggleProgramExercise(id: string) {
    const key = `program:${id}`
    setOpenPreviewKey((prev) => (prev === key ? null : key))
  }

  function toggleBlockExercise(blockExerciseId: string) {
    const key = `block:${blockExerciseId}`
    setOpenPreviewKey((prev) => (prev === key ? null : key))
  }

  if (!contentItems.length) {
    return (
      <p className="text-sm text-black/50">
        Aucun exercice dans cette séance. Ton coach peut encore compléter le programme.
      </p>
    )
  }

  return (
    <ul className="grid gap-3">
      {contentItems.map((item) => {
        if (item.kind === 'exercise') {
          const pe = item.programExercise
          const displayName = pe.exercise_library?.name ?? pe.name ?? 'Exercice'
          const exerciseOpen = openPreviewKey === `program:${pe.id}`
          return (
            <li key={pe.id}>
              <PreviewExerciseCard
                displayName={displayName}
                sets={pe.sets}
                reps={pe.reps}
                restTime={pe.rest_time}
                rpe={pe.rpe}
                tempo={pe.tempo}
                load={pe.load}
                notes={pe.notes}
                demoMediaUrl={pe.demo_media_url}
                demoMediaPath={pe.exercise_library?.demo_media_path ?? pe.demo_media_url}
                isOpen={exerciseOpen}
                onToggle={() => toggleProgramExercise(pe.id)}
              />
            </li>
          )
        }

        return (
          <li key={item.block.id}>
            <PreviewBlockCard
              block={item.block}
              exercises={item.exercises}
              openBlockExerciseId={openBlockExerciseId}
              onToggleBlockExercise={toggleBlockExercise}
            />
          </li>
        )
      })}
    </ul>
  )
}
