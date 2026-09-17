'use client'

import { useState, type DragEvent } from 'react'

import {
  deleteTrainlyProgramSessionAction,
  renameTrainlyProgramSessionAction,
} from '@/src/app/admin/programs/programSessionActions'
import {
  Button,
  ConfirmSubmitButton,
  IconEdit,
  IconPlus,
  IconTrash,
} from '@/src/components/ui'
import { groupSessionsByDay } from '@/src/lib/programs/builderDayOrder'

export type BuilderSession = {
  id: string
  week_id: string
  title: string | null
  session_order: number
  item_count: number
  items: { id: string; kind: 'block' | 'exercise'; label: string; position: number }[]
}

type Props = {
  isCalendar: boolean
  weekSessions: BuilderSession[]
  programId: string
  weekId: string
  focusedDay: number
  buildMode: boolean
  onFocusDay: (day: number) => void
  onDropLibrarySession: (libraryId: string, day: number, intoSessionId?: string) => void
  onDropLibraryBlock: (blockId: string, day: number, intoSessionId?: string) => void
  onDropLibraryExercise: (exerciseId: string, day: number, intoSessionId?: string) => void
  onMoveProgramSession: (sessionId: string, day: number) => void
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
  handlers: {
    onDropLibrarySession: Props['onDropLibrarySession']
    onDropLibraryBlock: Props['onDropLibraryBlock']
    onDropLibraryExercise: Props['onDropLibraryExercise']
    onMoveProgramSession: Props['onMoveProgramSession']
  },
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

function CompactDay({
  label,
  sessions,
  active,
  onOpen,
}: {
  label: string
  sessions: BuilderSession[]
  active?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-[110px] flex-col gap-1 rounded-[var(--radius-md)] border border-dashed p-2 text-left transition hover:border-[var(--brand)] ${
        active
          ? 'border-[var(--brand)] bg-[var(--brand)]/5 ring-1 ring-[var(--brand)]'
          : 'border-[var(--border)] bg-[var(--page-bg)]'
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {label}
      </p>
      <div className="flex flex-1 flex-col gap-1">
        {sessions.length ? (
          sessions.map((s) => (
            <div
              key={s.id}
              className="truncate rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[color:var(--fg)]"
            >
              {s.title?.trim() || 'Séance'}
              {s.item_count > 0 ? (
                <span className="ml-1 font-normal text-[color:var(--muted)]">· {s.item_count}</span>
              ) : null}
            </div>
          ))
        ) : (
          <p className="mt-auto text-center text-[10px] text-[color:var(--muted)]/60">Vide</p>
        )}
      </div>
    </button>
  )
}

function ExpandedSessionCard({
  session,
  day,
  programId,
  weekId,
  pending,
  handlers,
}: {
  session: BuilderSession
  day: number
  programId: string
  weekId: string
  pending?: boolean
  handlers: {
    onDropLibrarySession: Props['onDropLibrarySession']
    onDropLibraryBlock: Props['onDropLibraryBlock']
    onDropLibraryExercise: Props['onDropLibraryExercise']
    onMoveProgramSession: Props['onMoveProgramSession']
  }
}) {
  const [renaming, setRenaming] = useState(false)
  const [over, setOver] = useState(false)
  const items = session.items.slice().sort((a, b) => a.position - b.position)

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        if (renaming) return
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
      className={`rounded-[var(--radius-md)] border bg-[var(--surface)] p-3 shadow-da-sm transition ${
        over ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--border)]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {renaming ? (
          <form
            action={renameTrainlyProgramSessionAction}
            className="flex min-w-0 flex-1 items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input type="hidden" name="program_id" value={programId} />
            <input type="hidden" name="week_id" value={weekId} />
            <input type="hidden" name="session_id" value={session.id} />
            <input
              name="title"
              defaultValue={session.title?.trim() || ''}
              autoFocus
              placeholder="Titre de la séance"
              className="h-8 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-2.5 text-sm font-semibold text-[color:var(--fg)]"
            />
            <Button type="submit" size="sm" className="!h-8 !rounded-full !px-3 !text-[12px]" disabled={pending}>
              OK
            </Button>
            <button
              type="button"
              className="text-sm text-[color:var(--muted)]"
              onClick={() => setRenaming(false)}
            >
              Annuler
            </button>
          </form>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--fg)]">
              {session.title?.trim() || 'Séance'}
            </h3>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)]"
              onClick={() => setRenaming(true)}
              title="Renommer"
            >
              <IconEdit size={14} />
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
          </>
        )}
      </div>

      <ul className="space-y-1.5">
        {items.length ? (
          items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--page-bg)] px-2.5 py-1.5 text-[12px] text-[color:var(--fg)]"
            >
              <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                {it.kind === 'block' ? 'Bloc' : 'Exo'}
              </span>
              <span className="min-w-0 truncate font-semibold">{it.label}</span>
            </li>
          ))
        ) : (
          <li className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-3 py-4 text-center text-[12px] text-[color:var(--muted)]">
            Glisser un bloc ou un exercice ici
          </li>
        )}
      </ul>
    </div>
  )
}

function BuildDayPanel({
  label,
  day,
  sessions,
  programId,
  weekId,
  pending,
  handlers,
  onCreateSession,
  onDropOnDay,
}: {
  label: string
  day: number
  sessions: BuilderSession[]
  programId: string
  weekId: string
  pending?: boolean
  handlers: {
    onDropLibrarySession: Props['onDropLibrarySession']
    onDropLibraryBlock: Props['onDropLibraryBlock']
    onDropLibraryExercise: Props['onDropLibraryExercise']
    onMoveProgramSession: Props['onMoveProgramSession']
  }
  onCreateSession: (day: number) => void
  onDropOnDay: (e: DragEvent) => void
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
        onDropOnDay(e)
      }}
      className={`flex min-h-[420px] flex-col gap-3 rounded-[var(--radius-lg)] border border-dashed p-3 transition ${
        over ? 'border-[var(--brand)] bg-[var(--brand)]/5' : 'border-[var(--border)] bg-[var(--page-bg)]'
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

      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto">
        {sessions.length ? (
          sessions.map((s) => (
            <ExpandedSessionCard
              key={s.id}
              session={s}
              day={day}
              programId={programId}
              weekId={weekId}
              pending={pending}
              handlers={handlers}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] text-sm text-[color:var(--muted)]">
            Glisser depuis le catalogue → ou créer une séance
          </div>
        )}
      </div>
    </div>
  )
}

export function ProgramBuilderDayBoard({
  isCalendar,
  weekSessions,
  programId,
  weekId,
  focusedDay,
  buildMode,
  onFocusDay,
  onDropLibrarySession,
  onDropLibraryBlock,
  onDropLibraryExercise,
  onMoveProgramSession,
  onCreateSession,
  pending,
}: Props) {
  const handlers = {
    onDropLibrarySession,
    onDropLibraryBlock,
    onDropLibraryExercise,
    onMoveProgramSession,
  }

  if (isCalendar) {
    const byDay = groupSessionsByDay(weekSessions)

    if (buildMode) {
      return (
        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {DAY_LABELS.map((label, i) => {
              const active = focusedDay === i
              const count = byDay[i]?.length ?? 0
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onFocusDay(i)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                      : 'bg-[var(--accent)] text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]'
                  }`}
                >
                  {label}
                  {count ? <span className="ml-1 opacity-70">{count}</span> : null}
                </button>
              )
            })}
          </div>
          <BuildDayPanel
            label={DAY_FULL[focusedDay] ?? 'Jour'}
            day={focusedDay}
            sessions={byDay[focusedDay] ?? []}
            programId={programId}
            weekId={weekId}
            pending={pending}
            handlers={handlers}
            onCreateSession={onCreateSession}
            onDropOnDay={(e) => handleDataTransferDrop(e, focusedDay, handlers)}
          />
        </div>
      )
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, i) => (
          <CompactDay
            key={label}
            label={label}
            sessions={byDay[i] ?? []}
            onOpen={() => onFocusDay(i)}
          />
        ))}
      </div>
    )
  }

  const sorted = weekSessions.slice().sort((a, b) => a.session_order - b.session_order)
  const slotCount = Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, sorted.length, focusedDay + 1))
  const slots: BuilderSession[][] = Array.from({ length: slotCount }, (_, i) => {
    const s = sorted.find((x) => x.session_order === i)
    return s ? [s] : []
  })

  if (buildMode) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {slots.map((list, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onFocusDay(i)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                focusedDay === i
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'bg-[var(--accent)] text-[color:var(--fg)]'
              }`}
            >
              Slot {i + 1}
              {list.length ? <span className="ml-1 opacity-70">{list.length}</span> : null}
            </button>
          ))}
        </div>
        <BuildDayPanel
          label={`Slot ${focusedDay + 1}`}
          day={focusedDay}
          sessions={slots[focusedDay] ?? []}
          programId={programId}
          weekId={weekId}
          pending={pending}
          handlers={handlers}
          onCreateSession={onCreateSession}
          onDropOnDay={(e) => handleDataTransferDrop(e, focusedDay, handlers)}
        />
      </div>
    )
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))` }}
    >
      {slots.map((list, i) => (
        <CompactDay
          key={i}
          label={`Slot ${i + 1}`}
          sessions={list}
          onOpen={() => onFocusDay(i)}
        />
      ))}
    </div>
  )
}
