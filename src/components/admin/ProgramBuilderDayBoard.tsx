'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { saveProgramSessionCompositionQuietAction } from '@/src/app/admin/programs/programSessionActions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { ProgramSessionMetaPopup } from '@/src/components/admin/ProgramSessionMetaPopup'
import { SessionFicheEditor } from '@/src/components/admin/SessionFicheEditor'
import { Button, IconCaret, IconClose, IconEdit, IconPlus, IconTrash } from '@/src/components/ui'
import type { SessionSlot } from '@/src/lib/sessions/constants'
import { groupSessionsByDay } from '@/src/lib/programs/builderDayOrder'
import {
  formatBlockTimerSummary,
  formatFilledPrescriptionLines,
} from '@/src/lib/sessions/blockDetail'
import { parseSessionCompositionFormData } from '@/src/lib/sessions/parseSessionCompositionForm'

type CompositionFormEntry = {
  form: HTMLFormElement
  /** Ref synchrone — le flush ne dépend pas du re-render React. */
  dirtyRef: { current: boolean }
  appendBlock?: (blockId: string) => void
  appendExercise?: (exerciseId: string) => void
  insertBlockAt?: (blockId: string, index: number) => void
  insertExerciseAt?: (exerciseId: string, index: number) => void
  awaitPendingForks?: () => Promise<void>
  markClean?: () => void
  getSlots?: () => import('@/src/lib/sessions/constants').SessionSlot[]
  applyServerSlots?: (slots: import('@/src/lib/sessions/constants').SessionSlot[]) => void
}
type FlushResult =
  | { ok: true; saved: boolean; versions?: Record<string, number> }
  | { ok: false }

export type BuilderCompositionApi = {
  flush: () => Promise<FlushResult>
  /** true si au moins une composition ouverte a des changements non sauvés. */
  hasDirty: () => boolean
  /** Drop dans une séance ouverte → édition locale (pas d’écriture DB séparée). */
  appendToOpenSession: (
    sessionId: string,
    kind: 'block' | 'exercise',
    catalogId: string,
    /** Omit / undefined = append fin ; number = insert à l’index. */
    index?: number,
  ) => boolean
}

