'use client'

import { useState, type DragEvent, type ReactNode } from 'react'

import {
  deleteTrainlyProgramSessionAction,
  replaceProgramSessionCompositionAction,
} from '@/src/app/admin/programs/programSessionActions'
import { ProgramSessionMetaPopup } from '@/src/components/admin/ProgramSessionMetaPopup'
import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import {
  Button,
  ConfirmSubmitButton,
  IconPlus,
  IconTrash,
} from '@/src/components/ui'
import type { SessionSlot } from '@/src/lib/sessions/constants'
import { groupSessionsByDay } from '@/src/lib/programs/builderDayOrder'

export type BuilderSessionItem = {
  id: string
  kind: 'block' | 'exercise'
  label: string
  position: number
  children?: { id: string; name: string }[]
}

export type BuilderSession = {
  id: string
  week_id: string
  title: string | null
  session_order: number
  notes?: string | null
  objective_ressenti?: boolean
  objective_note?: boolean
  objective_difficulty?: boolean
  item_count: number
  items: BuilderSessionItem[]
  compositionSlots?: {
    key: string
    kind: 'block' | 'exercise' | 'rest'
    blockId?: string
    exerciseId?: string
    restSeconds?: number
    prescriptions: {
      unit_id: string
      value: string
      input_mode?: string
      group?: number
      varies?: boolean
    }[]
  }[]
}

export type CompositionEditorCatalog = {
  blocks: {
    id: string
    name: string
    status: string
    sport_id: string | null
    sport_label: string | null
  }[]
  exercises: {
    id: string
    name: string
    exercise_type_id: string | null
    exercise_type_label: string | null
    sport_id: string | null
    sport_label: string | null
    muscle_group?: string | null
  }[]
  units: {
    id: string
    key: string
    label: string
    short_label?: string | null
    value_mode?: string | null
    list_options?: string[] | null
  }[]
  blockCatalog: {
    candidates: {
      id: string
      name: string
      exercise_type_id: string | null
      exercise_type_label: string | null
      sport_id: string | null
      sport_label: string | null
      muscle_group?: string | null
    }[]
    sports: { id: string; label: string }[]
    units: {
      id: string
      key: string
      label: string
      short_label?: string | null
      value_mode?: 'number' | 'time' | 'text' | 'list' | null
      list_options?: string[] | null
    }[]
  }
  initialBlockDetails: import('@/src/lib/sessions/blockDetail').SessionBlockDetail[]
}

type DropHandlers = {
  onDropLibrarySession: (libraryId: string, day: number, intoSessionId?: string) => void
  onDropLibraryBlock: (blockId: string, day: number, intoSessionId?: string) => void
  onDropLibraryExercise: (exerciseId: string, day: number, intoSessionId?: string) => void
  onMoveProgramSession: (sessionId: string, day: number) => void
}

type Props = {
  isCalendar: boolean
  weekSessions: BuilderSession[]
  programId: string
  weekId: string
  focusedDay: number
  /** Jour agrandi + catalogue overlay (même vue semaine, pas une autre fenêtre). */
  expanded: boolean
  catalogOverlay?: ReactNode
  compositionEditor?: CompositionEditorCatalog | null
  onFocusDay: (day: number) => void
  onDropLibrarySession: DropHandlers['onDropLibrarySession']
  onDropLibraryBlock: DropHandlers['onDropLibraryBlock']
  onDropLibraryExercise: DropHandlers['onDropLibraryExercise']
  onMoveProgramSession: DropHandlers['onMoveProgramSession']
  onCreateSession: (day: number) => void
  pending?: boolean
}

const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const
const DAY_FULL = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const
const MAX_SLOTS = 6
const MIN_SLOTS = 3

function acceptDropTypes(types: readonly string[]) {
  return (
    types.includes('text/library-session-id') ||
    types.includes('text/library-block-id') ||
    types.includes('text/library-exercise-id') ||
    types.includes('text/session-id')
  )
}

function dropEffectFor(types: readonly string[]): DataTransfer['dropEffect'] {
  return types.includes('text/session-id') ? 'move' : 'copy'
}

function handleDataTransferDrop(
  e: DragEvent,
  day: number,
  handlers: DropHandlers,
  intoSessionId?: string,
) {
  const libSession = e.dataTransfer.getData('text/library-session-id')
  if (libSession) {
    handlers.onDropLibrarySession(libSession, day, intoSessionId)
    return
  }
  const libBlock = e.dataTransfer.getData('text/library-block-id')
  if (libBlock) {
    handlers.onDropLibraryBlock(libBlock, day, intoSessionId)
    return
  }
  const libExercise = e.dataTransfer.getData('text/library-exercise-id')
  if (libExercise) {
    handlers.onDropLibraryExercise(libExercise, day, intoSessionId)
    return
  }
  const sessionId = e.dataTransfer.getData('text/session-id')
  if (sessionId) handlers.onMoveProgramSession(sessionId, day)
}

