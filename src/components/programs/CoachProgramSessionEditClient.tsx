'use client'

import Link from 'next/link'
import { useRef, useTransition } from 'react'

import { saveCoachProgramSessionCompositionAction } from '@/src/app/programs/sessionCompositionActions'
import {
  SessionFicheEditor,
  type SessionBlockCandidate,
  type SessionExerciseCandidate,
} from '@/src/components/admin/SessionFicheEditor'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, Muted, PageTitle } from '@/src/components/ui'
import type { UnitRow } from '@/src/lib/blocks/constants'
import type { SessionBlockDetail } from '@/src/lib/sessions/blockDetail'
import type { SessionSlot } from '@/src/lib/sessions/constants'

type Props = {
  programId: string
  weekId: string
  sessionId: string
  sessionTitle: string
  compositionVersion: number
  returnTo: string
  blocks: SessionBlockCandidate[]
  exercises: SessionExerciseCandidate[]
  units: UnitRow[]
  sports: { id: string; label: string }[]
  initialSlots: SessionSlot[]
  initialBlockDetails: SessionBlockDetail[]
  initialMeta: {
    name: string
    notes: string
    objective_ressenti: boolean
    objective_note: boolean
    objective_difficulty: boolean
  }
}

export function CoachProgramSessionEditClient({
  programId,
  weekId,
  sessionId,
  sessionTitle,
  compositionVersion,
  returnTo,
  blocks,
  exercises,
  units,
  sports,
  initialSlots,
  initialBlockDetails,
  initialMeta,
}: Props) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const apiRef = useRef<{
    awaitPendingForks: () => Promise<void>
    getSlots: () => SessionSlot[]
  } | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    const form = formRef.current
    const api = apiRef.current
    if (!form || !api || pending) return
    startTransition(async () => {
      await api.awaitPendingForks()
      const slots = api.getSlots()
      const fd = new FormData(form)
      fd.set('program_id', programId)
      fd.set('week_id', weekId)
      fd.set('session_id', sessionId)
      fd.set('return_to', returnTo)
      fd.set('expected_version', String(compositionVersion))
      fd.set('slots_json', JSON.stringify(slots))
      await saveCoachProgramSessionCompositionAction(fd)
    })
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <div className="mb-6">
        <p className="text-sm text-[color:var(--muted)]">
          <Link href={returnTo} className="font-semibold text-[var(--brand)] hover:underline">
            ← Retour
          </Link>
        </p>
        <PageTitle className="mt-2">Éditer la séance</PageTitle>
        <Muted className="mt-1">{sessionTitle}</Muted>
      </div>

      <form
        ref={formRef}
        className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm md:p-5"
      >
        <SessionFicheEditor
          programSessionId={sessionId}
          blocks={blocks}
          exercises={exercises}
          units={units}
          blockCatalog={{
            candidates: exercises.map((e) => ({
              id: e.id,
              name: e.name,
              exercise_type_id: e.exercise_type_id,
              exercise_type_label: e.exercise_type_label ?? null,
              sport_id: e.sport_id,
              sport_label: e.sport_label ?? null,
              muscle_group: e.muscle_group ?? null,
            })),
            sports,
            units,
          }}
          initialBlockDetails={initialBlockDetails}
          returnToForNewBlock={returnTo}
          initial={{
            name: initialMeta.name,
            notes: initialMeta.notes,
            objective_ressenti: initialMeta.objective_ressenti,
            objective_note: initialMeta.objective_note,
            objective_difficulty: initialMeta.objective_difficulty,
            slots: initialSlots,
          }}
          onRegisterApi={(api) => {
            apiRef.current = api
              ? { awaitPendingForks: api.awaitPendingForks, getSlots: api.getSlots }
              : null
          }}
        />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            disabled={pending}
            onClick={save}
            className="inline-flex items-center gap-2"
          >
            {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
            {pending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="secondary" href={returnTo}>
            Annuler
          </Button>
        </div>
      </form>
    </main>
  )
}