export type BuilderSessionItem = {
  id: string
  kind: 'block' | 'exercise' | 'rest'
  label: string
  position: number
  restSeconds?: number
  /** Une ligne par série remplie (exos). */
  rxSummaryLines?: string[]
  /** Résumé minuteur (bloc) — vue compacte. */
  timerSummary?: string | null
  /** Note du bloc — vue compacte. */
  blockNotes?: string | null
  children?: {
    id: string
    name: string
    rxSummary?: string | null
    rxSummaryLines?: string[]
  }[]
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
  /** Optimistic concurrency — envoyé au save composition. */
  composition_version?: number
  item_count: number
  items: BuilderSessionItem[]
  compositionSlots?: {
    key: string
    kind: 'block' | 'exercise' | 'rest'
    blockId?: string
    orphanSessionBlockId?: string
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

/** Desktop builder : side days + catalogue collé. En dessous = mode tablette (+ phone). */
export const BUILDER_DESKTOP_MIN_PX = 1100
/** Téléphone : même cœur tablette + chrome / semaine empilée. */
export const BUILDER_PHONE_MAX_PX = 767

/**
 * SSR / hydratation : `false` (getServerSnapshot).
 * Client : `matchMedia` via useSyncExternalStore — sync avant paint
 * (pas de frame desktop→tablette comme avec useEffect).
 */
function useMediaMaxWidth(maxPx: number) {
  const query = `(max-width: ${maxPx}px)`
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export function useBuilderTabletLayout() {
  return useMediaMaxWidth(BUILDER_DESKTOP_MIN_PX - 1)
}

export function useBuilderPhoneLayout() {
  return useMediaMaxWidth(BUILDER_PHONE_MAX_PX)
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
  /** Ferme le jour agrandi (clic hors journée / catalogue). */
  onCollapse?: () => void
  onCompositionAutosaved?: () => void
  /** Après flush/save : snapshot composition pour patch live (évite merge stale). */
  onCompositionSnapshot?: (
    sessionId: string,
    payload: {
      items: BuilderSessionItem[]
      compositionSlots: NonNullable<BuilderSession['compositionSlots']>
      item_count: number
      composition_version?: number
    },
  ) => void
  /** Flush + append local (une logique : fermer = sauver). */
  registerCompositionApi?: (api: BuilderCompositionApi | null) => void
  /** Séance composition ouverte dans le jour (tablette multi-séances / drops catalogue). */
  onExpandedOpenSessionIdChange?: (sessionId: string | null) => void
  onSessionMetaSaved?: (
    sessionId: string,
    patch: {
      title: string
      notes?: string | null
      objective_ressenti?: boolean
      objective_note?: boolean
      objective_difficulty?: boolean
    },
    flash?: string,
  ) => void
  onDeleteSession?: (sessionId: string, day: number) => void
  onReorderSessionInDay?: (sessionId: string, day: number, direction: -1 | 1) => void
  /** Retire une journée-slot (purge + décalage). Retourne true si OK. */
  onRemoveSlotDay?: (day: number) => Promise<boolean>
  onCatalogBlockPublished?: (block: {
    id: string
    name: string
    sport_id: string | null
    status: string
  }) => void
  onCatalogSessionPublished?: (session: {
    id: string
    name: string | null
    notes: string | null
    item_count: number
    sport_ids: string[]
    type_ids: string[]
  }) => void
  pending?: boolean
  /** Preview catalogue Krid : pas d’édition / drop / create. */
  readOnly?: boolean
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

function formDataSessionId(form: HTMLFormElement) {
  const input = form.querySelector('input[name="session_id"]')
  return input instanceof HTMLInputElement ? input.value : null
}

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
  inlineCatalog,
  active,
  onActivate,
  onSessionMetaSaved,
  onCompositionSnapshot,
  onDeleteSession,
  onReorderSessionInDay,
  onCatalogBlockPublished,
  onCatalogSessionPublished,
  sessionIndexInDay,
  sessionsInDay,
  registerCompositionForm,
  readOnly = false,
}: {
  session: BuilderSession
  day: number
  programId: string
  weekId: string
  pending?: boolean
  handlers: DropHandlers
  compositionEditor?: CompositionEditorCatalog | null
  /** Tablette : picker exos/blocs en bas de séance. */
  inlineCatalog?: boolean
  /** Séance cible catalogue / + quand plusieurs séances dans le jour. */
  active?: boolean
  onActivate?: () => void
  onSessionMetaSaved?: Props['onSessionMetaSaved']
  onCompositionSnapshot?: Props['onCompositionSnapshot']
  onDeleteSession?: (sessionId: string, day: number) => void
  onReorderSessionInDay?: (sessionId: string, day: number, direction: -1 | 1) => void
  onCatalogBlockPublished?: Props['onCatalogBlockPublished']
  onCatalogSessionPublished?: Props['onCatalogSessionPublished']
  sessionIndexInDay: number
  sessionsInDay: number
  readOnly?: boolean
  registerCompositionForm?: (sessionId: string, entry: CompositionFormEntry | null) => void
}) {
  const [over, setOver] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [compositionDirty, setCompositionDirty] = useState(false)
  const compositionDirtyRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const editorApiRef = useRef<{
    appendBlock: (id: string) => void
    appendExercise: (id: string) => void
    insertBlockAt: (id: string, index: number) => void
    insertExerciseAt: (id: string, index: number) => void
    awaitPendingForks: () => Promise<void>
    markClean: () => void
    getSlots: () => import('@/src/lib/sessions/constants').SessionSlot[]
    applyServerSlots: (slots: import('@/src/lib/sessions/constants').SessionSlot[]) => void
  } | null>(null)
  const localBlockMetaRef = useRef<
    Record<
      string,
      {
        name: string
        timerSummary?: string | null
        blockNotes?: string | null
        children: {
          id: string
          name: string
          rxSummary?: string | null
          rxSummaryLines?: string[]
        }[]
      }
    >
  >({})
  const [localTitle, setLocalTitle] = useState(session.title)
  const [localNotes, setLocalNotes] = useState(session.notes)
  const [localObjectives, setLocalObjectives] = useState({
    objective_ressenti: session.objective_ressenti !== false,
    objective_note: session.objective_note !== false,
    objective_difficulty: session.objective_difficulty !== false,
  })
  const items = session.items
    .filter((it) => it.kind !== 'rest')
    .slice()
    .sort((a, b) => a.position - b.position)
  const slots = (session.compositionSlots ?? []) as SessionSlot[]
  const contentItemCount = items.length
  const slotsSyncKey = `${session.id}:${slots.map((s) => s.key).join('|')}:${slots.length}`
  const displayTitle = localTitle?.trim() || session.title?.trim() || 'Séance'

  const showCompositionForm = Boolean(compositionEditor)

  useEffect(() => {
    if (!showCompositionForm || !registerCompositionForm) return
    const form = formRef.current
    if (!form) return
    registerCompositionForm(session.id, {
      form,
      dirtyRef: compositionDirtyRef,
      appendBlock: (id) => editorApiRef.current?.appendBlock(id),
      appendExercise: (id) => editorApiRef.current?.appendExercise(id),
      insertBlockAt: (id, index) => editorApiRef.current?.insertBlockAt(id, index),
      insertExerciseAt: (id, index) => editorApiRef.current?.insertExerciseAt(id, index),
      awaitPendingForks: () => editorApiRef.current?.awaitPendingForks() ?? Promise.resolve(),
      markClean: () => editorApiRef.current?.markClean(),
      getSlots: () => editorApiRef.current?.getSlots() ?? [],
      applyServerSlots: (nextSlots) => {
        const prevBlocks = (editorApiRef.current?.getSlots() ?? []).filter(
          (s) => s.kind === 'block',
        )
        editorApiRef.current?.applyServerSlots(nextSlots)
        // Remapper meta locale → nouveaux orphan ids (sinon mode fermé = « Bloc »).
        const nextBlocks = nextSlots.filter((s) => s.kind === 'block')
        const meta = { ...localBlockMetaRef.current }
        for (let i = 0; i < nextBlocks.length; i += 1) {
          const nb = nextBlocks[i]!
          const newId = nb.orphanSessionBlockId
          if (!newId || meta[newId]) continue
          const pb =
            prevBlocks.find(
              (p) =>
                p.orphanSessionBlockId &&
                (p.blockId === nb.blockId ||
                  (!nb.blockId && !p.blockId && prevBlocks.indexOf(p) === i)),
            ) ?? prevBlocks[i]
          const oldId = pb?.orphanSessionBlockId
          if (oldId && meta[oldId]) meta[newId] = meta[oldId]
        }
        localBlockMetaRef.current = meta
      },
    })
    return () => registerCompositionForm(session.id, null)
  }, [session.id, registerCompositionForm, showCompositionForm])

  function publishLiveFromSlots(nextSlots: import('@/src/lib/sessions/constants').SessionSlot[]) {
    if (!onCompositionSnapshot) return
    const blockName = new Map(
      (compositionEditor?.blocks ?? []).map((b) => [b.id, b.name] as const),
    )
    const exoName = new Map(
      (compositionEditor?.exercises ?? []).map((e) => [e.id, e.name] as const),
    )
    const unitById = new Map(
      (compositionEditor?.units ?? []).map((u) => [
        u.id,
        { key: u.key, label: u.label, short_label: u.short_label ?? null },
      ]),
    )
    const blockKids = new Map(
      (compositionEditor?.initialBlockDetails ?? []).map((d) => [
        d.id,
        (d.exercises ?? []).map((ex) => {
          const lines = formatFilledPrescriptionLines(
            (ex.prescriptions ?? []).filter(
              (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
            ),
            unitById,
          )
          return {
            id: ex.exercise_id,
            name: ex.name?.trim() || 'Exercice',
            rxSummary: lines[0] ?? null,
            rxSummaryLines: lines,
          }
        }),
      ]),
    )
    const blockMeta = new Map(
      (compositionEditor?.initialBlockDetails ?? []).map((d) => [
        d.id,
        {
          timerSummary: formatBlockTimerSummary(d.timer_note),
          blockNotes: d.notes?.trim() || null,
        },
      ]),
    )
    const compositionSlots = nextSlots.map((s, i) => ({
      key: s.key || `live-${session.id}-${i}`,
      kind: s.kind,
      blockId: s.blockId,
      orphanSessionBlockId: s.orphanSessionBlockId,
      exerciseId: s.exerciseId,
      restSeconds: s.restSeconds,
      prescriptions: (s.prescriptions ?? []).map((p) => ({
        unit_id: p.unit_id,
        value: String(p.value ?? ''),
        input_mode: p.input_mode,
        group: p.group,
        varies: p.varies,
      })),
    }))
    const items: BuilderSessionItem[] = nextSlots.map((s, i) => {
      if (s.kind === 'rest') {
        return {
          id: compositionSlots[i]!.key,
          kind: 'rest' as const,
          label: 'Pause',
          position: i,
          restSeconds: s.restSeconds ?? 60,
        }
      }
      if (s.kind === 'block') {
        const orphanId = s.orphanSessionBlockId ?? ''
        const libId = s.blockId ?? ''
        const local =
          (orphanId && localBlockMetaRef.current[orphanId]) ||
          (libId && localBlockMetaRef.current[libId]) ||
          undefined
        const fromDetail =
          (orphanId && blockMeta.get(orphanId)) ||
          (libId && blockMeta.get(libId)) ||
          undefined
        const kids =
          local?.children ||
          (orphanId && blockKids.get(orphanId)) ||
          (libId && blockKids.get(libId)) ||
          undefined
        const label =
          local?.name ||
          (orphanId && blockName.get(orphanId)) ||
          (libId && blockName.get(libId)) ||
          'Bloc'
        return {
          id: compositionSlots[i]!.key,
          kind: 'block' as const,
          label,
          position: i,
          timerSummary: local?.timerSummary ?? fromDetail?.timerSummary ?? null,
          blockNotes: local?.blockNotes ?? fromDetail?.blockNotes ?? null,
          children: kids,
        }
      }
      const lines = formatFilledPrescriptionLines(
        (s.prescriptions ?? []).filter(
          (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
        ),
        unitById,
      )
      return {
        id: compositionSlots[i]!.key,
        kind: 'exercise' as const,
        label: (s.exerciseId && exoName.get(s.exerciseId)) || 'Exercice',
        position: i,
        rxSummaryLines: lines,
      }
    })
    onCompositionSnapshot(session.id, {
      items,
      compositionSlots,
      item_count: items.filter((it) => it.kind !== 'rest').length,
      composition_version: session.composition_version ?? 0,
    })
  }

  function handleDirtyChange(dirty: boolean) {
    // Ref sync pour le flush ; setState UI en microtask (évite setState pendant render).
    compositionDirtyRef.current = dirty
    queueMicrotask(() => {
      setCompositionDirty((prev) => (prev === dirty ? prev : dirty))
    })
  }

  useEffect(() => {
    setLocalTitle(session.title)
    setLocalNotes(session.notes)
    setLocalObjectives({
      objective_ressenti: session.objective_ressenti !== false,
      objective_note: session.objective_note !== false,
      objective_difficulty: session.objective_difficulty !== false,
    })
  }, [
    session.id,
    session.title,
    session.notes,
    session.objective_ressenti,
    session.objective_note,
    session.objective_difficulty,
  ])

  return (
    <article
      draggable={!metaOpen}
      onPointerDown={() => onActivate?.()}
      onDragStart={(e) => {
        if (metaOpen) return
        e.stopPropagation()
        e.dataTransfer.setData('text/session-id', session.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        // Composition gère bloc/exo (insert réactif) — ne pas voler le drop → append fin.
        if (
          e.target instanceof Element &&
          e.target.closest('[data-composition-drop]')
        ) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        const types = Array.from(e.dataTransfer.types)
        if (!acceptDropTypes(types)) return
        e.dataTransfer.dropEffect = dropEffectFor(types)
        setOver(true)
        onActivate?.()
      }}
      onDragLeave={(e) => {
        e.stopPropagation()
        setOver(false)
      }}
      onDrop={(e) => {
        if (
          e.target instanceof Element &&
          e.target.closest('[data-composition-drop]')
        ) {
          return
        }
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onActivate?.()
        handleDataTransferDrop(e, day, handlers, session.id)
      }}
      className={`min-w-0 shrink-0 overflow-x-hidden rounded-[var(--radius-lg)] border p-3 pb-2 shadow-da-sm transition ${
        over
          ? 'border-[var(--brand)] bg-[var(--brand)]/5'
          : active && sessionsInDay > 1
            ? 'border-[var(--brand)]/50 bg-[var(--page-bg)] ring-1 ring-[var(--brand)]/25'
            : compositionEditor
              ? 'border-[var(--border)] bg-[var(--page-bg)]'
              : 'border-[var(--border)] bg-[var(--surface)]'
      }`}
    >
      <div
        data-session-header=""
        className="mb-2 flex items-center gap-2 border-b border-[var(--border)] pb-2"
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
          // Header = append fin (bloc / exo / séance catalogue).
          handleDataTransferDrop(e, day, handlers, session.id)
        }}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-[color:var(--fg)]">{displayTitle}</h3>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            {contentItemCount} item{contentItemCount === 1 ? '' : 's'}
            {localNotes?.trim() ? (
              <span className="text-[color:var(--brand)]"> · Note</span>
            ) : null}
          </p>
        </div>
        {/* Même ordre / gap que les blocs ; violet sans contour. */}
        {!readOnly ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--brand)] hover:bg-[var(--brand)]/10 disabled:opacity-40 max-[1099px]:h-11 max-[1099px]:w-11"
            disabled={pending}
            title="Nom, notes, feedback"
            aria-label="Éditer la séance"
            onClick={(e) => {
              e.stopPropagation()
              setMetaOpen(true)
            }}
          >
            <IconEdit size={14} />
          </button>
          {sessionsInDay > 1 ? (
            <div className="flex shrink-0 flex-col" data-no-reorder="">
              <button
                type="button"
                className="inline-flex h-4 w-7 items-center justify-center text-[color:var(--brand)] hover:opacity-80 disabled:opacity-30 max-[1099px]:h-6 max-[1099px]:w-10"
                disabled={pending || sessionIndexInDay <= 0}
                title="Monter la séance"
                aria-label="Monter la séance"
                onClick={(e) => {
                  e.stopPropagation()
                  onReorderSessionInDay?.(session.id, day, -1)
                }}
              >
                <IconCaret dir="up" />
              </button>
              <button
                type="button"
                className="inline-flex h-4 w-7 items-center justify-center text-[color:var(--brand)] hover:opacity-80 disabled:opacity-30 max-[1099px]:h-6 max-[1099px]:w-10"
                disabled={pending || sessionIndexInDay >= sessionsInDay - 1}
                title="Descendre la séance"
                aria-label="Descendre la séance"
                onClick={(e) => {
                  e.stopPropagation()
                  onReorderSessionInDay?.(session.id, day, 1)
                }}
              >
                <IconCaret dir="down" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--brand)] hover:bg-[var(--brand)]/10 disabled:opacity-40 max-[1099px]:h-11 max-[1099px]:w-11"
            disabled={pending}
            title="Retirer la séance"
            aria-label="Retirer la séance"
            onClick={(e) => {
              e.stopPropagation()
              if (!window.confirm('Retirer cette séance ?')) return
              onDeleteSession?.(session.id, day)
            }}
          >
            <IconTrash size={14} />
          </button>
        </div>
        ) : null}
      </div>

      {showCompositionForm && compositionEditor ? (
        <form
          ref={formRef}
          data-composition-form=""
          className="space-y-2"
          onSubmit={(e) => e.preventDefault()}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
        >
          <input type="hidden" name="program_id" value={programId} />
          <input type="hidden" name="week_id" value={weekId} />
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="day" value={String(day)} />
          <input
            type="hidden"
            name="expected_version"
            value={String(session.composition_version ?? 0)}
          />
          <SessionFicheEditor
            key={session.id}
            compositionOnly
            readOnly={readOnly}
            inlineCatalog={inlineCatalog && !readOnly}
            programSessionId={session.id}
            blocks={compositionEditor.blocks}
            exercises={compositionEditor.exercises}
            units={compositionEditor.units}
            blockCatalog={compositionEditor.blockCatalog}
            initialBlockDetails={compositionEditor.initialBlockDetails}
            returnToForNewBlock={`/admin/programs/${programId}`}
            initial={{ slots }}
            onDirtyChange={handleDirtyChange}
            slotsSyncKey={slotsSyncKey}
            onSlotsChange={publishLiveFromSlots}
            onCatalogBlockPublished={onCatalogBlockPublished}
            onBlockDetailUpserted={(detail) => {
              const unitById = new Map(
                (compositionEditor.units ?? []).map((u) => [
                  u.id,
                  { key: u.key, label: u.label, short_label: u.short_label ?? null },
                ]),
              )
              const meta = {
                name: detail.name?.trim() || 'Bloc',
                timerSummary: formatBlockTimerSummary(detail.timer_note),
                blockNotes: detail.notes?.trim() || null,
                children: (detail.exercises ?? []).map((ex) => {
                  const lines = formatFilledPrescriptionLines(
                    (ex.prescriptions ?? []).filter(
                      (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
                    ),
                    unitById,
                  )
                  return {
                    id: ex.exercise_id,
                    name: ex.name?.trim() || 'Exercice',
                    rxSummary: lines[0] ?? null,
                    rxSummaryLines: lines,
                  }
                }),
              }
              localBlockMetaRef.current[detail.id] = meta
              // Clé aussi par library id des slots liés (lookup pre/post fork).
              const slotsNow = editorApiRef.current?.getSlots() ?? slots
              for (const s of slotsNow) {
                if (s.kind !== 'block') continue
                if (
                  s.orphanSessionBlockId === detail.id ||
                  s.blockId === detail.id
                ) {
                  if (s.blockId) localBlockMetaRef.current[s.blockId] = meta
                }
              }
              // Mode fermé lit compositionLive — republier tout de suite.
              publishLiveFromSlots(slotsNow)
            }}
            onRegisterApi={(api) => {
              editorApiRef.current = api
            }}
          />
          <div className="flex items-center justify-end gap-2">
            {compositionDirty ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[color:var(--muted)]">
                {pending ? <FluidSpinner size={10} /> : null}
                S’enregistre à la fermeture du jour
              </span>
            ) : null}
          </div>
        </form>
      ) : (
        <ul className="space-y-1.5">
          {items.length ? (
            items.map((it) => {
              if (it.kind === 'rest') {
                return (
                  <li
                    key={it.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2"
                  >
                    <p className="text-[12px] italic text-[color:var(--muted)]">
                      {formatRestLabel(it.restSeconds ?? 60)}
                    </p>
                  </li>
                )
              }
              const lines = it.rxSummaryLines ?? []
              const blockMetaLine =
                it.kind === 'block' && it.timerSummary?.trim()
                  ? it.timerSummary.trim()
                  : null
              const blockNotes =
                it.kind === 'block' && it.blockNotes?.trim()
                  ? it.blockNotes.trim()
                  : null
              return (
                <li
                  key={it.id}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        it.kind === 'block'
                          ? 'bg-[var(--brand)]/20 text-[var(--brand)]'
                          : 'bg-[var(--accent)] text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                      }`}
                    >
                      {it.kind === 'block' ? 'Bloc' : 'Exo'}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--fg)]">
                      {it.label}
                    </span>
                  </div>
                  {blockMetaLine ? (
                    <p className="mt-1 truncate text-[11px] text-[color:var(--muted)]">
                      {blockMetaLine}
                    </p>
                  ) : null}
                  {blockNotes ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--muted)]">
                      {blockNotes}
                    </p>
                  ) : null}
                  {lines.length ? (
                    <p className="mt-0.5 truncate text-[11px] leading-snug text-[color:var(--muted)]">
                      {lines.join(' · ')}
                    </p>
                  ) : null}
                  {it.kind === 'block' && it.children?.length ? (
                    <ul className="mt-1.5 space-y-1 border-t border-[var(--border)]/60 pt-1.5">
                      {it.children.map((ch) => {
                        const childLines =
                          ch.rxSummaryLines?.length
                            ? ch.rxSummaryLines
                            : ch.rxSummary
                              ? [ch.rxSummary]
                              : []
                        return (
                          <li key={ch.id} className="min-w-0">
                            <p className="truncate text-[11px] text-[color:var(--muted)]">
                              {ch.name}
                            </p>
                            {childLines.length ? (
                              <p className="truncate text-[10px] leading-snug text-[color:var(--muted)]/80">
                                {childLines.join(' · ')}
                              </p>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </li>
              )
            })
          ) : null}
        </ul>
      )}

      {metaOpen ? (
        <ProgramSessionMetaPopup
          mode="edit"
          programId={programId}
          weekId={weekId}
          sessionId={session.id}
          day={day}
          pending={pending}
          onClose={() => setMetaOpen(false)}
          onSaved={(patch, flash) => {
            setLocalTitle(patch.title)
            setLocalNotes(patch.notes)
            setLocalObjectives({
              objective_ressenti: patch.objective_ressenti !== false,
              objective_note: patch.objective_note !== false,
              objective_difficulty: patch.objective_difficulty !== false,
            })
            onSessionMetaSaved?.(session.id, patch, flash)
          }}
          onCatalogPublished={onCatalogSessionPublished}
          defaults={{
            title: localTitle ?? session.title,
            notes: localNotes ?? session.notes,
            objective_ressenti: localObjectives.objective_ressenti,
            objective_note: localObjectives.objective_note,
            objective_difficulty: localObjectives.objective_difficulty,
          }}
        />
      ) : null}
    </article>
  )
}

function formatRestLabel(seconds: number) {
  if (seconds >= 60 && seconds % 60 === 0) return `Pause ${seconds / 60} min`
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `Pause ${m}:${String(s).padStart(2, '0')}`
  }
  return `Pause ${seconds}s`
}

function CompactSessionPreview({ session }: { session: BuilderSession }) {
  // Timeline complète (pauses visibles) — le compteur ignore les rests.
  const timeline = session.items.slice().sort((a, b) => a.position - b.position)
  const contentItems = timeline.filter((it) => it.kind !== 'rest')
  const n =
    typeof session.item_count === 'number' ? session.item_count : contentItems.length
  const hasNote = Boolean(session.notes?.trim())

  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
      <p className="truncate text-[13px] font-semibold text-[color:var(--fg)]">
        {session.title?.trim() || 'Séance'}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-[color:var(--muted)]">
        {n ? `${n} item${n === 1 ? '' : 's'}` : 'Vide'}
        {hasNote ? (
          <span className="text-[color:var(--brand)]"> · Note</span>
        ) : null}
      </p>
      {timeline.length ? (
        <ul className="mt-1.5 space-y-1.5">
          {timeline.map((it) => {
            if (it.kind === 'rest') {
              return (
                <li key={it.id} className="min-w-0">
                  <p className="truncate text-[10px] italic text-[color:var(--muted)]">
                    {formatRestLabel(it.restSeconds ?? 60)}
                  </p>
                </li>
              )
            }
            const lines = it.rxSummaryLines ?? []
            const blockMetaLine =
              it.kind === 'block' && it.timerSummary?.trim()
                ? it.timerSummary.trim()
                : null
            const blockNotes =
              it.kind === 'block' && it.blockNotes?.trim()
                ? it.blockNotes.trim()
                : null
            return (
              <li key={it.id} className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`shrink-0 rounded px-1 py-px text-[10px] font-bold leading-none ${
                      it.kind === 'block'
                        ? 'bg-[var(--brand)]/20 text-[var(--brand)]'
                        : 'bg-[var(--accent)] text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                    }`}
                  >
                    {it.kind === 'block' ? 'Bloc' : 'Exo'}
                  </span>
                  <p className="min-w-0 truncate text-[12px] font-semibold text-[color:var(--fg)]">
                    {it.label}
                  </p>
                </div>
                {blockMetaLine ? (
                  <p className="truncate text-[10px] text-[color:var(--muted)]">
                    {blockMetaLine}
                  </p>
                ) : null}
                {blockNotes ? (
                  <p className="line-clamp-2 text-[10px] leading-snug text-[color:var(--muted)] break-words whitespace-normal">
                    {blockNotes}
                  </p>
                ) : null}
                {lines.length ? (
                  <p className="text-[10px] leading-snug text-[color:var(--muted)] break-words whitespace-normal">
                    {lines.join(' · ')}
                  </p>
                ) : null}
                {it.kind === 'block' && it.children?.length ? (
                  <ul className="mt-0.5 space-y-0.5 pl-1">
                    {it.children.map((ch) => {
                      const childLines =
                        ch.rxSummaryLines?.length
                          ? ch.rxSummaryLines
                          : ch.rxSummary
                            ? [ch.rxSummary]
                            : []
                      return (
                        <li key={ch.id} className="min-w-0">
                          <p className="truncate text-[11px] text-[color:var(--muted)]">
                            · {ch.name}
                          </p>
                          {childLines.length ? (
                            <p className="pl-2 text-[10px] leading-snug text-[color:var(--muted)]/80 break-words whitespace-normal">
                              {childLines.join(' · ')}
                            </p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function chainWheelToPage(el: HTMLElement, deltaY: number) {
  const atTop = el.scrollTop <= 0
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
    const root = document.scrollingElement ?? document.documentElement
    root.scrollTop += deltaY
  }
}

function CompactDayColumn({
  label,
  day,
  sessions,
  dimmed,
  onOpen,
  handlers,
  canRemove,
  onRemove,
  removeDisabled,
}: {
  label: string
  day: number
  sessions: BuilderSession[]
  dimmed?: boolean
  onOpen: () => void
  handlers?: DropHandlers
  canRemove?: boolean
  onRemove?: () => void
  removeDisabled?: boolean
}) {
  const [over, setOver] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const atTop = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        chainWheelToPage(el, e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div
      role="button"
      tabIndex={0}
      data-builder-day-compact=""
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      onDragOver={(e) => {
        if (!handlers) return
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
        if (!handlers) return
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        handleDataTransferDrop(e, day, handlers)
      }}
      className={`flex h-full min-h-0 w-full cursor-pointer flex-col gap-1 rounded-[var(--radius-md)] border border-dashed p-2 text-left transition hover:border-[var(--brand)] max-[1099px]:min-h-[140px] ${
        over
          ? 'border-[var(--brand)] bg-[var(--brand)]/5 opacity-100'
          : dimmed
            ? 'border-[var(--border)] bg-[var(--page-bg)] opacity-70'
            : 'border-[var(--border)] bg-[var(--page-bg)]'
      }`}
    >
      <div className="flex items-center justify-between gap-0.5">
        <p className="min-w-0 truncate text-[13px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
          {label}
        </p>
        {canRemove ? (
          <button
            type="button"
            data-builder-chrome=""
            disabled={removeDisabled}
            title={`Retirer ${label}`}
            aria-label={`Retirer ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[11px] font-bold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)] disabled:opacity-40"
          >
            −
          </button>
        ) : null}
      </div>
      <div
        ref={scrollRef}
        className="da-scrollbar flex h-0 min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-y-contain"
      >
        {sessions.length ? (
          sessions.map((s) => <CompactSessionPreview key={s.id} session={s} />)
        ) : (
          <p className="mt-auto text-center text-[12px] text-[color:var(--muted)]/60">Vide</p>
        )}
      </div>
    </div>
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
  onCollapse,
  onSessionMetaSaved,
  onCompositionSnapshot,
  onDeleteSession,
  onReorderSessionInDay,
  onCatalogBlockPublished,
  onCatalogSessionPublished,
  registerCompositionForm,
  compositionEditor,
  inlineCatalog,
  onOpenSessionIdChange,
  canRemove,
  onRemove,
  readOnly = false,
}: {
  label: string
  day: number
  sessions: BuilderSession[]
  programId: string
  weekId: string
  pending?: boolean
  handlers: DropHandlers
  onCreateSession: (day: number) => void
  /** Tablette / téléphone : fermer le mode jour. */
  onCollapse?: () => void
  onSessionMetaSaved?: Props['onSessionMetaSaved']
  onCompositionSnapshot?: Props['onCompositionSnapshot']
  onDeleteSession?: Props['onDeleteSession']
  onReorderSessionInDay?: Props['onReorderSessionInDay']
  onCatalogBlockPublished?: Props['onCatalogBlockPublished']
  onCatalogSessionPublished?: Props['onCatalogSessionPublished']
  registerCompositionForm?: (sessionId: string, entry: CompositionFormEntry | null) => void
  compositionEditor?: CompositionEditorCatalog | null
  inlineCatalog?: boolean
  onOpenSessionIdChange?: (sessionId: string | null) => void
  canRemove?: boolean
  onRemove?: () => void
  readOnly?: boolean
}) {
  const [over, setOver] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    () => sessions[0]?.id ?? null,
  )

  useEffect(() => {
    setActiveSessionId((prev) => {
      if (prev && sessions.some((s) => s.id === prev)) return prev
      return sessions[0]?.id ?? null
    })
  }, [sessions])

  useEffect(() => {
    onOpenSessionIdChange?.(activeSessionId)
  }, [activeSessionId, onOpenSessionIdChange])

  return (
    <div
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault()
              const types = Array.from(e.dataTransfer.types)
              if (!acceptDropTypes(types)) return
              e.dataTransfer.dropEffect = dropEffectFor(types)
              setOver(true)
            }
      }
      onDragLeave={readOnly ? undefined : () => setOver(false)}
      onDrop={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault()
              setOver(false)
              handleDataTransferDrop(e, day, handlers)
            }
      }
      data-builder-day-focus=""
      className={`flex min-w-0 flex-col gap-3 overflow-x-hidden rounded-[var(--radius-lg)] border p-3 shadow-da-md transition min-[1100px]:h-full min-[1100px]:min-h-0 ${
        over
          ? 'border-[var(--brand)] bg-[var(--brand)]/5'
          : 'border-[var(--brand)] bg-[var(--surface)] ring-1 ring-[var(--brand)]/40'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-base font-bold text-[color:var(--fg)]">{label}</h3>
          {canRemove && !readOnly ? (
            <button
              type="button"
              data-builder-chrome=""
              disabled={pending}
              title={`Retirer ${label}`}
              aria-label={`Retirer ${label}`}
              onClick={onRemove}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[13px] font-bold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)] disabled:opacity-40"
            >
              −
            </button>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!readOnly ? (
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
          ) : null}
          {onCollapse ? (
            <button
              type="button"
              data-builder-chrome=""
              title="Fermer le jour"
              aria-label="Fermer le jour"
              onClick={onCollapse}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[color:var(--muted)] hover:text-[color:var(--fg)] min-[1100px]:hidden"
            >
              <IconClose size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Ordi : viewport fixe, séances en hauteur naturelle (shrink-0) → scroll de l’ensemble. */}
      <div className="da-scrollbar flex min-w-0 flex-col gap-3 overflow-x-hidden min-[1100px]:h-0 min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:overflow-y-auto min-[1100px]:overscroll-y-contain">
        {sessions.length ? (
          sessions.map((s, i) => (
            <ClassicSessionCard
              key={s.id}
              session={s}
              day={day}
              programId={programId}
              weekId={weekId}
              pending={pending}
              handlers={handlers}
              compositionEditor={compositionEditor}
              inlineCatalog={inlineCatalog}
              active={activeSessionId === s.id}
              onActivate={() => setActiveSessionId(s.id)}
              onSessionMetaSaved={onSessionMetaSaved}
              onCompositionSnapshot={onCompositionSnapshot}
              onDeleteSession={onDeleteSession}
              onReorderSessionInDay={onReorderSessionInDay}
              onCatalogBlockPublished={onCatalogBlockPublished}
              onCatalogSessionPublished={onCatalogSessionPublished}
              sessionIndexInDay={i}
              sessionsInDay={sessions.length}
              registerCompositionForm={registerCompositionForm}
              readOnly={readOnly}
            />
          ))
        ) : (
          <div className="flex min-h-[8rem] shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] px-4 text-center text-sm text-[color:var(--muted)]">
            {readOnly ? 'Aucune séance' : 'Glisser un bloc / exo ici → crée une séance « Séance »'}
          </div>
        )}
      </div>
    </div>
  )
}

function maxOccupiedSlot(weekSessions: BuilderSession[]) {
  const byDay = groupSessionsByDay(weekSessions)
  let maxOccupied = -1
  for (let i = 0; i < MAX_SLOTS; i += 1) {
    if ((byDay[i] ?? []).length) maxOccupied = i
  }
  return maxOccupied
}

function weekColumns(
  weekSessions: BuilderSession[],
  focusedDay: number,
  slotColumnCount: number,
) {
  // Slot = journée : multi-séances via le même encodage que le calendrier.
  const byDay = groupSessionsByDay(weekSessions)
  const maxOccupied = maxOccupiedSlot(weekSessions)
  const slotCount = Math.min(
    MAX_SLOTS,
    Math.max(MIN_SLOTS, focusedDay + 1, maxOccupied + 1, slotColumnCount),
  )
  return Array.from({ length: slotCount }, (_, i) => ({
    key: `slot-${i}`,
    index: i,
    label: `Jour ${i + 1}`,
    fullLabel: `Jour ${i + 1}`,
    sessions: byDay[i] ?? ([] as BuilderSession[]),
  }))
}

const CATALOG_WIDTH_PX = 320 // 20rem
const CATALOG_GAP_PX = 4
/** Jours non sélectionnés (mode expanded) — largeur lisible sans shrinker le focus. */
const SIDE_DAY_COL_CLASS =
  'w-[8.75rem] shrink-0 min-[1100px]:w-[10.5rem]'

/**
 * Place le catalogue en overlay à côté du jour focus, toujours clampé
 * dans le cadre semaine — sans déplacer les colonnes jours.
 */
function placeCatalogInBoard(
  board: DOMRect,
  focus: DOMRect,
  catalogWidth = CATALOG_WIDTH_PX,
  gap = CATALOG_GAP_PX,
): { left: number } {
  const spaceLeft = focus.left - board.left - gap
  const spaceRight = board.right - focus.right - gap
  const preferLeft = spaceLeft >= spaceRight
  let left = preferLeft
    ? focus.left - board.left - gap - catalogWidth
    : focus.right - board.left + gap
  const maxLeft = Math.max(0, board.width - catalogWidth)
  left = Math.min(Math.max(0, left), maxLeft)
  return { left }
}

/**
 * Décale le scroll horizontal pour que le jour focus laisse la place au
 * catalogue (priorité à droite), sans shrinker focus ni catalogue.
 * Utile surtout ~1100–1150px où le clamp overlay chevauchait sinon.
 * Remet toujours scrollLeft à 0 s’il y a assez de place (évite décalage résiduel).
 */
function scrollFocusToFitCatalog(
  daysRow: HTMLElement,
  board: DOMRect,
  focus: DOMRect,
  catalogWidth = CATALOG_WIDTH_PX,
  gap = CATALOG_GAP_PX,
) {
  const need = catalogWidth + gap
  const spaceRight = board.right - focus.right - gap
  if (spaceRight >= need) {
    if (daysRow.scrollLeft !== 0) daysRow.scrollLeft = 0
    return
  }

  // Pousse le focus vers la gauche pour libérer le catalogue à droite —
  // sans jamais faire sortir le bord gauche du jour hors du board.
  const delta = need - spaceRight
  const maxDelta = Math.max(0, focus.left - board.left)
  const applied = Math.min(delta, maxDelta)
  if (applied <= 0) return
  const next = Math.min(
    daysRow.scrollWidth - daysRow.clientWidth,
    Math.max(0, daysRow.scrollLeft + applied),
  )
  if (next !== daysRow.scrollLeft) daysRow.scrollLeft = next
}

function isBuilderDesktopViewport() {
  return window.matchMedia(`(min-width: ${BUILDER_DESKTOP_MIN_PX}px)`).matches
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
  onCollapse,
  onCompositionAutosaved,
  onCompositionSnapshot,
  onSessionMetaSaved,
  onDeleteSession,
  onReorderSessionInDay,
  onRemoveSlotDay,
  onCatalogBlockPublished,
  onCatalogSessionPublished,
  registerCompositionApi,
  onExpandedOpenSessionIdChange,
  pending,
  readOnly = false,
}: Props) {
  const handlers: DropHandlers = {
    onDropLibrarySession,
    onDropLibraryBlock,
    onDropLibraryExercise,
    onMoveProgramSession,
  }
  const isTablet = useBuilderTabletLayout()
  const isPhone = useBuilderPhoneLayout()

  const occupiedSlot = useMemo(() => maxOccupiedSlot(weekSessions), [weekSessions])
  const occupiedFloor = Math.max(MIN_SLOTS, occupiedSlot + 1)
  const [slotColumnCount, setSlotColumnCount] = useState(() =>
    Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, occupiedFloor, focusedDay + 1)),
  )
  const [removeDayConfirm, setRemoveDayConfirm] = useState<number | null>(null)
  const [removingDay, setRemovingDay] = useState(false)
  const weekBoardRef = useRef<HTMLDivElement>(null)
  const focusColRef = useRef<HTMLDivElement>(null)
  const [catalogStyle, setCatalogStyle] = useState<CSSProperties | null>(null)

  useEffect(() => {
    setSlotColumnCount((c) =>
      Math.min(MAX_SLOTS, Math.max(c, occupiedFloor, focusedDay + 1)),
    )
  }, [occupiedFloor, focusedDay])

  useLayoutEffect(() => {
    const boardEl = weekBoardRef.current
    const daysRow = boardEl?.querySelector<HTMLElement>('[data-expanded-days-row]')

    // matchMedia sync (pas isTablet React) : évite un frame où isTablet=false
    // sous 1100px → scrollFocusToFitCatalog laisse un scrollLeft résiduel.
    const desktop = isBuilderDesktopViewport()
    if (!expanded || !catalogOverlay || !desktop) {
      setCatalogStyle(null)
      if (daysRow && daysRow.scrollLeft !== 0) daysRow.scrollLeft = 0
      return
    }
    const focusEl = focusColRef.current
    if (!boardEl || !focusEl) return

    function place() {
      const board = boardEl!.getBoundingClientRect()
      const focusBox = focusEl!.getBoundingClientRect()
      if (board.width < 8 || focusBox.width < 8) return
      const { left } = placeCatalogInBoard(board, focusBox)
      setCatalogStyle({ left })
    }

    function placeAndFit() {
      if (!isBuilderDesktopViewport()) {
        setCatalogStyle(null)
        if (daysRow && daysRow.scrollLeft !== 0) daysRow.scrollLeft = 0
        return
      }
      place()
      if (!daysRow) return
      const board = boardEl!.getBoundingClientRect()
      const focusBox = focusEl!.getBoundingClientRect()
      if (board.width < 8 || focusBox.width < 8) return
      scrollFocusToFitCatalog(daysRow, board, focusBox)
      place()
    }

    placeAndFit()

    const ro = new ResizeObserver(placeAndFit)
    ro.observe(boardEl)
    ro.observe(focusEl)
    window.addEventListener('resize', placeAndFit)
    // Reposition catalogue au scroll ; ne pas re-forcer le fit (sinon combat le scroll manuel).
    daysRow?.addEventListener('scroll', place, { passive: true })
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', placeAndFit)
      daysRow?.removeEventListener('scroll', place)
    }
  }, [expanded, catalogOverlay, focusedDay, weekSessions, slotColumnCount])

  useEffect(() => {
    if (!expanded || !isPhone) return
    const pill = document.querySelector<HTMLElement>(
      `[data-builder-day-pill][data-day="${focusedDay}"]`,
    )
    const scroller = pill?.parentElement
    if (!pill || !scroller) return
    // Scroll manuel du rail de pastilles uniquement (pas scrollIntoView → évite de bouger le board).
    const left =
      pill.offsetLeft - Math.max(0, (scroller.clientWidth - pill.offsetWidth) / 2)
    scroller.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [expanded, isPhone, focusedDay])

  const canAddSlot = !isCalendar && slotColumnCount < MAX_SLOTS
  const canRemoveDays = !isCalendar && slotColumnCount > MIN_SLOTS

  function addSlotColumn() {
    if (!canAddSlot) return
    setSlotColumnCount((c) => Math.min(MAX_SLOTS, c + 1))
  }

  function requestRemoveDay(day: number) {
    if (!canRemoveDays || removingDay || pending) return
    const sessions = groupSessionsByDay(weekSessions)[day] ?? []
    if (sessions.length > 0) {
      setRemoveDayConfirm(day)
      return
    }
    void applyRemoveDay(day)
  }

  async function applyRemoveDay(day: number) {
    if (removingDay) return
    setRemovingDay(true)
    try {
      const byDay = groupSessionsByDay(weekSessions)
      const needsServer = Array.from({ length: MAX_SLOTS }, (_, i) => i).some(
        (i) => i >= day && (byDay[i] ?? []).length > 0,
      )
      if (needsServer) {
        if (!onRemoveSlotDay) return
        const ok = await onRemoveSlotDay(day)
        if (!ok) return
      }
      const nextCount = Math.max(MIN_SLOTS, slotColumnCount - 1)
      setSlotColumnCount(nextCount)
      // Focus : le shell a déjà décalé si needsServer ; sinon on ajuste ici.
      if (!needsServer) {
        if (focusedDay > day) onFocusDay(focusedDay - 1)
        else if (focusedDay >= nextCount) onFocusDay(Math.max(0, nextCount - 1))
      } else if (focusedDay >= nextCount) {
        onFocusDay(Math.max(0, nextCount - 1))
      }
    } finally {
      setRemovingDay(false)
    }
  }

  function confirmRemoveSlotColumn() {
    const day = removeDayConfirm
    setRemoveDayConfirm(null)
    if (day == null) return
    void applyRemoveDay(day)
  }

  const slotAddControl =
    !isCalendar && !readOnly ? (
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={!canAddSlot || pending || removingDay}
          title={canAddSlot ? 'Ajouter une journée' : 'Maximum 6 journées'}
          aria-label="Ajouter une journée"
          onClick={addSlotColumn}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[13px] font-bold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)] disabled:opacity-40"
        >
          +
        </button>
      </div>
    ) : null

  const compositionFormsRef = useRef(new Map<string, CompositionFormEntry>())
  const flushInflightRef = useRef<Promise<FlushResult> | null>(null)
  const onCompositionAutosavedRef = useRef(onCompositionAutosaved)
  onCompositionAutosavedRef.current = onCompositionAutosaved
  const onCompositionSnapshotRef = useRef(onCompositionSnapshot)
  onCompositionSnapshotRef.current = onCompositionSnapshot

  const registerCompositionForm = useCallback(
    (sessionId: string, entry: CompositionFormEntry | null) => {
      if (!entry) compositionFormsRef.current.delete(sessionId)
      else compositionFormsRef.current.set(sessionId, entry)
    },
    [],
  )

  function snapshotFormComposition(form: HTMLFormElement, compositionVersion?: number) {
    const sessionId = String(formDataSessionId(form) ?? '').trim()
    if (!sessionId || !onCompositionSnapshotRef.current) return
    const parsed = parseSessionCompositionFormData(new FormData(form))
    const blockName = new Map(
      (compositionEditor?.blocks ?? []).map((b) => [b.id, b.name] as const),
    )
    const exoName = new Map(
      (compositionEditor?.exercises ?? []).map((e) => [e.id, e.name] as const),
    )
    const unitById = new Map(
      (compositionEditor?.units ?? []).map((u) => [
        u.id,
        { key: u.key, label: u.label, short_label: u.short_label ?? null },
      ]),
    )
    const blockKids = new Map(
      (compositionEditor?.initialBlockDetails ?? []).map((d) => [
        d.id,
        (d.exercises ?? []).map((ex) => {
          const lines = formatFilledPrescriptionLines(
            (ex.prescriptions ?? []).filter(
              (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
            ),
            unitById,
          )
          return {
            id: ex.exercise_id,
            name: ex.name?.trim() || 'Exercice',
            rxSummary: lines[0] ?? null,
            rxSummaryLines: lines,
          }
        }),
      ]),
    )
    const blockMeta = new Map(
      (compositionEditor?.initialBlockDetails ?? []).map((d) => [
        d.id,
        {
          timerSummary: formatBlockTimerSummary(d.timer_note),
          blockNotes: d.notes?.trim() || null,
        },
      ]),
    )

    const compositionSlots = parsed.map((s, i) => ({
      key: `live-${sessionId}-${i}-${s.kind}-${s.blockId ?? s.exerciseId ?? s.orphanSessionBlockId ?? 'x'}`,
      kind: s.kind,
      blockId: s.blockId,
      orphanSessionBlockId: s.orphanSessionBlockId,
      exerciseId: s.exerciseId,
      restSeconds: s.restSeconds,
      prescriptions: (s.prescriptions ?? []).map((p) => ({
        unit_id: p.unit_id,
        value: String(p.value ?? ''),
        input_mode: p.input_mode,
        group: p.group,
        varies: p.varies,
      })),
    }))
    const items: BuilderSessionItem[] = parsed.map((s, i) => {
      if (s.kind === 'rest') {
        return {
          id: compositionSlots[i]!.key,
          kind: 'rest' as const,
          label: 'Pause',
          position: i,
          restSeconds: s.restSeconds ?? 60,
        }
      }
      if (s.kind === 'block') {
        const orphanId = s.orphanSessionBlockId ?? ''
        const libId = s.blockId ?? ''
        const fromDetail =
          (orphanId && blockMeta.get(orphanId)) ||
          (libId && blockMeta.get(libId)) ||
          undefined
        const kids =
          (orphanId && blockKids.get(orphanId)) ||
          (libId && blockKids.get(libId)) ||
          undefined
        const label =
          (orphanId && blockName.get(orphanId)) ||
          (libId && blockName.get(libId)) ||
          'Bloc'
        return {
          id: compositionSlots[i]!.key,
          kind: 'block' as const,
          label,
          position: i,
          timerSummary: fromDetail?.timerSummary ?? null,
          blockNotes: fromDetail?.blockNotes ?? null,
          children: kids,
        }
      }
      const lines = formatFilledPrescriptionLines(
        (s.prescriptions ?? []).filter(
          (p) => p?.unit_id && String(p.value ?? '').trim() !== '',
        ),
        unitById,
      )
      return {
        id: compositionSlots[i]!.key,
        kind: 'exercise' as const,
        label: (s.exerciseId && exoName.get(s.exerciseId)) || 'Exercice',
        position: i,
        rxSummaryLines: lines,
      }
    })
    onCompositionSnapshotRef.current(sessionId, {
      items,
      compositionSlots,
      item_count: items.filter((it) => it.kind !== 'rest').length,
      ...(compositionVersion != null ? { composition_version: compositionVersion } : {}),
    })
  }

  function applyExpectedVersion(form: HTMLFormElement, version: number) {
    const input = form.querySelector<HTMLInputElement>('input[name="expected_version"]')
    if (input) input.value = String(version)
  }

  const hasDirtyCompositions = useCallback(() => {
    return [...compositionFormsRef.current.values()].some((e) => e.dirtyRef.current)
  }, [])

  const flushDirtyCompositions = useCallback(async (): Promise<FlushResult> => {
    if (flushInflightRef.current) return flushInflightRef.current
    const run = (async (): Promise<FlushResult> => {
      // Forks en cours avant lecture FormData (sinon orphan manquant / doublon).
      await Promise.all(
        [...compositionFormsRef.current.values()].map((e) => e.awaitPendingForks?.() ?? Promise.resolve()),
      )
      // Rien à sauver → sortie immédiate (fermeture jour fluide).
      if (![...compositionFormsRef.current.values()].some((e) => e.dirtyRef.current)) {
        return { ok: true, saved: false }
      }
      // Laisser React commit les slots (création bloc / fork) avant FormData.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

      const versions: Record<string, number> = {}
      let savedAny = false
      // Boucle : dirty apparu pendant un save (drop pendant flush) → 2e passe.
      for (let pass = 0; pass < 3; pass += 1) {
        const dirty = [...compositionFormsRef.current.entries()].filter(
          ([, e]) => e.dirtyRef.current,
        )
        if (!dirty.length) break
        for (const [sessionId, { form, dirtyRef, markClean, getSlots, applyServerSlots }] of dirty) {
          if (!form.isConnected) {
            window.alert('Enregistrement interrompu — rouvre le jour et réessaie.')
            return { ok: false }
          }
          const fd = new FormData(form)
          // Source de vérité = slots React (DOM hidden fields peuvent être en retard).
          if (getSlots) {
            fd.set('slots_json', JSON.stringify(getSlots()))
          }
          let res = await saveProgramSessionCompositionQuietAction(fd)
          // Version locale périmée après un save précédent sans refresh RSC → resync + 1 retry.
          if (!res.ok && res.stale && res.version != null) {
            applyExpectedVersion(form, res.version)
            fd.set('expected_version', String(res.version))
            if (getSlots) {
              fd.set('slots_json', JSON.stringify(getSlots()))
            }
            res = await saveProgramSessionCompositionQuietAction(fd)
          }
          if (!res.ok) {
            window.alert(
              (() => {
                const t = String(res.error || '').trim()
                if (
                  !t ||
                  t.toLowerCase().includes('<html') ||
                  t.toLowerCase().includes('bad gateway') ||
                  t.toLowerCase().includes('502')
                ) {
                  return 'Enregistrement impossible — réessaie dans un instant.'
                }
                return t
              })(),
            )
            return { ok: false }
          }
          dirtyRef.current = false
          if (res.version != null) {
            applyExpectedVersion(form, res.version)
            versions[sessionId] = res.version
          }
          // Snapshot DB (nouveaux orphan ids) — rebase éditeur AVANT markClean.
          if (res.composition) {
            const serverSlots = (res.composition.compositionSlots ?? []).map((s) => ({
              key: s.key,
              kind: s.kind,
              blockId: s.blockId,
              orphanSessionBlockId: s.orphanSessionBlockId,
              exerciseId: s.exerciseId,
              restSeconds: s.restSeconds,
              prescriptions: s.prescriptions ?? [],
            }))
            applyServerSlots?.(serverSlots)
            onCompositionSnapshotRef.current?.(sessionId, {
              items: res.composition.items,
              compositionSlots: res.composition.compositionSlots,
              item_count: res.composition.item_count,
              composition_version: res.version ?? res.composition.composition_version,
            })
          } else {
            markClean?.()
            snapshotFormComposition(form, res.version)
          }
          savedAny = true
        }
      }
      if (!savedAny) return { ok: true, saved: false }
      onCompositionAutosavedRef.current?.()
      return { ok: true, saved: true, versions }
    })()
    flushInflightRef.current = run
    try {
      return await run
    } finally {
      flushInflightRef.current = null
    }
  }, [compositionEditor])

  const appendToOpenSession = useCallback(
    (
      sessionId: string,
      kind: 'block' | 'exercise',
      catalogId: string,
      index?: number,
    ) => {
      const entry = compositionFormsRef.current.get(sessionId)
      if (!entry) return false
      if (kind === 'block') {
        if (index != null) {
          if (!entry.insertBlockAt) return false
          entry.insertBlockAt(catalogId, index)
          return true
        }
        if (!entry.appendBlock) return false
        entry.appendBlock(catalogId)
        return true
      }
      if (index != null) {
        if (!entry.insertExerciseAt) return false
        entry.insertExerciseAt(catalogId, index)
        return true
      }
      if (!entry.appendExercise) return false
      entry.appendExercise(catalogId)
      return true
    },
    [],
  )

  useEffect(() => {
    registerCompositionApi?.({
      flush: flushDirtyCompositions,
      hasDirty: hasDirtyCompositions,
      appendToOpenSession,
    })
    return () => registerCompositionApi?.(null)
  }, [registerCompositionApi, flushDirtyCompositions, hasDirtyCompositions, appendToOpenSession])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const dirty = [...compositionFormsRef.current.values()].some((x) => x.dirtyRef.current)
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (!expanded || !onCollapse) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target
      if (!(t instanceof Element)) return
      // Ne pas fermer le jour si une modale portail est ouverte (tel : tap « fantôme »).
      if (document.querySelector('[data-builder-chrome][role="dialog"]')) return
      if (
        t.closest(
          '[data-builder-day-focus],[data-builder-catalog],[data-builder-day-compact],[data-builder-chrome],[data-builder-day-pill],[role="dialog"],.da-vv-overlay',
        )
      ) {
        return
      }
      onCollapse()
    }
    // Capture : fiable même si un enfant stopPropagation en bubble.
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [expanded, onCollapse])

  const columns = isCalendar
    ? DAY_LABELS.map((label, i) => ({
        key: label,
        index: i,
        label,
        fullLabel: DAY_FULL[i] ?? label,
        sessions: groupSessionsByDay(weekSessions)[i] ?? [],
      }))
    : weekColumns(weekSessions, focusedDay, slotColumnCount)

  const removeConfirmPortal =
    removeDayConfirm != null && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="da-vv-overlay z-[9999]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-day-title"
            data-builder-chrome=""
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-black/50" aria-hidden />
            <div className="da-vv-dialog absolute left-1/2 top-1/2 z-10 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
              <div className="border-b border-[var(--border)] px-4 py-3">
                <h2
                  id="remove-day-title"
                  className="text-sm font-bold text-[color:var(--fg)]"
                >
                  Retirer Jour {removeDayConfirm + 1} ?
                </h2>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm text-[color:var(--muted)]">
                  Ses séances seront définitivement supprimées.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setRemoveDayConfirm(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={removingDay}
                    onClick={confirmRemoveSlotColumn}
                  >
                    {removingDay ? 'Retrait…' : 'Retirer'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  if (!expanded) {
    // CSS-first : desktop grille · tablette scroll X · téléphone pile verticale (pas de branche JS).
    return (
      <>
        <div className="flex h-full min-h-[440px] items-stretch gap-2 overflow-hidden max-[767px]:max-h-[min(78vh,720px)] max-[767px]:min-h-[320px] max-[767px]:flex-col max-[767px]:overflow-y-auto">
          <div
            className="da-scrollbar grid h-full min-h-0 min-w-0 flex-1 gap-2 max-[1099px]:flex max-[1099px]:h-auto max-[1099px]:overflow-x-auto max-[1099px]:overflow-y-hidden max-[767px]:min-h-0 max-[767px]:flex-col max-[767px]:overflow-x-hidden max-[767px]:overflow-y-visible"
            style={{
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gridAutoRows: 'minmax(0, 1fr)',
            }}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex h-full min-h-0 min-w-0 flex-col max-[1099px]:h-auto max-[1099px]:w-[8.75rem] max-[1099px]:shrink-0 max-[1099px]:min-w-[8.75rem] max-[767px]:min-h-[7.5rem] max-[767px]:w-full max-[767px]:min-w-0"
              >
                <CompactDayColumn
                  label={col.label}
                  day={col.index}
                  sessions={col.sessions}
                  handlers={handlers}
                  onOpen={() => onFocusDay(col.index)}
                  canRemove={canRemoveDays}
                  removeDisabled={pending || removingDay}
                  onRemove={() => requestRemoveDay(col.index)}
                />
              </div>
            ))}
          </div>
          {slotAddControl ? (
            <div className="flex flex-col items-center justify-start gap-1 pt-1 max-[767px]:justify-center max-[767px]:pb-1 max-[767px]:pt-0.5">
              {slotAddControl}
            </div>
          ) : null}
        </div>
        {removeConfirmPortal}
      </>
    )
  }

  const before = columns.filter((c) => c.index < focusedDay)
  const focus = columns.find((c) => c.index === focusedDay) ?? columns[0]!
  const after = columns.filter((c) => c.index > focusedDay)

  return (
    <>
      {/* Pas de rangée au-dessus : même gap titre→board qu’en mode calendrier.
          Ordi : hauteur viewport pour scroller les séances dans le jour. */}
      <div className="relative flex min-h-[520px] flex-col max-[767px]:min-h-[420px] min-[1100px]:h-full min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:overflow-hidden">
        {/* Tablette / téléphone : pastilles jours (catalogue = picker en bas de séance) */}
        <div
          data-builder-chrome=""
          className="mb-2 flex shrink-0 items-center gap-1.5 min-[1100px]:hidden"
        >
          <div className="da-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
            {columns.map((col) => {
              const active = col.index === focusedDay
              return (
                <button
                  key={col.key}
                  type="button"
                  data-builder-day-pill=""
                  data-day={col.index}
                  onClick={() => onFocusDay(col.index)}
                  title={col.fullLabel}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition max-[767px]:px-2 max-[767px]:py-0.5 max-[767px]:text-[10px] ${
                    active
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-da-sm'
                      : 'bg-[var(--accent)] text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]'
                  }`}
                >
                  {col.label}
                </button>
              )
            })}
            {!isCalendar && !readOnly ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!canAddSlot || pending || removingDay}
                  title={canAddSlot ? 'Ajouter une journée' : 'Maximum 6 journées'}
                  aria-label="Ajouter une journée"
                  onClick={addSlotColumn}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[13px] font-bold text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div ref={weekBoardRef} className="relative min-[1100px]:min-h-0 min-[1100px]:flex-1 min-[1100px]:overflow-hidden">
          {/* Ordi : fond cliquable pour sortir du mode jour (les colonnes restent pointer-events-auto). */}
          {/* Hit-target ordi : les vides entre colonnes passent ici (row = pointer-events-none). */}
          {onCollapse ? (
            <div
              aria-hidden
              className="absolute inset-0 z-0 hidden min-[1100px]:block"
            />
          ) : null}
          {/* Structure DOM stable (SSR = client) : colonnes latérales masquées en CSS sous 1100px. */}
          <div
            data-expanded-days-row=""
            className="da-scrollbar relative z-10 flex items-start gap-2 overflow-x-auto max-[1099px]:overflow-x-hidden min-[1100px]:h-full min-[1100px]:min-h-0 min-[1100px]:items-stretch min-[1100px]:pointer-events-none"
          >
            {before.map((col) => (
              <div
                key={col.key}
                className={`${SIDE_DAY_COL_CLASS} max-[1099px]:hidden min-[1100px]:h-full min-[1100px]:pointer-events-auto`}
              >
                <CompactDayColumn
                  label={col.label}
                  day={col.index}
                  sessions={col.sessions}
                  dimmed
                  handlers={handlers}
                  onOpen={() => onFocusDay(col.index)}
                  canRemove={canRemoveDays}
                  removeDisabled={pending || removingDay}
                  onRemove={() => requestRemoveDay(col.index)}
                />
              </div>
            ))}

            <div
              ref={focusColRef}
              className="relative z-10 flex w-full min-w-0 flex-1 flex-col overflow-x-hidden max-[1099px]:max-w-full min-[1100px]:h-full min-[1100px]:min-h-0 min-[1100px]:w-[32rem] min-[1100px]:max-w-full min-[1100px]:flex-none min-[1100px]:shrink-0 min-[1100px]:pointer-events-auto"
            >
              <ExpandedDayColumn
                label={focus.fullLabel}
                day={focus.index}
                sessions={focus.sessions}
                programId={programId}
                weekId={weekId}
                pending={pending || removingDay}
                handlers={handlers}
                onCreateSession={onCreateSession}
                onCollapse={onCollapse}
                onSessionMetaSaved={onSessionMetaSaved}
                onCompositionSnapshot={onCompositionSnapshot}
                onDeleteSession={onDeleteSession}
                onReorderSessionInDay={onReorderSessionInDay}
                onCatalogBlockPublished={onCatalogBlockPublished}
                onCatalogSessionPublished={onCatalogSessionPublished}
                registerCompositionForm={registerCompositionForm}
                compositionEditor={compositionEditor}
                inlineCatalog={isTablet && !readOnly}
                onOpenSessionIdChange={onExpandedOpenSessionIdChange}
                canRemove={canRemoveDays && !readOnly}
                onRemove={() => requestRemoveDay(focus.index)}
                readOnly={readOnly}
              />
            </div>

            {after.map((col) => (
              <div
                key={col.key}
                className={`${SIDE_DAY_COL_CLASS} max-[1099px]:hidden min-[1100px]:pointer-events-auto`}
              >
                <CompactDayColumn
                  label={col.label}
                  day={col.index}
                  sessions={col.sessions}
                  dimmed
                  handlers={handlers}
                  onOpen={() => onFocusDay(col.index)}
                  canRemove={canRemoveDays}
                  removeDisabled={pending || removingDay}
                  onRemove={() => requestRemoveDay(col.index)}
                />
              </div>
            ))}

            {slotAddControl ? (
              <div className="hidden shrink-0 flex-col items-center justify-start gap-1 pt-1 min-[1100px]:pointer-events-auto min-[1100px]:flex">
                {slotAddControl}
              </div>
            ) : null}
          </div>

          {/* Desktop : catalogue collé au jour focus (tablette = picker bas de séance). */}
          {catalogOverlay && catalogStyle && !isTablet ? (
            <div
              data-builder-catalog=""
              className="pointer-events-auto absolute top-0 z-30 hidden h-full w-[20rem] max-w-[20rem] min-[1100px]:flex"
              style={catalogStyle}
            >
              {catalogOverlay}
            </div>
          ) : null}
        </div>
      </div>
      {removeConfirmPortal}
    </>
  )
}