function ClassicSessionCard({
  session,
  day,
  programId,
  weekId,
  pending,
  handlers,
  compositionEditor,
}: {
  session: BuilderSession
  day: number
  programId: string
  weekId: string
  pending?: boolean
  handlers: DropHandlers
  compositionEditor?: CompositionEditorCatalog | null
}) {
  const [over, setOver] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const items = session.items.slice().sort((a, b) => a.position - b.position)
  const slots = (session.compositionSlots ?? []) as SessionSlot[]

  return (
    <article
      draggable={!metaOpen}
      onDragStart={(e) => {
        if (metaOpen) return
        e.stopPropagation()
        e.dataTransfer.setData('text/session-id', session.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const types = Array.from(e.dataTransfer.types)
        if (!acceptDropTypes(types)) return
        e.dataTransfer.dropEffect = dropEffectFor(types)
        setOver(true)
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        handleDataTransferDrop(e, day, handlers, session.id)
      }}
      className={`rounded-[var(--radius-lg)] border bg-[var(--surface)] p-3 shadow-da-sm transition ${
        over ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--border)]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2 border-b border-[var(--border)] pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[color:var(--fg)]">
            {session.title?.trim() || 'Séance'}
          </h3>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            {items.length} item{items.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-[11px] font-bold text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
          onClick={(e) => {
            e.stopPropagation()
            setMetaOpen(true)
          }}
          title="Nom, notes, feedback"
          aria-label="Infos séance"
        >
          i
        </button>
        <form action={deleteTrainlyProgramSessionAction} onClick={(e) => e.stopPropagation()}>
          <input type="hidden" name="program_id" value={programId} />
          <input type="hidden" name="week_id" value={weekId} />
          <input type="hidden" name="session_id" value={session.id} />
          <ConfirmSubmitButton
            size="sm"
            variant="secondary"
            className="!h-7 !w-7 !min-w-0 !rounded-[var(--radius-sm)] !p-0"
            confirmMessage="Retirer cette séance ?"
          >
            <IconTrash size={14} />
          </ConfirmSubmitButton>
        </form>
      </div>

      {compositionEditor ? (
        <form
          action={replaceProgramSessionCompositionAction}
          className="space-y-2"
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
        >
          <input type="hidden" name="program_id" value={programId} />
          <input type="hidden" name="week_id" value={weekId} />
          <input type="hidden" name="session_id" value={session.id} />
          <SessionFicheEditor
            key={`${session.id}-${slots.length}-${items.map((i) => i.id).join(',')}`}
            compositionOnly
            blocks={compositionEditor.blocks}
            exercises={compositionEditor.exercises}
            units={compositionEditor.units}
            blockCatalog={compositionEditor.blockCatalog}
            initialBlockDetails={compositionEditor.initialBlockDetails}
            returnToForNewBlock={`/admin/programs/${programId}`}
            initial={{ slots }}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" className="!h-8 !rounded-full !px-3 !text-[12px]" disabled={pending}>
              Enregistrer composition
            </Button>
          </div>
        </form>
      ) : (
        <ul className="space-y-1">
          {items.length ? (
            items.map((it) => (
              <li
                key={it.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--muted)]">
                    {it.kind === 'block' ? 'Bloc' : 'Exo'}
                  </span>
                  <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--fg)]">
                    {it.label}
                  </span>
                </div>
              </li>
            ))
          ) : (
            <li className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-6 text-center text-[12px] text-[color:var(--muted)]">
              Glisser un bloc ou un exercice ici
            </li>
          )}
        </ul>
      )}

      {metaOpen ? (
        <ProgramSessionMetaPopup
          mode="edit"
          programId={programId}
          weekId={weekId}
          sessionId={session.id}
          pending={pending}
          onClose={() => setMetaOpen(false)}
          defaults={{
            title: session.title,
            notes: session.notes,
            objective_ressenti: session.objective_ressenti,
            objective_note: session.objective_note,
            objective_difficulty: session.objective_difficulty,
          }}
        />
      ) : null}
    </article>
  )
}

function CompactDayColumn({
  label,
  sessions,
  dimmed,
  onOpen,
}: {
  label: string
  sessions: BuilderSession[]
  dimmed?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex h-full min-h-[140px] w-full flex-col gap-1 rounded-[var(--radius-md)] border border-dashed p-2 text-left transition hover:border-[var(--brand)] ${
        dimmed
          ? 'border-[var(--border)] bg-[var(--page-bg)] opacity-50 blur-[2px]'
          : 'border-[var(--border)] bg-[var(--page-bg)]'
      }`}
    >
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </p>
      <div className="flex flex-1 flex-col gap-1 overflow-hidden">
        {sessions.length ? (
          sessions.map((s) => (
            <div
              key={s.id}
              className="truncate rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[color:var(--fg)]"
            >
              {s.title?.trim() || 'Séance'}
            </div>
          ))
        ) : (
          <p className="mt-auto text-center text-[10px] text-[color:var(--muted)]/60">Vide</p>
        )}
      </div>
    </button>
  )
}

function ExpandedDayColumn({
  label,
  day,
  sessions,
  programId,
  weekId,
  pending,
  handlers,
  onCreateSession,
  compositionEditor,
}: {
  label: string
  day: number
  sessions: BuilderSession[]
  programId: string
  weekId: string
  pending?: boolean
  handlers: DropHandlers
  onCreateSession: (day: number) => void
  compositionEditor?: CompositionEditorCatalog | null
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        const types = Array.from(e.dataTransfer.types)
        if (!acceptDropTypes(types)) return
        e.dataTransfer.dropEffect = dropEffectFor(types)
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handleDataTransferDrop(e, day, handlers)
      }}
      className={`flex h-full min-h-[420px] flex-col gap-3 rounded-[var(--radius-lg)] border p-3 shadow-da-md transition ${
        over
          ? 'border-[var(--brand)] bg-[var(--brand)]/5'
          : 'border-[var(--brand)] bg-[var(--surface)] ring-1 ring-[var(--brand)]/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[color:var(--fg)]">{label}</h3>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="!h-8 !gap-1 !rounded-full !px-3 !text-[12px]"
          disabled={pending}
          onClick={() => onCreateSession(day)}
        >
          <IconPlus size={14} />
          Séance
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {sessions.length ? (
          sessions.map((s) => (
            <ClassicSessionCard
              key={s.id}
              session={s}
              day={day}
              programId={programId}
              weekId={weekId}
              pending={pending}
              handlers={handlers}
              compositionEditor={compositionEditor}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] px-4 text-center text-sm text-[color:var(--muted)]">
            Glisser un bloc / exo ici → crée une séance « Séance »
          </div>
        )}
      </div>
    </div>
  )
}

function weekColumns(weekSessions: BuilderSession[], focusedDay: number) {
  const sorted = weekSessions.slice().sort((a, b) => a.session_order - b.session_order)
  const slotCount = Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, sorted.length, focusedDay + 1))
  return Array.from({ length: slotCount }, (_, i) => {
    const s = sorted.find((x) => x.session_order === i)
    return {
      key: `slot-${i}`,
      index: i,
      label: `Slot ${i + 1}`,
      fullLabel: `Slot ${i + 1}`,
      sessions: s ? [s] : ([] as BuilderSession[]),
    }
  })
}

export function ProgramBuilderDayBoard({
  isCalendar,
  weekSessions,
  programId,
  weekId,
  focusedDay,
  expanded,
  catalogOverlay,
  compositionEditor,
  onFocusDay,
  onDropLibrarySession,
  onDropLibraryBlock,
  onDropLibraryExercise,
  onMoveProgramSession,
  onCreateSession,
  pending,
}: Props) {
  const handlers: DropHandlers = {
    onDropLibrarySession,
    onDropLibraryBlock,
    onDropLibraryExercise,
    onMoveProgramSession,
  }

  const columns = isCalendar
    ? DAY_LABELS.map((label, i) => ({
        key: label,
        index: i,
        label,
        fullLabel: DAY_FULL[i] ?? label,
        sessions: groupSessionsByDay(weekSessions)[i] ?? [],
      }))
    : weekColumns(weekSessions, focusedDay)

  // Catalogue collé au jour focus : à gauche s’il y a de la place, sinon à droite
  const catalogBeforeDay = expanded && focusedDay > 0

  if (!expanded) {
    return (
      <div
        className="grid min-h-[440px] gap-2"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((col) => (
          <div key={col.key} className="min-w-0">
            <CompactDayColumn
              label={col.label}
              sessions={col.sessions}
              onOpen={() => onFocusDay(col.index)}
            />
          </div>
        ))}
      </div>
    )
  }

  const before = columns.filter((c) => c.index < focusedDay)
  const focus = columns.find((c) => c.index === focusedDay) ?? columns[0]!
  const after = columns.filter((c) => c.index > focusedDay)

  const catalogNode = catalogOverlay ? (
    <div className="flex h-full w-[min(17rem,42%)] shrink-0">{catalogOverlay}</div>
  ) : null

  return (
    <div className="flex min-h-[440px] gap-2">
      {before.map((col) => (
        <div key={col.key} className="w-11 shrink-0 min-[1100px]:w-14">
          <CompactDayColumn
            label={col.label}
            sessions={col.sessions}
            dimmed
            onOpen={() => onFocusDay(col.index)}
          />
        </div>
      ))}

      {catalogBeforeDay ? catalogNode : null}

      <div className="relative z-10 min-w-0 flex-1">
        <ExpandedDayColumn
          label={focus.fullLabel}
          day={focus.index}
          sessions={focus.sessions}
          programId={programId}
          weekId={weekId}
          pending={pending}
          handlers={handlers}
          onCreateSession={onCreateSession}
          compositionEditor={compositionEditor}
        />
      </div>

      {!catalogBeforeDay ? catalogNode : null}

      {after.map((col) => (
        <div key={col.key} className="w-11 shrink-0 min-[1100px]:w-14">
          <CompactDayColumn
            label={col.label}
            sessions={col.sessions}
            dimmed
            onOpen={() => onFocusDay(col.index)}
          />
        </div>
      ))}
    </div>
  )
}
