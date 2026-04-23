'use client'

import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import type { ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useProgramEditorUrlState } from '../lib/useProgramEditorUrlState'
import { IconDuplicate, IconEdit, IconTrash } from './ui/icons'

type WeekRow = {
  id: string
  title: string
  week_order: number
  notes?: string | null
}

function SortableSessionCard({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (isDragging: boolean, attrs: Record<string, unknown>, listeners: Record<string, unknown>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !!disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 }}
    >
      {children(
        isDragging,
        (attributes as unknown as Record<string, unknown>) ?? {},
        (listeners as unknown as Record<string, unknown>) ?? {}
      )}
    </div>
  )
}

function LibraryExerciseDraggable({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="flex h-12 items-center overflow-hidden rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-[var(--brand)] transition"
      style={{ opacity: isDragging ? 0 : 1 }}
    >
      <div className="truncate">{label}</div>
    </div>
  )
}

function DropMarker({ id, tall, active, noTop }: { id: string; tall?: boolean; active?: boolean; noTop?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const showActive = isOver || active
  return (
    <div ref={setNodeRef} className={noTop ? 'px-3 -mt-2' : 'px-3'}>
      <div
        className={noTop ? 'h-0' : tall ? 'h-12' : 'h-2'}
        style={{ marginTop: noTop ? 0 : 0, marginBottom: noTop ? 0 : 0, background: 'transparent' }}
      />
      <div
        className={noTop && !showActive ? 'h-0' : tall ? 'h-12' : 'h-2'}
        style={{
          marginTop: noTop ? 0 : 0,
          marginBottom: noTop && !showActive ? 0 : 0,
          background: showActive ? 'rgba(0,0,0,0.08)' : 'transparent',
          borderRadius: 9999,
        }}
      />
    </div>
  )
}

function BlockEditorDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'block-editor-dropzone' })
  return (
    <div ref={setNodeRef} className={isOver ? 'rounded-2xl outline outline-2 outline-[var(--brand)]' : 'rounded-2xl'}>
      {children}
    </div>
  )
}

function isInteractiveDndTarget(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return true
  const editable = (el as HTMLElement).isContentEditable
  if (editable) return true
  return !!(el as HTMLElement).closest?.('input,textarea,select,option,[contenteditable=true]')
}

class SmartPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        const target = nativeEvent.target as Element | null
        if (isInteractiveDndTarget(target)) return false
        return true
      },
    },
  ]
}

function TimelineNeutralDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'timeline-dropzone' })
  return <div ref={setNodeRef} className={active ? 'absolute inset-0' : 'pointer-events-none absolute inset-0'} />
}

function LibraryNeutralDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'library-dropzone' })
  return <div ref={setNodeRef} className={active ? 'absolute inset-0' : 'pointer-events-none absolute inset-0'} />
}

function PaletteNeutralDropZone({ active }: { active: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'palette-dropzone' })
  return <div ref={setNodeRef} className={active ? 'absolute inset-0' : 'pointer-events-none absolute inset-0'} />
}

function PaletteDraggable({ id, label, meta }: { id: string; label: string; meta: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2 active:cursor-grabbing"
    >
      <div className="text-sm font-semibold text-[var(--brand)]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-gray-500">{meta}</div>
    </div>
  )
}

function PaletteStatic({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="text-sm font-semibold text-[var(--brand)]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-gray-500">{meta}</div>
    </div>
  )
}

function PaletteDragPreview({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
      <div className="text-sm font-semibold text-[var(--brand)]">{label}</div>
      <div className="mt-0.5 text-xs font-semibold text-gray-500">Bloc</div>
    </div>
  )
}

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

type ProgramExerciseRow = {
  id: string
  session_id: string
  name?: string | null
  exercise_order: number
  sets: number | null
  reps: number | null
  rest_time: string | null
  rpe: number | null
  tempo: string | null
  load: string | null
  notes: string | null
  exercise_library: { name: string } | null
}

type SessionBlockRow = {
  id: string
  program_session_id: string
  position: number
  type: string
  title: string | null
  notes: string | null
}

type BlockExerciseRow = {
  id: string
  session_block_id: string
  position: number
  exercise_id: string | null
  exercise_name: string | null
  sets: number | null
  reps: number | null
  load_text: string | null
  rest_seconds: number | null
  notes: string | null
  exercise_library?: { name: string } | null
}

type SessionItemRow = {
  id: string
  session_id: string
  position: number
  kind: string
  program_exercise_id: string | null
  session_block_id: string | null
}

type Props = {
  weeks: WeekRow[]
  sessions: SessionRow[]
  sessionItems: SessionItemRow[]
  sessionBlocks: SessionBlockRow[]
  blockExercises: BlockExerciseRow[]
  programExercises: ProgramExerciseRow[]
  exerciseLibrary?: { id: string; name: string | null; muscle_group?: string | null }[]
  muscleGroups?: string[]
  openWeek?: string
  openSession?: string
  openBlockId?: string
  renderBlockEditor?: ReactNode
  addWeekAction?: (
    formData: FormData
  ) => Promise<void | { newWeekId?: string | null; week_order?: number | null; title?: string | null; notes?: string | null }>
  addSessionAction?: (formData: FormData) => Promise<void | { newSessionId?: string | null }>
  deleteWeekAction?: (formData: FormData) => Promise<void>
  duplicateWeekAction?: (formData: FormData) => Promise<void>
  deleteSessionAction?: (formData: FormData) => Promise<void>
  duplicateSessionAction?: (formData: FormData) => Promise<void | { newSessionId?: string | null }>
  addBlockExerciseAction?: (formData: FormData) => Promise<void | { newBlockExerciseId?: string | null; position?: number | null }>
  deleteBlockAction?: (formData: FormData) => Promise<void>
  duplicateBlockAction?: (formData: FormData) => Promise<void | { newBlockId?: string | null }>
  updateBlockAction?: (formData: FormData) => Promise<void>
  deleteProgramExerciseAction?: (formData: FormData) => Promise<void>
  updateProgramExerciseAction?: (formData: FormData) => Promise<void>
  duplicateProgramExerciseAction?: (formData: FormData) => Promise<void | { newProgramExerciseId?: string | null; newSessionItemId?: string | null }>
  updateSessionItemsOrderAction?: (formData: FormData) => Promise<void>
  updateSessionsOrderAction?: (formData: FormData) => Promise<void>
  insertSessionItemBlockAtPositionAction?: (formData: FormData) => Promise<{ newBlockId?: string | null; newSessionItemId?: string | null } | void>
  insertSessionItemExerciseAtPositionAction?: (formData: FormData) => Promise<
    { newProgramExerciseId?: string | null; newSessionItemId?: string | null } | void
  >

  updateWeekMetaAction?: (formData: FormData) => Promise<void>
  updateSessionMetaAction?: (formData: FormData) => Promise<void>
}

type TimelineItem =
  | {
      kind: 'exercise'
      sessionId: string
      sortKey: number
      id: string
      programExerciseId: string | null
      title: string
      subtitle: string | null
      sets: number | null
      reps: number | null
      rest_time: string | null
      rpe: number | null
      tempo: string | null
      load: string | null
    }
  | {
      kind: 'block'
      sessionId: string
      sortKey: number
      id: string
      blockId: string
      title: string
      subtitle: string | null
    }


function SortableTimelineRow({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (isDragging: boolean) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !!disabled })
  return (
    <div
      ref={setNodeRef}
      className="w-full max-w-full min-w-0"
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 }}
      {...(attributes as unknown as Record<string, unknown>)}
      {...(listeners as unknown as Record<string, unknown>)}
    >
      {children(isDragging)}
    </div>
  )
}

export default function ProgramStructureTimelineV2Client(props: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const [openAddPanel, setOpenAddPanel] = useState<null | { sessionId: string; kind: 'exercise' | 'block' }>(null)
  const [addExerciseQuery, setAddExerciseQuery] = useState('')
  const [addExerciseMuscle, setAddExerciseMuscle] = useState('')
  const [addBlockUiType, setAddBlockUiType] = useState<'warmup' | 'crossfit' | 'superset'>('warmup')
  const [addBlockTitle, setAddBlockTitle] = useState('')
  const lastOverIdRef = useRef<string | null>(null)
  const [activeDropMarkerId, setActiveDropMarkerId] = useState<string | null>(null)
  const [libraryQuery, setLibraryQuery] = useState<string>('')
  const [libraryMuscle, setLibraryMuscle] = useState<string>('')
  const [optimisticExerciseById, setOptimisticExerciseById] = useState<
    Record<
      string,
      {
        title: string
        notes: string | null
        sets: number | null
        reps: number | null
        rest_time: string | null
        rpe: number | null
        tempo: string | null
        load: string | null
      }
    >
  >({})
  const [editingProgramExerciseId, setEditingProgramExerciseId] = useState<string | null>(null)
  const [editSets, setEditSets] = useState<string>('')
  const [editReps, setEditReps] = useState<string>('')
  const [editRestTime, setEditRestTime] = useState<string>('')
  const [editRpe, setEditRpe] = useState<string>('')
  const [editTempo, setEditTempo] = useState<string>('')
  const [editLoad, setEditLoad] = useState<string>('')
  const [editExerciseNotes, setEditExerciseNotes] = useState<string>('')
  const [savingProgramExerciseId, setSavingProgramExerciseId] = useState<string | null>(null)
  const [optimisticBlockTitleById, setOptimisticBlockTitleById] = useState<Record<string, string>>({})
  const [optimisticBlockNotesById, setOptimisticBlockNotesById] = useState<Record<string, string>>({})
  const [optimisticBlockExercisesByBlockId, setOptimisticBlockExercisesByBlockId] = useState<Record<string, BlockExerciseRow[]>>({})
  const [optimisticSessionBlocksById, setOptimisticSessionBlocksById] = useState<Record<string, SessionBlockRow>>({})
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState<string>('')
  const [editNotes, setEditNotes] = useState<string>('')
  const [savingBlockId, setSavingBlockId] = useState<string | null>(null)
  const saveEditExerciseRef = useRef<null | ((item: TimelineItem & { kind: 'exercise' }, opts?: { skipRefresh?: boolean }) => void)>(null)
  const [editingWeekId, setEditingWeekId] = useState<string | null>(null)
  const [editWeekTitle, setEditWeekTitle] = useState<string>('')
  const [editWeekNotes, setEditWeekNotes] = useState<string>('')
  const [savingWeekId, setSavingWeekId] = useState<string | null>(null)

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editSessionTitle, setEditSessionTitle] = useState<string>('')
  const [editSessionNotes, setEditSessionNotes] = useState<string>('')
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null)
  const pendingInsertBySessionRef = useRef<
    Record<
      string,
      {
        tmpSessionItemId: string
        tmpBlockId: string
        newSessionItemId: string | null
        newBlockId: string | null
      }
    >
  >({})
  const pendingDuplicateBlockIdRef = useRef<
    Record<
      string,
      { sessionId: string; tmpSessionItemId: string; tmpBlockId: string; newBlockId: string | null; sourceSessionItemId: string | null }
    >
  >({})
  const pendingDesiredOrderBySessionRef = useRef<Record<string, string[]>>({})
  const sessionItemsLocalRef = useRef<Record<string, SessionItemRow[]> | null>(null)
  const lastRowClickRef = useRef<{ id: string | null; t: number }>({ id: null, t: 0 })

  const urlState = useProgramEditorUrlState({ openSession: props.openSession, openBlock: props.openBlockId ?? undefined })
  const effectiveOpenBlockId = urlState.openBlockId
  const isTimelineDndDisabled = Boolean(effectiveOpenBlockId || editingProgramExerciseId || editingBlockId)
  const isDndDisabled = Boolean(editingProgramExerciseId || editingBlockId)
  const isSessionDndDisabled = Boolean(isDndDisabled || editingWeekId || editingSessionId)

  const pendingDuplicateSessionRef = useRef<Record<string, { weekId: string; tmpSessionId: string }>>({})
  const didClearInitialOpenBlockRef = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!mounted) return

    if (didClearInitialOpenBlockRef.current) return
    didClearInitialOpenBlockRef.current = true

    if (urlState.openBlockId) {
      urlState.setOpenBlockId(null, { preserveScroll: true })
    }
  }, [mounted, urlState])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onBlockUpdated = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; title?: string; notes?: string }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      if (!blockId) return
      const title = String(e.detail?.title ?? '')
      const notes = String(e.detail?.notes ?? '')

      setOptimisticBlockTitleById((prev) => ({ ...prev, [blockId]: title }))
      setOptimisticBlockNotesById((prev) => ({ ...prev, [blockId]: notes }))
    }

    window.addEventListener('program:block-editor:block-updated', onBlockUpdated as EventListener)
    return () => {
      window.removeEventListener('program:block-editor:block-updated', onBlockUpdated as EventListener)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const getServerList = (blockId: string) => {
      const out: BlockExerciseRow[] = []
      for (const be of props.blockExercises ?? []) {
        if (String(be.session_block_id) !== blockId) continue
        out.push(be)
      }
      out.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      return out
    }

    const onUpsert = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; row?: BlockExerciseRow }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      const row = e.detail?.row
      if (!blockId || !row) return

      setOptimisticBlockExercisesByBlockId((prev) => {
        const base = prev[blockId] ? prev[blockId] : getServerList(blockId)
        const merged = base.concat([row])
        const byId = new Map<string, BlockExerciseRow>()
        for (const r of merged) byId.set(r.id, r)
        const nextList = Array.from(byId.values()).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        return { ...prev, [blockId]: nextList }
      })
    }

    const onReconcile = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; tmpId?: string; newId?: string; position?: number }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      const tmpId = String(e.detail?.tmpId ?? '').trim()
      const newId = String(e.detail?.newId ?? '').trim()
      const position = e.detail?.position
      if (!blockId || !tmpId || !newId) return

      setOptimisticBlockExercisesByBlockId((prev) => {
        const base = prev[blockId] ? prev[blockId] : getServerList(blockId)
        const nextList = base.map((r) => {
          if (r.id !== tmpId) return r
          return { ...r, id: newId, position: typeof position === 'number' ? position : r.position }
        })
        const byId = new Map<string, BlockExerciseRow>()
        for (const r of nextList) byId.set(r.id, r)
        const deduped = Array.from(byId.values()).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        return { ...prev, [blockId]: deduped }
      })
    }

    const onDeleted = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; id?: string }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      const id = String(e.detail?.id ?? '').trim()
      if (!blockId || !id) return

      setOptimisticBlockExercisesByBlockId((prev) => {
        const base = prev[blockId] ? prev[blockId] : getServerList(blockId)
        const nextList = (base ?? []).filter((r) => r.id !== id)
        return { ...prev, [blockId]: nextList }
      })
    }

    window.addEventListener('program:block-editor:block-exercise-upsert', onUpsert as EventListener)
    window.addEventListener('program:block-editor:block-exercise-reconcile', onReconcile as EventListener)
    window.addEventListener('program:block-editor:block-exercise-deleted', onDeleted as EventListener)

    const onSnapshot = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; rows?: BlockExerciseRow[] }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      const rows = e.detail?.rows
      if (!blockId || !rows) return
      setOptimisticBlockExercisesByBlockId((prev) => {
        const base = prev[blockId] ? prev[blockId] : getServerList(blockId)
        const baseById = new Map<string, BlockExerciseRow>()
        for (const r of base ?? []) baseById.set(String(r.id), r)

        const merged = rows.map((r) => {
          const existing = baseById.get(String(r.id))
          if (!existing) return r
          const nextNotes = r.notes == null || String(r.notes).trim() === '' ? existing.notes : r.notes
          const nextLib = r.exercise_library ?? existing.exercise_library
          const nextName = r.exercise_name ?? existing.exercise_name
          return { ...existing, ...r, notes: nextNotes, exercise_library: nextLib, exercise_name: nextName }
        })

        return { ...prev, [blockId]: merged.slice() }
      })
    }
    window.addEventListener('program:block-editor:block-exercises-snapshot', onSnapshot as EventListener)

    return () => {
      window.removeEventListener('program:block-editor:block-exercise-upsert', onUpsert as EventListener)
      window.removeEventListener('program:block-editor:block-exercise-reconcile', onReconcile as EventListener)
      window.removeEventListener('program:block-editor:block-exercise-deleted', onDeleted as EventListener)
      window.removeEventListener('program:block-editor:block-exercises-snapshot', onSnapshot as EventListener)
    }
  }, [props.blockExercises])

  const refreshPreserveScroll = useCallback(() => {
    const y = typeof window !== 'undefined' ? window.scrollY : 0
    router.refresh()
    if (typeof window !== 'undefined') {
      const restore = () => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
      window.setTimeout(() => {
        restore()
        window.requestAnimationFrame(() => {
          restore()
          window.requestAnimationFrame(() => {
            restore()
          })
        })
        window.setTimeout(() => restore(), 50)
      }, 0)
    }
  }, [router])

  const restoreScrollY = useCallback((y: number | null) => {
    if (typeof window === 'undefined') return
    if (y == null) return
    const restore = () => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
    window.setTimeout(() => {
      restore()
      window.requestAnimationFrame(() => {
        restore()
        window.requestAnimationFrame(() => {
          restore()
        })
      })
      window.setTimeout(() => restore(), 50)
    }, 0)
  }, [])

  const setOpenBlockInUrl = useCallback(
    (nextBlockId: string | null, nextSessionId?: string | null) => {
      urlState.setOpenBlockId(nextBlockId, { preserveScroll: true, sessionId: nextSessionId })
    },
    [urlState]
  )

  function cancelEditExercise() {
    setEditingProgramExerciseId(null)
  }

  function beginEditExercise(item: TimelineItem & { kind: 'exercise' }) {
    if (!props.updateProgramExerciseAction) return
    const peId = item.programExerciseId
    if (!peId) return
    if (String(peId).startsWith('tmp-pe-')) return

    setEditingProgramExerciseId(peId)
    setEditSets(item.sets != null ? String(item.sets) : '')
    setEditReps(item.reps != null ? String(item.reps) : '')
    setEditRestTime(item.rest_time != null ? String(item.rest_time) : '')
    setEditRpe(item.rpe != null ? String(item.rpe) : '')
    setEditTempo(item.tempo != null ? String(item.tempo) : '')
    setEditLoad(item.load != null ? String(item.load) : '')
    setEditExerciseNotes(item.subtitle != null ? String(item.subtitle) : '')

    setEditingBlockId(null)
    setOpenBlockInUrl(null, item.sessionId)
  }

  function beginEditBlock(blockId: string) {
    if (!props.updateBlockAction) return
    if (!blockId) return

    setEditingProgramExerciseId(null)
    setEditingBlockId(null)

    const exists = (() => {
      const byId = new Map<string, SessionBlockRow>()
      for (const b of props.sessionBlocks) byId.set(String(b.id), b)
      for (const b of Object.values(optimisticSessionBlocksById)) byId.set(String(b.id), b)
      return byId.has(String(blockId))
    })()
    if (!exists) {
      const title = String(optimisticBlockTitleById[String(blockId)] ?? '').trim() || 'Bloc'
      const notesRaw = optimisticBlockNotesById[String(blockId)]
      const notes = notesRaw != null ? String(notesRaw) : null
      const sessionId = String(openSessionId ?? '')
      if (sessionId) {
        setOptimisticSessionBlocksById((prev) => ({
          ...prev,
          [String(blockId)]: {
            id: String(blockId),
            program_session_id: sessionId,
            position: 0,
            type: 'strength',
            title,
            notes,
          },
        }))
      }
    }

    setOpenBlockInUrl(String(blockId), openSessionId)
  }

  function addExerciseToOpenBlock(exerciseId: string) {
    if (!props.addBlockExerciseAction) return
    const blockId = effectiveOpenBlockId
    if (!blockId) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('program:block-editor:add-exercise', {
          detail: { exerciseId: String(exerciseId) },
        })
      )
      return
    }

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_block_id', String(blockId))
    fd.set('exercise_id', String(exerciseId))

    startTransition(async () => {
      try {
        await props.addBlockExerciseAction?.(fd)
      } finally {
        restoreScrollY(y)
      }
    })
  }

  const blockExercisesByBlockId = useMemo(() => {
    const out: Record<string, BlockExerciseRow[]> = {}
    for (const be of props.blockExercises ?? []) {
      const key = String(be.session_block_id)
      out[key] = out[key] ?? []
      out[key].push(be)
    }
    for (const [blockId, list] of Object.entries(optimisticBlockExercisesByBlockId)) {
      out[blockId] = list
    }
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return out
  }, [optimisticBlockExercisesByBlockId, props.blockExercises])

  const mergedBlockExercises = useMemo(() => {
    const byId = new Map<string, BlockExerciseRow>()
    for (const list of Object.values(blockExercisesByBlockId)) {
      for (const row of list) byId.set(String(row.id), row)
    }
    return Array.from(byId.values())
  }, [blockExercisesByBlockId])

  useEffect(() => {
    // When server blockExercises catch up for a block, drop the optimistic overlay to prevent stale data.
    const optimisticKeys = Object.keys(optimisticBlockExercisesByBlockId)
    if (optimisticKeys.length === 0) return
    const serverByBlockId: Record<string, Map<string, BlockExerciseRow>> = {}
    for (const be of props.blockExercises ?? []) {
      const blockId = String(be.session_block_id)
      serverByBlockId[blockId] = serverByBlockId[blockId] ?? new Map<string, BlockExerciseRow>()
      serverByBlockId[blockId].set(String(be.id), be)
    }

    const toClear = optimisticKeys.filter((blockId) => {
      const optimisticList = optimisticBlockExercisesByBlockId[blockId] ?? []
      const serverRows = serverByBlockId[blockId] ?? null
      if (!serverRows) return false

      const nonTmpIds = optimisticList
        .map((r) => String(r.id))
        .filter((id) => id && !id.startsWith('tmp-'))
      if (nonTmpIds.length === 0) return false

      for (const id of nonTmpIds) {
        const serverRow = serverRows.get(id) ?? null
        if (!serverRow) return false
        const optimisticRow = optimisticList.find((r) => String(r.id) === id) ?? null
        if (!optimisticRow) return false

        const serverNotes = String(serverRow.notes ?? '').trim()
        const optimisticNotes = String(optimisticRow.notes ?? '').trim()
        if (serverNotes !== optimisticNotes) return false
      }
      return true
    })
    if (toClear.length === 0) return
    setOptimisticBlockExercisesByBlockId((prev) => {
      const copy = { ...prev }
      for (const k of toClear) delete copy[k]
      return copy
    })
  }, [optimisticBlockExercisesByBlockId, props.blockExercises])

  const activeInsertIndex = useMemo(() => {
    if (!activeDropMarkerId) return null
    const raw = activeDropMarkerId.replace('drop-marker:', '')
    const idx = Number.parseInt(raw, 10)
    if (!Number.isFinite(idx)) return null
    return idx
  }, [activeDropMarkerId])
  const [optimisticWeeks, setOptimisticWeeks] = useState<WeekRow[]>([])
  const [optimisticSessions, setOptimisticSessions] = useState<SessionRow[]>([])
  const [optimisticDeletedWeekIds, setOptimisticDeletedWeekIds] = useState<Set<string>>(() => new Set())
  const [optimisticDeletedSessionIds, setOptimisticDeletedSessionIds] = useState<Set<string>>(() => new Set())

  const weeksSignature = useMemo(() => {
    return (props.weeks ?? []).map((w) => `${w.id}:${w.week_order}:${w.title}:${String(w.notes ?? '')}`).join('|')
  }, [props.weeks])

  const sessionsSignature = useMemo(() => {
    return (props.sessions ?? [])
      .map((s) => `${s.id}:${s.week_id}:${s.session_order}:${s.title}:${String(s.description ?? '')}`)
      .join('|')
  }, [props.sessions])

  useEffect(() => {
    setOptimisticWeeks([])
    setOptimisticDeletedWeekIds(new Set())
  }, [weeksSignature])

  useEffect(() => {
    setOptimisticSessions([])
    setOptimisticDeletedSessionIds(new Set())
  }, [sessionsSignature])

  const effectiveWeeks = useMemo(() => {
    const base = (props.weeks ?? []).filter((w) => !optimisticDeletedWeekIds.has(String(w.id)))
    const merged = base.concat(optimisticWeeks)
    const byId = new Map<string, WeekRow>()
    for (const w of merged) {
      byId.set(String(w.id), w)
    }
    return Array.from(byId.values())
  }, [optimisticDeletedWeekIds, optimisticWeeks, props.weeks])

  const effectiveSessions = useMemo(() => {
    const base = (props.sessions ?? []).filter((s) => !optimisticDeletedSessionIds.has(String(s.id)))
    const merged = base.concat(optimisticSessions)
    const byId = new Map<string, SessionRow>()
    for (const s of merged) {
      byId.set(String(s.id), s)
    }
    return Array.from(byId.values())
  }, [optimisticDeletedSessionIds, optimisticSessions, props.sessions])

  const sessionsByWeek = useMemo(() => {
    const out: Record<string, SessionRow[]> = {}
    for (const s of effectiveSessions) {
      const list = out[s.week_id] ?? []
      list.push(s)
      out[s.week_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
    }
    return out
  }, [effectiveSessions])

  const exercisesBySession = useMemo(() => {
    const out: Record<string, ProgramExerciseRow[]> = {}
    for (const pe of props.programExercises) {
      const list = out[pe.session_id] ?? []
      list.push(pe)
      out[pe.session_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.exercise_order ?? 0) - (b.exercise_order ?? 0))
    }
    return out
  }, [props.programExercises])

  const effectiveSessionBlocks = useMemo(() => {
    const byId = new Map<string, SessionBlockRow>()
    for (const b of props.sessionBlocks) byId.set(String(b.id), b)
    for (const b of Object.values(optimisticSessionBlocksById)) byId.set(String(b.id), b)
    return Array.from(byId.values())
  }, [optimisticSessionBlocksById, props.sessionBlocks])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!mounted) return
    if (!effectiveOpenBlockId) return
    if (!urlState.openSessionId) return

    const b = effectiveSessionBlocks.find((row) => String(row.id) === String(effectiveOpenBlockId)) ?? null
    if (!b) return
    if (String(b.program_session_id) !== String(urlState.openSessionId)) {
      urlState.setOpenBlockId(null, { preserveScroll: true })
    }
  }, [effectiveOpenBlockId, effectiveSessionBlocks, mounted, urlState])

  const blocksBySession = useMemo(() => {
    const out: Record<string, SessionBlockRow[]> = {}
    for (const b of effectiveSessionBlocks) {
      const list = out[b.program_session_id] ?? []
      list.push(b)
      out[b.program_session_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return out
  }, [effectiveSessionBlocks])

  const orderedWeeks = useMemo(() => {
    return effectiveWeeks.slice().sort((a, b) => (a.week_order ?? 0) - (b.week_order ?? 0))
  }, [effectiveWeeks])

  const [openWeekId, setOpenWeekId] = useState<string | null>(() => {
    if (props.openWeek) return props.openWeek
    return null
  })

  const [openSessionId, setOpenSessionId] = useState<string | null>(() => {
    if (props.openSession) return props.openSession
    return null
  })

  const duplicateWeek = useCallback(
    (weekId: string) => {
      if (!props.duplicateWeekAction) return

      const source = effectiveWeeks.find((w) => w.id === weekId) ?? null
      if (source) {
        const tmpWeekId = `tmp-week-${crypto.randomUUID()}`
        const maxOrder = Math.max(-1, ...orderedWeeks.map((w) => w.week_order ?? 0))
        setOptimisticWeeks((prev) =>
          prev.concat([
            {
              id: tmpWeekId,
              title: `${String(source.title ?? '').trim() || 'Semaine'} (copie)`,
              week_order: maxOrder + 1,
              notes: source.notes ?? null,
            },
          ])
        )
        setOpenWeekId(tmpWeekId)
      }

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)
      startTransition(async () => {
        try {
          await props.duplicateWeekAction?.(fd)
        } finally {
          refreshPreserveScroll()
        }
      })
    },
    [openSessionId, openWeekId, props, refreshPreserveScroll, startTransition]
  )

  const deleteWeek = useCallback(
    (weekId: string) => {
      if (!props.deleteWeekAction) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      setOptimisticDeletedWeekIds((prev) => {
        const next = new Set(prev)
        next.add(String(weekId))
        return next
      })

      if (openWeekId === weekId) {
        setOpenWeekId(null)
      }

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)
      startTransition(async () => {
        try {
          await props.deleteWeekAction?.(fd)
        } finally {
          restoreScrollY(y)
        }
      })
    },
    [openSessionId, openWeekId, props, restoreScrollY, startTransition]
  )

  const duplicateSession = useCallback(
    (weekId: string, sessionId: string) => {
      if (!props.duplicateSessionAction) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      const source = effectiveSessions.find((s) => s.id === sessionId) ?? null
      if (source) {
        const tmpSessionId = `tmp-session-${crypto.randomUUID()}`
        const sourceOrder = source.session_order ?? 0
        const siblings = (effectiveSessions ?? [])
          .filter((s) => String(s.week_id) === String(weekId))
          .slice()
          .sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
        const sourceIdx = siblings.findIndex((s) => String(s.id) === String(sessionId))
        const next = sourceIdx >= 0 ? siblings[sourceIdx + 1] ?? null : null
        const nextOrder = next?.session_order ?? null
        const insertOrder =
          typeof nextOrder === 'number' && Number.isFinite(nextOrder) ? (Number(sourceOrder) + Number(nextOrder)) / 2 : Number(sourceOrder) + 1
        setOptimisticSessions((prev) => {
          const insert: SessionRow = {
            id: tmpSessionId,
            week_id: weekId,
            title: `${String(source.title ?? '').trim() || 'Séance'} (copie)`,
            description: source.description ?? null,
            session_order: insertOrder,
          }
          return prev.concat([insert])
        })

        pendingDuplicateSessionRef.current[tmpSessionId] = { weekId, tmpSessionId }
      }

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      fd.set('session_id', sessionId)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)
      startTransition(async () => {
        try {
          const res = (await props.duplicateSessionAction?.(fd)) as void | { newSessionId?: string | null }
          const newSessionId = res && typeof res === 'object' ? (res.newSessionId ?? null) : null
          if (newSessionId) {
            const tmpSessionId = Object.keys(pendingDuplicateSessionRef.current).find(
              (k) => pendingDuplicateSessionRef.current[k]?.weekId === weekId
            )
            if (tmpSessionId) {
              setOptimisticSessions((prev) => prev.map((s) => (String(s.id) === String(tmpSessionId) ? { ...s, id: newSessionId } : s)))
              delete pendingDuplicateSessionRef.current[tmpSessionId]
            }
          }
        } finally {
          restoreScrollY(y)
        }
      })
    },
    [effectiveSessions, openSessionId, openWeekId, props, restoreScrollY, startTransition]
  )

  const deleteSession = useCallback(
    (weekId: string, sessionId: string) => {
      if (!props.deleteSessionAction) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      setOptimisticDeletedSessionIds((prev) => {
        const next = new Set(prev)
        next.add(String(sessionId))
        return next
      })

      if (openSessionId === sessionId) {
        setOpenSessionId(null)
        window.setTimeout(() => urlState.setOpenSessionId(null, { preserveScroll: true }), 0)
      }

      restoreScrollY(y)

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      fd.set('session_id', sessionId)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)
      startTransition(async () => {
        try {
          await props.deleteSessionAction?.(fd)
        } finally {
          restoreScrollY(y)
        }
      })
    },
    [openSessionId, openWeekId, props, restoreScrollY, startTransition, urlState]
  )

  const [closedSessionId, setClosedSessionId] = useState<string | null>(null)

  const skipNextUrlOpenSessionSyncRef = useRef(false)

  useEffect(() => {
    if (!urlState.openSessionId) return
    if (skipNextUrlOpenSessionSyncRef.current) {
      skipNextUrlOpenSessionSyncRef.current = false
      return
    }
    setOpenSessionId(urlState.openSessionId)
    setClosedSessionId(null)
  }, [urlState.openSessionId])

  const saveWeekMeta = useCallback(
    (weekId: string) => {
      if (!props.updateWeekMetaAction) return
      if (editingWeekId !== weekId) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      const title = editWeekTitle.trim()
      const notes = editWeekNotes.trim()

      setSavingWeekId(weekId)
      setEditingWeekId(null)

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      fd.set('title', title)
      fd.set('notes', notes)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)

      startTransition(async () => {
        try {
          await props.updateWeekMetaAction?.(fd)
        } finally {
          setSavingWeekId(null)
          restoreScrollY(y)
        }
      })
    },
    [editWeekNotes, editWeekTitle, editingWeekId, openSessionId, openWeekId, props, restoreScrollY, savingWeekId, startTransition]
  )

  const saveSessionMeta = useCallback(
    (weekId: string, sessionId: string) => {
      if (!props.updateSessionMetaAction) return
      if (savingSessionId) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      const title = editSessionTitle.trim()
      const notes = editSessionNotes.trim()

      setSavingSessionId(sessionId)
      setEditingSessionId(null)

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('week_id', weekId)
      fd.set('session_id', sessionId)
      fd.set('title', title)
      fd.set('notes', notes)
      if (openWeekId) fd.set('openWeek', openWeekId)
      if (openSessionId) fd.set('openSession', openSessionId)

      startTransition(async () => {
        try {
          await props.updateSessionMetaAction?.(fd)
        } finally {
          setSavingSessionId(null)
          restoreScrollY(y)
        }
      })
    },
    [editSessionNotes, editSessionTitle, openSessionId, openWeekId, props, restoreScrollY, savingSessionId, startTransition]
  )

  const sensors = useSensors(useSensor(SmartPointerSensor, { activationConstraint: { distance: 10 } }))

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length) return pointerCollisions
    const rectCollisions = rectIntersection(args)
    if (rectCollisions.length) return rectCollisions
    return closestCenter(args)
  }

  function parseMmSsToSeconds(value: string): number | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null
    const parts = raw.split(':')
    if (parts.length !== 2) return null
    const mm = Number.parseInt(parts[0] || '0', 10)
    const ss = Number.parseInt(parts[1] || '0', 10)
    if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null
    if (mm < 0 || ss < 0) return null
    return mm * 60 + ss
  }

  function formatSecondsToMmSs(totalSeconds: number): string {
    const clamped = Math.max(0, Math.floor(totalSeconds))
    const mm = Math.floor(clamped / 60)
    const ss = clamped % 60
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  function stepNumberString(current: string, delta: number, opts?: { min?: number; max?: number }) {
    const n = Number.parseInt(String(current ?? '').trim() || '0', 10)
    const base = Number.isFinite(n) ? n : 0
    const nextRaw = base + delta
    const next = Math.max(opts?.min ?? -Infinity, Math.min(opts?.max ?? Infinity, nextRaw))
    return String(next)
  }

  function stepLoadString(current: string, delta: number) {
    const raw = String(current ?? '').trim()
    const n = Number.parseFloat(raw.replace(',', '.'))
    const base = Number.isFinite(n) ? n : 0
    const next = Math.max(0, base + delta)
    if (Number.isInteger(next)) return String(next)
    return String(next)
  }

  const filteredExerciseLibrary = useMemo(() => {
    const base = (props.exerciseLibrary ?? []).slice()
    const q = libraryQuery.trim().toLowerCase()
    const muscle = libraryMuscle.trim().toLowerCase()

    return base.filter((ex) => {
      const name = String(ex.name ?? '').trim().toLowerCase()
      const exMuscle = String(ex.muscle_group ?? '').trim().toLowerCase()
      const okName = !q || name.includes(q)
      const okMuscle = !muscle || exMuscle === muscle
      return okName && okMuscle
    })
  }, [libraryMuscle, libraryQuery, props.exerciseLibrary])

  const filteredAddExerciseLibrary = useMemo(() => {
    const base = (props.exerciseLibrary ?? []).slice()
    const q = addExerciseQuery.trim().toLowerCase()
    const muscle = addExerciseMuscle.trim().toLowerCase()

    return base.filter((ex) => {
      const name = String(ex.name ?? '').trim().toLowerCase()
      const exMuscle = String(ex.muscle_group ?? '').trim().toLowerCase()
      const okName = !q || name.includes(q)
      const okMuscle = !muscle || exMuscle === muscle
      return okName && okMuscle
    })
  }, [addExerciseMuscle, addExerciseQuery, props.exerciseLibrary])

  const exerciseLibraryNameById = useMemo(() => {
    const out: Record<string, string> = {}
    for (const ex of props.exerciseLibrary ?? []) {
      out[String(ex.id)] = String(ex.name ?? '').trim()
    }
    return out
  }, [props.exerciseLibrary])

  const [sessionItemsLocal, setSessionItemsLocal] = useState<Record<string, SessionItemRow[]>>(() => {
    const out: Record<string, SessionItemRow[]> = {}
    for (const row of props.sessionItems ?? []) {
      const list = out[row.session_id] ?? []
      list.push(row)
      out[row.session_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return out
  })

  useEffect(() => {
    sessionItemsLocalRef.current = sessionItemsLocal
  }, [sessionItemsLocal])

  useEffect(() => {
    const entries = Object.entries(pendingDuplicateBlockIdRef.current)
    if (entries.length === 0) return

    const blocksSet = new Set((props.sessionBlocks ?? []).map((b) => b.id))
    const sessionItems = props.sessionItems ?? []
    for (const [key, v] of entries) {
      if (!v.newBlockId) continue
      if (!blocksSet.has(v.newBlockId)) continue

      const serverSessionItemId =
        sessionItems.find((r) => String(r.session_id) === String(v.sessionId) && r.kind === 'block' && r.session_block_id === v.newBlockId)?.id ??
        null
      if (!serverSessionItemId) continue

      if (effectiveOpenBlockId && String(effectiveOpenBlockId) === String(v.tmpBlockId) && v.newBlockId) {
        const y = typeof window !== 'undefined' ? window.scrollY : null
        setOpenBlockInUrl(String(v.newBlockId), String(v.sessionId))
        restoreScrollY(y)
      }

      if (serverSessionItemId && props.updateSessionItemsOrderAction) {
        const local = sessionItemsLocalRef.current?.[v.sessionId] ?? []
        const orderedIds = local
          .map((r) => (r.id === v.tmpSessionItemId ? serverSessionItemId : r.id))
          .filter((id) => id && !String(id).startsWith('tmp-'))
        if (orderedIds.length) {
          const fd = new FormData()
          fd.set('client', '1')
          fd.set('session_id', String(v.sessionId))
          fd.set('ordered_ids_json', JSON.stringify(orderedIds))
          startTransition(async () => {
            try {
              await props.updateSessionItemsOrderAction?.(fd)
            } finally {
            }
          })
        }

        pendingDesiredOrderBySessionRef.current[v.sessionId] = orderedIds
      }

      setSessionItemsLocal((prev) => {
        const next: Record<string, SessionItemRow[]> = { ...prev }
        const list = (next[v.sessionId] ?? []).slice()
        next[v.sessionId] = list.map((r) => {
          if (r.kind !== 'block') return r
          const isTarget = r.id === v.tmpSessionItemId || r.session_block_id === v.tmpBlockId
          if (!isTarget) return r
          return {
            ...r,
            id: serverSessionItemId ?? r.id,
            session_block_id: v.newBlockId as string,
          }
        })
        return next
      })

      setOptimisticBlockTitleById((prev) => {
        const copy = { ...prev }
        const title = copy[v.tmpBlockId]
        if (title != null) copy[v.newBlockId as string] = title
        delete copy[v.tmpBlockId]
        return copy
      })

      setOptimisticBlockNotesById((prev) => {
        const copy = { ...prev }
        const notes = copy[v.tmpBlockId]
        if (notes != null) copy[v.newBlockId as string] = notes
        delete copy[v.tmpBlockId]
        return copy
      })

      setOptimisticBlockExercisesByBlockId((prev) => {
        const copy = { ...prev }
        const list = copy[v.tmpBlockId]
        if (list) {
          copy[v.newBlockId as string] = list.map((be) => ({ ...be, session_block_id: v.newBlockId as string }))
        }
        delete copy[v.tmpBlockId]
        return copy
      })

      delete pendingDuplicateBlockIdRef.current[key]
    }
  }, [props.sessionBlocks, props.sessionItems, props.updateSessionItemsOrderAction, startTransition])

  const [sessionItemsDirtyBySession, setSessionItemsDirtyBySession] = useState<Record<string, boolean>>({})

  const sessionItemsSignature = useMemo(() => {
    return (props.sessionItems ?? [])
      .map((r) => `${r.id}:${r.session_id}:${r.kind}:${String(r.position ?? '')}:${String(r.program_exercise_id ?? '')}:${String(r.session_block_id ?? '')}`)
      .join('|')
  }, [props.sessionItems])

  useEffect(() => {
    setSessionItemsLocal((prev) => {
      const next: Record<string, SessionItemRow[]> = { ...prev }
      const bySession: Record<string, SessionItemRow[]> = {}
      for (const row of props.sessionItems ?? []) {
        const list = bySession[row.session_id] ?? []
        list.push(row)
        bySession[row.session_id] = list
      }
      for (const key of Object.keys(bySession)) {
        bySession[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      }
      for (const [sessionId, list] of Object.entries(bySession)) {
        const pending = pendingInsertBySessionRef.current[sessionId]
        if (!sessionItemsDirtyBySession[sessionId] && !pending) {
          next[sessionId] = list
        }
      }
      return next
    })
  }, [sessionItemsSignature, props.sessionItems, sessionItemsDirtyBySession])

  useEffect(() => {
    const pendingEntries = Object.entries(pendingDesiredOrderBySessionRef.current)
    if (pendingEntries.length === 0) return

    for (const [sessionId, desired] of pendingEntries) {
      const server = (props.sessionItems ?? [])
        .filter((r) => String(r.session_id) === String(sessionId))
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((r) => String(r.id))

      if (server.length !== desired.length) continue
      let ok = true
      for (let i = 0; i < desired.length; i++) {
        if (String(server[i]) !== String(desired[i])) {
          ok = false
          break
        }
      }
      if (!ok) continue

      delete pendingDesiredOrderBySessionRef.current[sessionId]
      setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionId]: false }))
    }
  }, [props.sessionItems, refreshPreserveScroll])

  // When server props catch up (new ids visible), reconcile & release the local override.
  useEffect(() => {
    const pendingEntries = Object.entries(pendingInsertBySessionRef.current)
    if (pendingEntries.length === 0) return

    const blocksSet = new Set((props.sessionBlocks ?? []).map((b) => b.id))
    const itemsSet = new Set((props.sessionItems ?? []).map((it) => it.id))

    for (const [sessionId, p] of pendingEntries) {
      if (!p.newBlockId || !p.newSessionItemId) continue
      if (!blocksSet.has(p.newBlockId)) continue
      if (!itemsSet.has(p.newSessionItemId)) continue

      // Server has the final rows, we can stop forcing local state.
      delete pendingInsertBySessionRef.current[sessionId]
      setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionId]: false }))
    }
  }, [props.sessionBlocks, props.sessionItems])

  const effectiveSessionItemsBySession = useMemo(() => {
    return sessionItemsLocal
  }, [sessionItemsLocal])

  const timelineItemsBySession = useMemo(() => {
    const out: Record<string, TimelineItem[]> = {}
    const hasDbTimeline = (props.sessionItems ?? []).length > 0

    if (hasDbTimeline) {
      const peById = new Map<string, ProgramExerciseRow>()
      for (const pe of props.programExercises) peById.set(pe.id, pe)

      const blockById = new Map<string, SessionBlockRow>()
      for (const b of effectiveSessionBlocks) blockById.set(b.id, b)

      for (const [sessionId, rows] of Object.entries(effectiveSessionItemsBySession)) {
        out[sessionId] = []
        for (const r of rows) {
          if (r.kind === 'exercise' && r.program_exercise_id) {
            const pe = peById.get(r.program_exercise_id) ?? null
            const optimistic = optimisticExerciseById[r.program_exercise_id] ?? null
            const title =
              String(optimistic?.title ?? '').trim() ||
              String(pe?.exercise_library?.name ?? '').trim() ||
              String(pe?.name ?? '').trim() ||
              'Exercice'
            out[sessionId].push({
              kind: 'exercise',
              sessionId,
              sortKey: r.position,
              id: r.id,
              programExerciseId: r.program_exercise_id,
              title,
              subtitle: optimistic?.notes != null ? String(optimistic.notes) : pe?.notes ? String(pe.notes) : null,
              sets: optimistic?.sets ?? pe?.sets ?? null,
              reps: optimistic?.reps ?? pe?.reps ?? null,
              rest_time: optimistic?.rest_time ?? pe?.rest_time ?? null,
              rpe: optimistic?.rpe ?? pe?.rpe ?? null,
              tempo: optimistic?.tempo ?? pe?.tempo ?? null,
              load: optimistic?.load ?? pe?.load ?? null,
            })
            continue
          }

          if (r.kind === 'block' && r.session_block_id) {
            const b = blockById.get(r.session_block_id) ?? null
            const optimisticTitle = optimisticBlockTitleById[r.session_block_id] ?? null
            const optimisticNotes = optimisticBlockNotesById[r.session_block_id] ?? null
            const title =
              String(optimisticTitle ?? '').trim() || String(b?.title ?? '').trim() || String(b?.type ?? 'block')
            out[sessionId].push({
              kind: 'block',
              sessionId,
              sortKey: r.position,
              id: r.id,
              blockId: r.session_block_id,
              title,
              subtitle: optimisticNotes != null ? String(optimisticNotes) : b?.notes ? String(b.notes) : null,
            })
            continue
          }

          out[sessionId].push({
            kind: 'exercise',
            sessionId,
            sortKey: r.position,
            id: r.id,
            programExerciseId: r.program_exercise_id,
            title: 'Item',
            subtitle: null,
            sets: null,
            reps: null,
            rest_time: null,
            rpe: null,
            tempo: null,
            load: null,
          })
        }
      }

      return out
    }

    const exercisesBySessionDeduplicated = Object.fromEntries(
      Object.entries(exercisesBySession).map(([sessionId, exercises]) => [
        sessionId,
        exercises.filter((exercise, index, self) => index === self.findIndex((e) => e.id === exercise.id)),
      ])
    )

    const blocksBySessionDeduplicated = Object.fromEntries(
      Object.entries(blocksBySession).map(([sessionId, blocks]) => [
        sessionId,
        blocks.filter((block, index, self) => index === self.findIndex((b) => b.id === block.id)),
      ])
    )

    for (const [sessionId, list] of Object.entries(exercisesBySessionDeduplicated)) {
      out[sessionId] = out[sessionId] ?? ([] as TimelineItem[])
      for (const pe of list) {
        const title = String(pe.exercise_library?.name ?? '').trim() || 'Exercice'
        out[sessionId].push({
          kind: 'exercise',
          sessionId,
          sortKey: (pe.exercise_order ?? 0) * 10,
          id: `ex:${pe.id}`,
          programExerciseId: pe.id,
          title,
          subtitle: pe.notes ? String(pe.notes) : null,
          sets: pe.sets ?? null,
          reps: pe.reps ?? null,
          rest_time: pe.rest_time ?? null,
          rpe: pe.rpe ?? null,
          tempo: pe.tempo ?? null,
          load: pe.load ?? null,
        })
      }
    }

    for (const [sessionId, list] of Object.entries(blocksBySessionDeduplicated)) {
      out[sessionId] = out[sessionId] ?? ([] as TimelineItem[])
      for (const b of list) {
        const title = String(b.title ?? '').trim() || b.type
        out[sessionId].push({
          kind: 'block',
          sessionId,
          sortKey: (b.position ?? 0) * 10 + 5,
          id: b.id,
          blockId: b.id,
          title,
          subtitle: b.notes ? String(b.notes) : null,
        })
      }
    }

    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => a.sortKey - b.sortKey)
    }

    return out
  }, [
    blocksBySession,
    effectiveSessionItemsBySession,
    exercisesBySession,
    optimisticBlockNotesById,
    optimisticBlockTitleById,
    optimisticExerciseById,
    props.programExercises,
    effectiveSessionBlocks,
    props.sessionItems,
  ])

// ...

  function saveEditExercise(item: TimelineItem & { kind: 'exercise' }, opts?: { skipRefresh?: boolean }) {
    if (!props.updateProgramExerciseAction) return
    const peId = String(item.programExerciseId ?? '')
    if (!peId) return
    if (peId.startsWith('tmp-pe-')) return

    const prev = optimisticExerciseById[peId] ?? null
    const y = typeof window !== 'undefined' ? window.scrollY : null

    const nextSets = editSets.trim()
    const nextReps = editReps.trim()
    const nextRest = editRestTime.trim()
    const nextRpe = editRpe.trim()
    const nextTempo = editTempo.trim()
    const nextLoad = editLoad.trim()
    const nextNotes = editExerciseNotes.trim()

    const rpeParsed = nextRpe ? Number(nextRpe) : null

    const updatePayload = {
      title: item.title,
      notes: nextNotes ? nextNotes : null,
      sets: nextSets ? Number(nextSets) : null,
      reps: nextReps ? Number(nextReps) : null,
      rest_time: nextRest ? nextRest : null,
      rpe: Number.isFinite(rpeParsed as number) ? (rpeParsed as number) : null,
      tempo: nextTempo ? nextTempo : null,
      load: nextLoad ? nextLoad : null,
    }

    setSavingProgramExerciseId(peId)
    setOptimisticExerciseById((p) => ({ ...p, [peId]: updatePayload }))
    setEditingProgramExerciseId(null)

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('program_exercise_id', peId)
    fd.set('session_id', String(item.sessionId))
    fd.set('sets', nextSets)
    fd.set('reps', nextReps)
    fd.set('rest_time', nextRest)
    fd.set('rpe', nextRpe)
    fd.set('tempo', nextTempo)
    fd.set('load', nextLoad)
    fd.set('notes', nextNotes)

    startTransition(async () => {
      try {
        await props.updateProgramExerciseAction?.(fd)
      } catch {
        setOptimisticExerciseById((p) => {
          const copy = { ...p }
          if (!prev) delete copy[peId]
          else copy[peId] = prev
          return copy
        })
        setEditingProgramExerciseId(peId)
      } finally {
        setSavingProgramExerciseId(null)
        if (!opts?.skipRefresh) restoreScrollY(y)
      }
    })
  }

  function deleteExercise(programExerciseId: string) {
    if (!props.deleteProgramExerciseAction) return
    if (!openSessionId) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    setSessionItemsLocal((prev) => {
      const current = (prev[openSessionId] ?? []).slice()
      const filtered = current.filter((r) => !(r.kind === 'exercise' && r.program_exercise_id === programExerciseId))
      const renumbered = filtered
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [openSessionId]: renumbered }
    })

    setSessionItemsDirtyBySession((prev) => ({ ...prev, [openSessionId]: true }))

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_id', openSessionId)
    fd.set('program_exercise_id', programExerciseId)
    startTransition(async () => {
      try {
        await props.deleteProgramExerciseAction?.(fd)
      } finally {
        restoreScrollY(y)
      }
    })
  }

  function deleteBlock(blockId: string) {
    if (!props.deleteBlockAction) return
    if (!blockId) return

    if (String(blockId).startsWith('tmp-block-')) {
      const sourceTmp = effectiveSessionBlocks.find((b) => String(b.id) === String(blockId)) ?? null
      const sessionIdForDelete = String(sourceTmp?.program_session_id ?? '')
      if (!sessionIdForDelete) return

      const y = typeof window !== 'undefined' ? window.scrollY : null

      if (effectiveOpenBlockId && String(effectiveOpenBlockId) === String(blockId)) {
        setOpenBlockInUrl(null, sessionIdForDelete)
      }

      restoreScrollY(y)

      setSessionItemsLocal((prev) => {
        const current = (prev[sessionIdForDelete] ?? []).slice()
        const filtered = current.filter((r) => !(r.kind === 'block' && r.session_block_id === blockId))
        const renumbered = filtered
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((r, idx) => ({ ...r, position: idx }))
        return { ...prev, [sessionIdForDelete]: renumbered }
      })

      setOptimisticSessionBlocksById((prev) => {
        const copy = { ...prev }
        delete copy[String(blockId)]
        return copy
      })
      setOptimisticBlockTitleById((prev) => {
        const copy = { ...prev }
        delete copy[String(blockId)]
        return copy
      })
      setOptimisticBlockNotesById((prev) => {
        const copy = { ...prev }
        delete copy[String(blockId)]
        return copy
      })
      setOptimisticBlockExercisesByBlockId((prev) => {
        const copy = { ...prev }
        delete copy[String(blockId)]
        return copy
      })

      return
    }

    const source = effectiveSessionBlocks.find((b) => String(b.id) === String(blockId)) ?? null
    const sessionIdForDelete = String(source?.program_session_id ?? '')
    if (!sessionIdForDelete) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    if (effectiveOpenBlockId && String(effectiveOpenBlockId) === String(blockId)) {
      setOpenBlockInUrl(null, sessionIdForDelete)
    }

    restoreScrollY(y)

    setSessionItemsLocal((prev) => {
      const current = (prev[sessionIdForDelete] ?? []).slice()
      const filtered = current.filter((r) => !(r.kind === 'block' && r.session_block_id === blockId))
      const renumbered = filtered
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [sessionIdForDelete]: renumbered }
    })

    setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionIdForDelete]: true }))

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_id', sessionIdForDelete)
    fd.set('session_block_id', String(blockId))
    startTransition(async () => {
      try {
        await props.deleteBlockAction?.(fd)
      } finally {
        restoreScrollY(y)
      }
    })
  }

  function duplicateBlock(blockId: string) {
    if (!props.duplicateBlockAction) return
    if (!openSessionId) return
    if (!blockId) return
    if (String(blockId).startsWith('tmp-block-')) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    const source = effectiveSessionBlocks.find((b) => String(b.id) === String(blockId)) ?? null
    const sessionIdForDup = String(source?.program_session_id ?? openSessionId)
    const sourceTitle = String(source?.title ?? '').trim() || String(source?.type ?? 'Bloc')
    const sourceNotes = String(source?.notes ?? '')
    const sourceType = String(source?.type ?? 'strength')

    const tmpBlockId = `tmp-block-${crypto.randomUUID()}`
    const tmpSessionItemId = `tmp-session-item-${crypto.randomUUID()}`

    setOptimisticSessionBlocksById((prev) => ({
      ...prev,
      [tmpBlockId]: {
        id: tmpBlockId,
        program_session_id: sessionIdForDup,
        position: (source?.position ?? 0) + 0.5,
        type: sourceType,
        title: `${sourceTitle} (copie)`,
        notes: sourceNotes ? sourceNotes : null,
      },
    }))

    setOptimisticBlockTitleById((prev) => ({ ...prev, [tmpBlockId]: `${sourceTitle} (copie)` }))
    if (sourceNotes) setOptimisticBlockNotesById((prev) => ({ ...prev, [tmpBlockId]: sourceNotes }))

    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(
          `program:block-meta:${String(tmpBlockId)}`,
          JSON.stringify({ title: `${sourceTitle} (copie)`, notes: sourceNotes })
        )
      } catch {
        // ignore
      }
    }

    const sourceExercises = (blockExercisesByBlockId[String(blockId)] ?? []).slice()
    if (sourceExercises.length) {
      const tmpExercises = sourceExercises.map((be) => ({
        ...be,
        id: `tmp-be-${crypto.randomUUID()}`,
        session_block_id: tmpBlockId,
      }))
      setOptimisticBlockExercisesByBlockId((prev) => ({ ...prev, [tmpBlockId]: tmpExercises }))
    }

    const sourceSessionItemId =
      (sessionItemsLocal[sessionIdForDup] ?? []).find((r) => r.kind === 'block' && String(r.session_block_id) === String(blockId))?.id ?? null

    pendingDuplicateBlockIdRef.current[tmpSessionItemId] = {
      sessionId: sessionIdForDup,
      tmpSessionItemId,
      tmpBlockId,
      newBlockId: null,
      sourceSessionItemId,
    }

    setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionIdForDup]: true }))
    setSessionItemsLocal((prev) => {
      const current = (prev[sessionIdForDup] ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const sourceIdx = current.findIndex((r) => r.kind === 'block' && String(r.session_block_id) === String(blockId))
      const insertAt = sourceIdx >= 0 ? sourceIdx + 1 : current.length
      const inserted: SessionItemRow = {
        id: tmpSessionItemId,
        session_id: sessionIdForDup,
        kind: 'block',
        position: insertAt,
        program_exercise_id: null,
        session_block_id: tmpBlockId,
      }
      const next = current.slice(0, insertAt).concat([inserted]).concat(current.slice(insertAt))
      const renumbered = next.map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [sessionIdForDup]: renumbered }
    })

    restoreScrollY(y)

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_block_id', String(blockId))
    startTransition(async () => {
      try {
        const res = (await props.duplicateBlockAction?.(fd)) as
          | void
          | { newBlockId?: string | null; newBlockExercises?: BlockExerciseRow[] | null }
        const newBlockId = res && typeof res === 'object' ? (res.newBlockId ?? null) : null
        const newBlockExercises = res && typeof res === 'object' ? (res.newBlockExercises ?? null) : null
        if (newBlockId) {
          const pending = pendingDuplicateBlockIdRef.current[tmpSessionItemId]
          if (pending) pendingDuplicateBlockIdRef.current[tmpSessionItemId] = { ...pending, newBlockId }

          setOptimisticSessionBlocksById((prev) => {
            const copy = { ...prev }
            const tmpRow = copy[tmpBlockId]
            const base: SessionBlockRow = tmpRow
              ? { ...tmpRow, id: String(newBlockId) }
              : {
                  id: String(newBlockId),
                  program_session_id: sessionIdForDup,
                  position: (source?.position ?? 0) + 0.5,
                  type: sourceType,
                  title: `${sourceTitle} (copie)`,
                  notes: sourceNotes ? sourceNotes : null,
                }
            copy[String(newBlockId)] = base
            delete copy[tmpBlockId]
            return copy
          })

          setSessionItemsLocal((prev) => {
            const next: Record<string, SessionItemRow[]> = { ...prev }
            const list = (next[sessionIdForDup] ?? []).slice()
            next[sessionIdForDup] = list.map((r) => {
              if (r.id !== tmpSessionItemId) return r
              if (r.kind !== 'block') return r
              return { ...r, session_block_id: String(newBlockId) }
            })
            return next
          })

          setOptimisticBlockTitleById((prev) => {
            const copy = { ...prev }
            const title = copy[tmpBlockId]
            if (title != null) copy[String(newBlockId)] = title
            delete copy[tmpBlockId]
            return copy
          })

          setOptimisticBlockNotesById((prev) => {
            const copy = { ...prev }
            const notes = copy[tmpBlockId]
            if (notes != null) copy[String(newBlockId)] = notes
            delete copy[tmpBlockId]
            return copy
          })

          if (typeof window !== 'undefined') {
            try {
              const title = `${sourceTitle} (copie)`
              window.sessionStorage.setItem(`program:block-meta:${String(newBlockId)}`, JSON.stringify({ title, notes: sourceNotes }))
              window.sessionStorage.removeItem(`program:block-meta:${String(tmpBlockId)}`)
            } catch {
              // ignore
            }
          }

          setOptimisticBlockExercisesByBlockId((prev) => {
            const copy = { ...prev }
            const nextList = (newBlockExercises ?? null)
              ? (newBlockExercises as BlockExerciseRow[]).map((be) => ({ ...be, session_block_id: String(newBlockId) }))
              : (copy[tmpBlockId] ?? []).map((be) => ({ ...be, session_block_id: String(newBlockId) }))

            copy[String(newBlockId)] = nextList

            if (typeof window !== 'undefined') {
              try {
                window.sessionStorage.setItem(`program:block-exercises:${String(newBlockId)}`, JSON.stringify(nextList))
                window.sessionStorage.removeItem(`program:block-exercises:${String(tmpBlockId)}`)
              } catch {
                // ignore
              }
            }

            delete copy[tmpBlockId]
            return copy
          })
        }
      } finally {
        restoreScrollY(y)
      }
    })
  }

  function duplicateExercise(item: TimelineItem & { kind: 'exercise' }) {
    if (!props.duplicateProgramExerciseAction) return
    if (!openSessionId) return
    const peId = item.programExerciseId
    if (!peId) return

    const tmpProgramExerciseId = `tmp-pe-${crypto.randomUUID()}`
    const tmpSessionItemId = `tmp-session-item-${crypto.randomUUID()}`

    setOptimisticExerciseById((p) => ({
      ...p,
      [tmpProgramExerciseId]: {
        title: item.title,
        notes: item.subtitle ?? null,
        sets: item.sets ?? null,
        reps: item.reps ?? null,
        rest_time: item.rest_time ?? null,
        rpe: null,
        tempo: item.tempo ?? null,
        load: item.load ?? null,
      },
    }))

    setSessionItemsLocal((prev) => {
      const current = (prev[openSessionId] ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const sourceIdx = current.findIndex((r) => r.kind === 'exercise' && r.program_exercise_id === peId)
      const insertAt = sourceIdx >= 0 ? sourceIdx + 1 : current.length
      const inserted: SessionItemRow = {
        id: tmpSessionItemId,
        session_id: openSessionId,
        kind: 'exercise',
        position: insertAt,
        program_exercise_id: tmpProgramExerciseId,
        session_block_id: null,
      }
      const next = current.slice(0, insertAt).concat([inserted]).concat(current.slice(insertAt))
      const renumbered = next.map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [openSessionId]: renumbered }
    })

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_id', openSessionId)
    fd.set('program_exercise_id', peId)
    fd.set('source_session_item_id', item.id)
    startTransition(async () => {
      try {
        const res = (await props.duplicateProgramExerciseAction?.(fd)) as
          | void
          | { newProgramExerciseId?: string | null; newSessionItemId?: string | null }
        const newProgramExerciseId = res && typeof res === 'object' ? res.newProgramExerciseId ?? null : null
        const newSessionItemId = res && typeof res === 'object' ? res.newSessionItemId ?? null : null

        if (newProgramExerciseId && newSessionItemId) {
          setOptimisticExerciseById((p) => {
            const next = { ...p }
            const optimistic = next[tmpProgramExerciseId]
            if (optimistic) next[newProgramExerciseId] = optimistic
            delete next[tmpProgramExerciseId]
            return next
          })
          setSessionItemsLocal((prev) => {
            const current = (prev[openSessionId] ?? []).slice()
            const next = current.map((r) => {
              if (r.id !== tmpSessionItemId) return r
              return { ...r, id: newSessionItemId, program_exercise_id: newProgramExerciseId }
            })
            return { ...prev, [openSessionId]: next }
          })
        }
      } finally {
        refreshPreserveScroll()
      }
    })
  }

  function insertExerciseAt(sessionId: string, insertPosition: number, exerciseId: string) {
    if (!props.insertSessionItemExerciseAtPositionAction) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    const tmpProgramExerciseId = `tmp-pe-${crypto.randomUUID()}`
    const tmpSessionItemId = `tmp-session-item-${crypto.randomUUID()}`

    const optimisticTitle = String(exerciseLibraryNameById[String(exerciseId)] ?? '').trim() || 'Exercice'
    setOptimisticExerciseById((p) => ({
      ...p,
      [tmpProgramExerciseId]: { title: optimisticTitle, notes: null, sets: null, reps: null, rest_time: null, rpe: null, tempo: null, load: null },
    }))

    setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionId]: true }))
    setSessionItemsLocal((prev) => {
      const current = (prev[sessionId] ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const clamped = Math.max(0, Math.min(current.length, insertPosition))
      const inserted: SessionItemRow = {
        id: tmpSessionItemId,
        session_id: sessionId,
        kind: 'exercise',
        position: clamped,
        program_exercise_id: tmpProgramExerciseId,
        session_block_id: null,
      }
      const next = current.slice(0, clamped).concat([inserted]).concat(current.slice(clamped))
      const renumbered = next.map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [sessionId]: renumbered }
    })

    if (y != null && typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
      }, 0)
    }

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_id', sessionId)
    fd.set('exercise_id', exerciseId)
    fd.set('insert_position', String(insertPosition))

    startTransition(async () => {
      try {
        const res = (await props.insertSessionItemExerciseAtPositionAction?.(fd)) as
          | { newProgramExerciseId?: string | null; newSessionItemId?: string | null }
          | void
        const newProgramExerciseId = res && typeof res === 'object' ? res.newProgramExerciseId ?? null : null
        const newSessionItemId = res && typeof res === 'object' ? res.newSessionItemId ?? null : null

        if (newProgramExerciseId && newSessionItemId) {
          setOptimisticExerciseById((p) => {
            const next = { ...p }
            const optimistic = next[tmpProgramExerciseId]
            if (optimistic) next[newProgramExerciseId] = optimistic
            delete next[tmpProgramExerciseId]
            return next
          })
          setSessionItemsLocal((prev) => {
            const current = (prev[sessionId] ?? []).slice()
            const next = current.map((r) => {
              if (r.id !== tmpSessionItemId) return r
              return { ...r, id: newSessionItemId, program_exercise_id: newProgramExerciseId }
            })
            return { ...prev, [sessionId]: next }
          })
        } else {
          setSessionItemsLocal((prev) => {
            const current = (prev[sessionId] ?? []).filter((r) => r.id !== tmpSessionItemId)
            const renumbered = current
              .slice()
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((r, idx) => ({ ...r, position: idx }))
            return { ...prev, [sessionId]: renumbered }
          })
        }
      } catch {
        setSessionItemsLocal((prev) => {
          const current = (prev[sessionId] ?? []).filter((r) => r.id !== tmpSessionItemId)
          const renumbered = current
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((r, idx) => ({ ...r, position: idx }))
          return { ...prev, [sessionId]: renumbered }
        })
      } finally {
        if (y != null && typeof window !== 'undefined') {
          window.setTimeout(() => {
            window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
          }, 0)
        }
      }
    })
  }

  function insertBlockAt(
    sessionId: string,
    insertPosition: number,
    uiType: 'warmup' | 'crossfit' | 'superset',
    opts?: { titleOverride?: string | null }
  ) {
    if (!props.insertSessionItemBlockAtPositionAction) return

    const y = typeof window !== 'undefined' ? window.scrollY : null

    const tmpBlockId = `tmp-block-${crypto.randomUUID()}`
    const tmpSessionItemId = `tmp-session-item-${crypto.randomUUID()}`
    const override = String(opts?.titleOverride ?? '').trim()
    const fallbackTitle = uiType === 'warmup' ? 'Warm-up' : uiType === 'crossfit' ? 'CrossFit' : 'Superset'
    const optimisticTitle = override || fallbackTitle
    setOptimisticBlockTitleById((prev) => ({ ...prev, [tmpBlockId]: optimisticTitle }))
    pendingInsertBySessionRef.current[sessionId] = {
      tmpSessionItemId,
      tmpBlockId,
      newSessionItemId: null,
      newBlockId: null,
    }

    // Do not open the editor for tmp ids; wait for server id to avoid a "blocked" editor.

    setSessionItemsDirtyBySession((prev) => ({ ...prev, [sessionId]: true }))
    setSessionItemsLocal((prev) => {
      const current = (prev[sessionId] ?? []).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      const clamped = Math.max(0, Math.min(current.length, insertPosition))
      const inserted: SessionItemRow = {
        id: tmpSessionItemId,
        session_id: sessionId,
        kind: 'block',
        position: clamped,
        program_exercise_id: null,
        session_block_id: tmpBlockId,
      }
      const next = current.slice(0, clamped).concat([inserted]).concat(current.slice(clamped))
      const renumbered = next.map((r, idx) => ({ ...r, position: idx }))
      return { ...prev, [sessionId]: renumbered }
    })

    if (y != null && typeof window !== 'undefined') {
      window.setTimeout(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
      }, 0)
    }

    const fd = new FormData()
    fd.set('client', '1')
    fd.set('session_id', sessionId)
    fd.set('insert_position', String(insertPosition))
    if (uiType === 'warmup') {
      fd.set('type', 'warmup')
      fd.set('title', optimisticTitle)
    } else if (uiType === 'crossfit') {
      fd.set('type', 'crosstraining')
      fd.set('title', optimisticTitle)
    } else {
      // until we introduce a dedicated `superset` type in DB, we map it to strength
      fd.set('type', 'strength')
      fd.set('title', optimisticTitle)
    }

    startTransition(async () => {
      try {
        const res = (await props.insertSessionItemBlockAtPositionAction?.(fd)) as
          | { newBlockId?: string | null; newSessionItemId?: string | null }
          | void
        const newBlockId = res && typeof res === 'object' ? res.newBlockId ?? null : null
        const newSessionItemId = res && typeof res === 'object' ? res.newSessionItemId ?? null : null

        if (newBlockId && newSessionItemId) {
          const existing = pendingInsertBySessionRef.current[sessionId]
          if (existing && existing.tmpSessionItemId === tmpSessionItemId) {
            pendingInsertBySessionRef.current[sessionId] = {
              ...existing,
              newBlockId,
              newSessionItemId,
            }
          }
          setOptimisticBlockTitleById((prev) => {
            const next = { ...prev }
            const title = next[tmpBlockId]
            if (title) next[newBlockId] = title
            delete next[tmpBlockId]
            return next
          })
          setSessionItemsLocal((prev) => {
            const current = (prev[sessionId] ?? []).slice()
            const next = current.map((r) => {
              if (r.id !== tmpSessionItemId) return r
              return { ...r, id: newSessionItemId, session_block_id: newBlockId }
            })
            return { ...prev, [sessionId]: next }
          })
        } else {
          delete pendingInsertBySessionRef.current[sessionId]
          setOptimisticBlockTitleById((prev) => {
            const next = { ...prev }
            delete next[tmpBlockId]
            return next
          })
          setSessionItemsLocal((prev) => {
            const current = (prev[sessionId] ?? []).filter((r) => r.id !== tmpSessionItemId)
            const renumbered = current
              .slice()
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
              .map((r, idx) => ({ ...r, position: idx }))
            return { ...prev, [sessionId]: renumbered }
          })
        }
      } catch {
        delete pendingInsertBySessionRef.current[sessionId]
        setOptimisticBlockTitleById((prev) => {
          const next = { ...prev }
          delete next[tmpBlockId]
          return next
        })
        setSessionItemsLocal((prev) => {
          const current = (prev[sessionId] ?? []).filter((r) => r.id !== tmpSessionItemId)
          const renumbered = current
            .slice()
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((r, idx) => ({ ...r, position: idx }))
          return { ...prev, [sessionId]: renumbered }
        })
      } finally {
        // keep dirty=true until server props include the inserted rows, to prevent flicker
        if (y != null && typeof window !== 'undefined') {
          window.setTimeout(() => {
            window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
          }, 0)
        }
      }
    })
  }

  function onDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    if (isDndDisabled) return
    if (isTimelineDndDisabled && !id.startsWith('library-exercise:')) return
    setActiveDragId(id)
    lastOverIdRef.current = null
    setActiveDropMarkerId(null)
  }

  function onDragOver(e: DragOverEvent) {
    if (isDndDisabled) return
    if (isTimelineDndDisabled && !(activeDragId && String(activeDragId).startsWith('library-exercise:'))) return
    const overId = e.over?.id ? String(e.over.id) : null
    if (overId) lastOverIdRef.current = overId
    setActiveDropMarkerId(overId && overId.startsWith('drop-marker:') ? overId : null)
  }

  const persistOrder = useCallback(
    (sessionId: string, orderedIds: string[]) => {
      if (!props.updateSessionItemsOrderAction) return
      if (!sessionId) return
      if (!orderedIds.length) return

      const hasTmp = orderedIds.some((id) => String(id).startsWith('tmp-'))
      if (hasTmp) {
        pendingDesiredOrderBySessionRef.current[String(sessionId)] = orderedIds.slice()
        return
      }

      const y = typeof window !== 'undefined' ? window.scrollY : null

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('session_id', sessionId)
      fd.set('ordered_ids_json', JSON.stringify(orderedIds))

      startTransition(async () => {
        try {
          await props.updateSessionItemsOrderAction?.(fd)
        } finally {
          restoreScrollY(y)
        }
      })
    },
    [props, restoreScrollY, startTransition]
  )

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id)
    if (isDndDisabled) return
    if (isTimelineDndDisabled && !activeId.startsWith('library-exercise:')) {
      setActiveDragId(null)
      lastOverIdRef.current = null
      setActiveDropMarkerId(null)
      return
    }
    const overId = e.over?.id ? String(e.over.id) : lastOverIdRef.current
    setActiveDragId(null)
    lastOverIdRef.current = null
    setActiveDropMarkerId(null)

    if (!overId) return

    if (activeId.startsWith('session:') && overId.startsWith('session:')) {
      if (isSessionDndDisabled) return

      const activeSessionId = activeId.replace('session:', '')
      const overSessionId = overId.replace('session:', '')
      const weekId = effectiveSessions.find((s) => String(s.id) === String(activeSessionId))?.week_id ?? null
      if (!weekId) return

      const list = (sessionsByWeek[weekId] ?? []).slice().sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))
      const oldIndex = list.findIndex((s) => String(s.id) === String(activeSessionId))
      const newIndex = list.findIndex((s) => String(s.id) === String(overSessionId))
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

      const moved = arrayMove(list, oldIndex, newIndex)
      const renumbered = moved.map((s, idx) => ({ ...s, session_order: idx + 1 }))

      setOptimisticSessions((prev) => {
        const byId = new Map(prev.map((s) => [String(s.id), s]))
        for (const s of renumbered) {
          const existing = byId.get(String(s.id))
          if (existing) byId.set(String(s.id), { ...existing, session_order: s.session_order })
        }
        return Array.from(byId.values())
      })

      if (props.updateSessionsOrderAction) {
        const y = typeof window !== 'undefined' ? window.scrollY : null
        const fd = new FormData()
        fd.set('client', '1')
        fd.set('week_id', String(weekId))
        fd.set(
          'ordered_session_ids_json',
          JSON.stringify(renumbered.map((s) => String(s.id)).filter((id) => id && !id.startsWith('tmp-session-')))
        )
        startTransition(async () => {
          try {
            await props.updateSessionsOrderAction?.(fd)
          } finally {
            restoreScrollY(y)
          }
        })
      }

      return
    }

    if (!openSessionId) return
    if (overId === 'timeline-dropzone') return
    if (overId === 'library-dropzone') return
    if (overId === 'palette-dropzone') return

    if (activeId.startsWith('palette-block:')) {
      if (!props.insertSessionItemBlockAtPositionAction) return
      const kind = activeId.replace('palette-block:', '') as 'warmup' | 'crossfit' | 'superset'
      const rows = effectiveSessionItemsBySession[openSessionId] ?? []

      if (overId.startsWith('palette-block:')) return

      if (overId.startsWith('drop-marker:')) {
        const raw = overId.replace('drop-marker:', '')
        const idx = Number.parseInt(raw, 10)
        if (!Number.isFinite(idx)) return
        insertBlockAt(openSessionId, idx, kind)
        return
      }

      const overIndex = rows.findIndex((r) => r.id === overId)
      if (overIndex < 0) return
      insertBlockAt(openSessionId, overIndex, kind)
      return
    }

    if (activeId.startsWith('library-exercise:')) {
      const exerciseId = activeId.replace('library-exercise:', '')
      const rows = effectiveSessionItemsBySession[openSessionId] ?? []

      if (overId.startsWith('library-exercise:')) return
      if (overId.startsWith('palette-block:')) return

      if (overId === 'block-editor-dropzone') {
        addExerciseToOpenBlock(exerciseId)
        return
      }

      if (!props.insertSessionItemExerciseAtPositionAction) return

      if (overId.startsWith('drop-marker:')) {
        const raw = overId.replace('drop-marker:', '')
        const idx = Number.parseInt(raw, 10)
        if (!Number.isFinite(idx)) return
        insertExerciseAt(openSessionId, idx, exerciseId)
        return
      }

      const overIndex = rows.findIndex((r) => r.id === overId)
      if (overIndex < 0) return
      insertExerciseAt(openSessionId, overIndex, exerciseId)
      return
    }

    if (overId === activeId) return

    const currentRows = (effectiveSessionItemsBySession[openSessionId] ?? []).slice()
    const oldIndex = currentRows.findIndex((r) => r.id === activeId)
    const newIndex = currentRows.findIndex((r) => r.id === overId)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(currentRows, oldIndex, newIndex).map((r, idx) => ({ ...r, position: idx }))
    setSessionItemsLocal((prev) => ({ ...prev, [openSessionId]: reordered }))
    setSessionItemsDirtyBySession((prev) => ({ ...prev, [openSessionId]: true }))
    persistOrder(
      openSessionId,
      reordered.map((r) => r.id)
    )
  }

  return (
    <>
      {!mounted ? (
        <div className="grid gap-4 min-[768px]:grid-cols-[minmax(0,1fr)_minmax(0,clamp(180px,22vw,320px))] min-[768px]:grid-rows-[auto_1fr] min-[768px]:items-start min-[1000px]:!grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] min-[1000px]:!grid-rows-1">
          <div className="hidden min-[768px]:block min-[1000px]:!hidden min-[768px]:col-start-2 min-[768px]:row-span-2 min-[768px]:sticky min-[768px]:top-[136px] min-[768px]:self-start min-[768px]:max-h-[calc(100vh-156px)] min-[768px]:overflow-auto">
            <div className="grid gap-4">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3">
                <div className="text-xs font-extrabold tracking-wide text-[var(--brand)]">Blocs</div>
                <div className="mt-1 text-sm font-extrabold tracking-tight text-[var(--text)]">Palette</div>
                <div className="mt-3 grid gap-2">
                  <PaletteStatic label="Warm-up" meta="Bloc" />
                  <PaletteStatic label="CrossFit" meta="Bloc" />
                  <PaletteStatic label="Superset" meta="Bloc" />
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)]">
                <div className="sticky top-0 z-10 rounded-t-2xl bg-[var(--accent)] px-3 pb-3 pt-3">
                  <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text)]">Bibliothèque</div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={libraryQuery}
                      onChange={(e) => setLibraryQuery(e.target.value)}
                      placeholder="Rechercher…"
                      className="h-10 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                    />
                    <select
                      value={libraryMuscle}
                      onChange={(e) => setLibraryMuscle(e.target.value)}
                      className="h-10 w-[120px] flex-none rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                    >
                      <option value="">Muscle</option>
                      {(props.muscleGroups ?? []).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 px-3 pb-3">
                  {filteredExerciseLibrary.slice(0, 50).map((ex) => (
                    <div
                      key={ex.id}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm font-semibold text-[var(--text)]"
                    >
                      <div className="truncate">{String(ex.name ?? 'Exercice')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden min-[1000px]:block min-[1000px]:col-start-1 min-[1000px]:sticky min-[1000px]:top-[136px] min-[1000px]:z-20 min-[1000px]:self-start min-[1000px]:max-h-[calc(100vh-156px)] min-[1000px]:overflow-auto">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3">
              <div className="text-xs font-extrabold tracking-wide text-[var(--brand)]">Blocs</div>
              <div className="mt-1 text-sm font-extrabold tracking-tight text-[var(--text)]">Palette</div>
              <div className="mt-3 grid gap-2">
                <PaletteStatic label="Warm-up" meta="Bloc" />
                <PaletteStatic label="CrossFit" meta="Bloc" />
                <PaletteStatic label="Superset" meta="Bloc" />
              </div>
            </div>
          </div>

          <div className="min-[768px]:col-start-1 min-[768px]:row-span-2 min-[1000px]:col-start-2 min-[1000px]:row-span-1" />

          <div className="hidden min-[1000px]:block min-[1000px]:col-start-3 min-[1000px]:sticky min-[1000px]:top-[136px] min-[1000px]:z-10 min-[1000px]:self-start min-w-0">
            <div className="flex min-h-0 flex-col overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--accent)] min-[1000px]:max-h-[calc(100vh-156px)]">
              <div className="sticky top-0 z-10 bg-[var(--accent)] px-3 pb-3 pt-3">
                <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                <div className="mt-1 text-sm font-semibold text-[var(--text)]">Bibliothèque</div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={libraryQuery}
                    onChange={(e) => setLibraryQuery(e.target.value)}
                    placeholder="Rechercher…"
                    className="h-10 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                  />
                  <select
                    value={libraryMuscle}
                    onChange={(e) => setLibraryMuscle(e.target.value)}
                    className="h-10 w-[120px] flex-none rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                  >
                    <option value="">Muscle</option>
                    {(props.muscleGroups ?? []).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3 grid gap-2 px-3 pb-3">
                {filteredExerciseLibrary.slice(0, 50).map((ex) => (
                  <div
                    key={ex.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-sm font-semibold text-[var(--text)]"
                  >
                    <div className="truncate">{String(ex.name ?? 'Exercice')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-4 min-[768px]:grid-cols-[minmax(0,1fr)_minmax(0,clamp(180px,22vw,320px))] min-[768px]:grid-rows-[auto_1fr] min-[768px]:items-start min-[1000px]:!grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] min-[1000px]:!grid-rows-1">
            <div className="hidden min-[768px]:block min-[1000px]:!hidden min-[768px]:col-start-2 min-[768px]:row-span-2 min-[768px]:sticky min-[768px]:top-[136px] min-[768px]:self-start min-[768px]:max-h-[calc(100vh-156px)] min-[768px]:overflow-auto">
              <div className="grid gap-4">
                <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3">
                  <PaletteNeutralDropZone active={!!activeDragId && String(activeDragId).startsWith('palette-block:')} />
                  <div className="text-xs font-extrabold tracking-wide text-[var(--brand)]">Blocs</div>
                  <div className="mt-1 text-sm font-extrabold tracking-tight text-[var(--text)]">Palette</div>

                  {props.insertSessionItemBlockAtPositionAction ? (
                    <div className="mt-3 grid gap-2">
                      <PaletteDraggable id="palette-block:warmup" label="Warm-up" meta="Bloc" />
                      <PaletteDraggable id="palette-block:crossfit" label="CrossFit" meta="Bloc" />
                      <PaletteDraggable id="palette-block:superset" label="Superset" meta="Bloc" />
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      <PaletteStatic label="Warm-up" meta="Bloc" />
                      <PaletteStatic label="CrossFit" meta="Bloc" />
                      <PaletteStatic label="Superset" meta="Bloc" />
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-[rgb(245,245,245)]">
                  <div className="sticky top-0 z-10 rounded-t-2xl bg-[rgb(245,245,245)] px-3 pb-3 pt-3">
                    <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">Bibliothèque (drag &amp; drop)</div>

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={libraryQuery}
                        onChange={(e) => setLibraryQuery(e.target.value)}
                        placeholder="Rechercher…"
                        className="h-10 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                      />
                      <select
                        value={libraryMuscle}
                        onChange={(e) => setLibraryMuscle(e.target.value)}
                        className="h-10 w-[120px] flex-none rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                      >
                        <option value="">Muscle</option>
                        {(props.muscleGroups ?? []).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {props.insertSessionItemExerciseAtPositionAction && filteredExerciseLibrary.length ? (
                    <div className="relative mt-3 px-3 pb-3 pr-1">
                      <LibraryNeutralDropZone active={!!activeDragId} />
                      <div className="grid gap-2">
                        {filteredExerciseLibrary.map((ex) => (
                          <LibraryExerciseDraggable
                            key={ex.id}
                            id={`library-exercise:${ex.id}`}
                            label={String(ex.name ?? '').trim() || '—'}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 px-3 pb-3 text-sm text-gray-600">Aucun exercice.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden min-[1000px]:block min-[1000px]:col-start-1 min-[1000px]:sticky min-[1000px]:top-[136px] min-[1000px]:z-20 min-[1000px]:self-start min-[1000px]:max-h-[calc(100vh-156px)] min-[1000px]:overflow-auto">
              <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--accent)] p-3">
                <PaletteNeutralDropZone active={!!activeDragId && String(activeDragId).startsWith('palette-block:')} />
                <div className="text-xs font-extrabold tracking-wide text-[var(--brand)]">Blocs</div>
                <div className="mt-1 text-sm font-extrabold tracking-tight text-[var(--text)]">Palette</div>

                {props.insertSessionItemBlockAtPositionAction ? (
                  <div className="mt-3 grid gap-2">
                    <PaletteDraggable id="palette-block:warmup" label="Warm-up" meta="Bloc" />
                    <PaletteDraggable id="palette-block:crossfit" label="CrossFit" meta="Bloc" />
                    <PaletteDraggable id="palette-block:superset" label="Superset" meta="Bloc" />
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    <PaletteStatic label="Warm-up" meta="Bloc" />
                    <PaletteStatic label="CrossFit" meta="Bloc" />
                    <PaletteStatic label="Superset" meta="Bloc" />
                  </div>
                )}
              </div>
            </div>

            <div className="min-[768px]:col-start-1 min-[768px]:row-span-2 min-[1000px]:col-start-2 min-[1000px]:row-span-1">
              <DragOverlay>
                {activeDragId === 'palette-block:warmup' ? <PaletteDragPreview label="Warm-up" /> : null}
                {activeDragId === 'palette-block:crossfit' ? <PaletteDragPreview label="CrossFit" /> : null}
                {activeDragId === 'palette-block:superset' ? <PaletteDragPreview label="Superset" /> : null}
                {activeDragId && activeDragId.startsWith('library-exercise:') ? <PaletteDragPreview label="Exercice" /> : null}
              </DragOverlay>

              <div className="relative">
                <TimelineNeutralDropZone active={!!activeDragId} />

                <div className="grid gap-3">
                {orderedWeeks.map((w) => {
                  const isWeekOpen = openWeekId === w.id
                  const sessions = sessionsByWeek[w.id] ?? []

                  return (
                    <div
                      key={w.id}
                      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-md shadow-black/5"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                        onClick={(e) => {
                          if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button')) return
                          setOpenWeekId((cur) => (cur === w.id ? null : w.id))
                        }}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button')) return
                          e.preventDefault()
                          setOpenWeekId((cur) => (cur === w.id ? null : w.id))
                        }}
                      >
                        <div className="min-w-0">
                          {editingWeekId === w.id ? (
                            <div className="grid gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <input
                                  value={editWeekTitle}
                                  onChange={(e) => setEditWeekTitle(e.target.value)}
                                  className="h-9 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900"
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                />
                                <div className="ml-3 h-8 w-8 flex-none" />
                              </div>
                              <textarea
                                value={editWeekNotes}
                                onChange={(e) => setEditWeekNotes(e.target.value)}
                                className="min-h-[72px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                placeholder="Note"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                                  disabled={savingWeekId === w.id}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    saveWeekMeta(w.id)
                                  }}
                                >
                                  Sauvegarder
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 disabled:opacity-50"
                                  disabled={savingWeekId === w.id}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingWeekId(null)
                                    setEditWeekTitle('')
                                    setEditWeekNotes('')
                                  }}
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex min-w-0 items-center">
                                <div className="min-w-0 flex-1 truncate text-base font-extrabold tracking-tight text-[var(--brand)]">
                                  {w.title}
                                </div>

                                {props.updateWeekMetaAction ? (
                                  <button
                                    type="button"
                                    className="ml-3 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                                    onPointerDownCapture={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setEditingWeekId(w.id)
                                      setEditWeekTitle(w.title)
                                      setEditWeekNotes(String(w.notes ?? '').trim())
                                    }}
                                    aria-label="Éditer"
                                    title="Éditer"
                                  >
                                    <IconEdit size={14} />
                                  </button>
                                ) : (
                                  <div className="ml-3 h-8 w-8 flex-none" />
                                )}
                              </div>
                              {w.notes ? <div className="mt-1 truncate text-sm text-[var(--muted)]">{w.notes}</div> : null}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                            onPointerDownCapture={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              duplicateWeek(w.id)
                            }}
                            aria-label="Dupliquer"
                            title="Dupliquer"
                          >
                            <IconDuplicate size={18} />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                            onPointerDownCapture={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteWeek(w.id)
                            }}
                            aria-label="Supprimer"
                            title="Supprimer"
                          >
                            <IconTrash size={18} />
                          </button>
                        </div>
                      </div>

                      {isWeekOpen ? (
                        <div className="grid w-full max-w-full min-w-0 gap-3 overflow-x-hidden px-4 pb-4 pt-4">
                          <SortableContext items={sessions.map((s) => `session:${String(s.id)}`)} strategy={verticalListSortingStrategy}>
                            {sessions.map((s) => {
                              const isSessionOpen = openSessionId === s.id && closedSessionId !== s.id
                              const sessionItems = timelineItemsBySession[s.id] ?? []
                              const summary = sessionItems
                                .slice(0, 8)
                                .map((it) => it.title)
                                .filter(Boolean)
                                .join(' • ')

                              return (
                                <SortableTimelineRow key={s.id} id={`session:${String(s.id)}`} disabled={isSessionDndDisabled}>
                                  {(isDragging) => (
                                    <div
                                      className="w-full max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[rgb(245,245,245)] shadow-md shadow-black/10"
                                      style={isDragging ? { boxShadow: '0 10px 30px rgba(0,0,0,0.12)' } : undefined}
                                    >
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        className="flex w-full max-w-full min-w-0 cursor-pointer items-start justify-between gap-3 px-4 py-3 text-left"
                                        onClick={(e) => {
                                          if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button')) return
                                          const y = typeof window !== 'undefined' ? window.scrollY : null
                                          setClosedSessionId((cur) => (cur === s.id ? null : s.id))
                                          if (!isSessionOpen) {
                                            setOpenSessionId(s.id)
                                            window.setTimeout(() => urlState.setOpenSessionId(s.id, { preserveScroll: true }), 0)
                                          }
                                          window.setTimeout(() => {
                                            if (y != null && typeof window !== 'undefined') {
                                              window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              window.requestAnimationFrame(() => {
                                                window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              })
                                              window.setTimeout(() => {
                                                window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              }, 50)
                                            }
                                          }, 0)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key !== 'Enter' && e.key !== ' ') return
                                          if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button')) return
                                          e.preventDefault()
                                          const y = typeof window !== 'undefined' ? window.scrollY : null
                                          setClosedSessionId((cur) => (cur === s.id ? null : s.id))
                                          if (!isSessionOpen) {
                                            setOpenSessionId(s.id)
                                            window.setTimeout(() => urlState.setOpenSessionId(s.id, { preserveScroll: true }), 0)
                                          }
                                          window.setTimeout(() => {
                                            if (y != null && typeof window !== 'undefined') {
                                              window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              window.requestAnimationFrame(() => {
                                                window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              })
                                              window.setTimeout(() => {
                                                window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
                                              }, 50)
                                            }
                                          }, 0)
                                        }}
                                      >
                                        <div className="min-w-0 flex-1">
                                          {editingSessionId === s.id ? (
                                            <div className="grid gap-2">
                                              <div className="flex min-w-0 items-center gap-2">
                                                <input
                                                  value={editSessionTitle}
                                                  onChange={(e) => setEditSessionTitle(e.target.value)}
                                                  className="h-9 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900"
                                                  onPointerDown={(e) => e.stopPropagation()}
                                                  onClick={(e) => e.stopPropagation()}
                                                  onKeyDown={(e) => e.stopPropagation()}
                                                />
                                                <div className="ml-3 h-8 w-8 flex-none" />
                                              </div>
                                              <textarea
                                                value={editSessionNotes}
                                                onChange={(e) => setEditSessionNotes(e.target.value)}
                                                className="min-h-[72px] w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                                                placeholder="Note"
                                                onPointerDown={(e) => e.stopPropagation()}
                                                onClick={(e) => e.stopPropagation()}
                                                onKeyDown={(e) => e.stopPropagation()}
                                              />
                                              <div className="flex justify-end gap-2">
                                                <button
                                                  type="button"
                                                  className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                                                  disabled={savingSessionId === s.id}
                                                  onPointerDown={(e) => e.stopPropagation()}
                                                  onKeyDown={(e) => e.stopPropagation()}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    saveSessionMeta(w.id, s.id)
                                                  }}
                                                >
                                                  Sauvegarder
                                                </button>
                                                <button
                                                  type="button"
                                                  className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 disabled:opacity-50"
                                                  disabled={savingSessionId === s.id}
                                                  onPointerDown={(e) => e.stopPropagation()}
                                                  onKeyDown={(e) => e.stopPropagation()}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    setEditingSessionId(null)
                                                    setEditSessionTitle('')
                                                    setEditSessionNotes('')
                                                  }}
                                                >
                                                  Annuler
                                                </button>
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="flex min-w-0 items-center">
                                                <div className="min-w-0">
                                                  <div className="flex min-w-0 items-center">
                                                    <div className="min-w-0 truncate text-base font-extrabold tracking-tight text-[var(--brand)]">{s.title}</div>

                                                    {props.updateSessionMetaAction ? (
                                                      <button
                                                        type="button"
                                                        className="ml-3 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                                                        onPointerDownCapture={(e) => e.stopPropagation()}
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                          setEditingSessionId(s.id)
                                                          setEditSessionTitle(s.title)
                                                          setEditSessionNotes(String(s.description ?? '').trim())
                                                        }}
                                                        aria-label="Éditer"
                                                        title="Éditer"
                                                      >
                                                        <IconEdit size={14} />
                                                      </button>
                                                    ) : (
                                                      <div className="ml-3 h-8 w-8 flex-none" />
                                                    )}
                                                  </div>
                                                </div>
                                              </div>

                                              {s.description ? <div className="mt-1 truncate text-sm text-[var(--muted)]">{s.description}</div> : null}
                                              {!isSessionOpen ? (
                                                <div className="mt-1 truncate text-sm text-[var(--muted)]">{summary || 'Cliquer pour construire la séance'}</div>
                                              ) : null}
                                            </>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                                            onPointerDownCapture={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              duplicateSession(w.id, s.id)
                                            }}
                                            aria-label="Dupliquer"
                                            title="Dupliquer"
                                          >
                                            <IconDuplicate size={18} />
                                          </button>
                                          <button
                                            type="button"
                                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90"
                                            onPointerDownCapture={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              deleteSession(w.id, s.id)
                                            }}
                                            aria-label="Supprimer"
                                            title="Supprimer"
                                          >
                                            <IconTrash size={18} />
                                          </button>
                                        </div>
                                      </div>

                                      {isSessionOpen ? (
                                        <div>
                                          <div className="px-4 pb-2 pt-2">
                                            <SortableContext
                                              items={(effectiveSessionItemsBySession[openSessionId] ?? []).map((r) => r.id)}
                                              strategy={verticalListSortingStrategy}
                                            >
                                              <div className="grid gap-0">
                                                <DropMarker
                                                  id="drop-marker:0"
                                                  tall={(timelineItemsBySession[openSessionId] ?? []).length === 0}
                                                  noTop
                                                  active={activeInsertIndex === 0}
                                                />
                                                {(timelineItemsBySession[openSessionId] ?? []).length ? (
                                                  (timelineItemsBySession[openSessionId] ?? []).map((it, idx) => (
                                                    <div key={it.id}>
                                                      <SortableTimelineRow id={it.id} disabled={isDndDisabled}>
                                                        {() => (
                                                          <div
                                                            className={
                                                              isDndDisabled
                                                                ? "grid cursor-default grid-cols-1 gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm shadow-black/10"
                                                                : "grid cursor-pointer grid-cols-1 gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm shadow-black/10 transition-[transform,margin]"
                                                            }
                                                            style={{
                                                              transform:
                                                                activeInsertIndex != null && idx >= activeInsertIndex ? 'translateY(10px)' : undefined,
                                                              marginTop: activeInsertIndex != null && idx === activeInsertIndex ? 10 : 0,
                                                            }}
                                                            onClick={(e) => {
                                                              e.stopPropagation()

                                                              const now = Date.now()
                                                              const last = lastRowClickRef.current
                                                              const isDouble = last.id === it.id && now - last.t <= 280
                                                              lastRowClickRef.current = { id: it.id, t: now }
                                                              if (!isDouble) return

                                                              if (it.kind === 'exercise') beginEditExercise(it as TimelineItem & { kind: 'exercise' })
                                                              if (it.kind === 'block') beginEditBlock(it.blockId)
                                                            }}
                                                          >
                                                            <div className="min-w-0">
                                                              <div className="flex items-center gap-2">
                                                                <div className="truncate text-sm font-extrabold text-[var(--brand)]">{it.title}</div>

                                                          {it.kind === 'exercise' && props.updateProgramExerciseAction ? (
                                                            it.programExerciseId && editingProgramExerciseId === it.programExerciseId ? null : (
                                                              <button
                                                                type="button"
                                                                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200 disabled:opacity-50"
                                                                onPointerDownCapture={(e) => e.stopPropagation()}
                                                                disabled={!!it.programExerciseId && String(it.programExerciseId).startsWith('tmp-pe-')}
                                                                onClick={(e) => {
                                                                  e.preventDefault()
                                                                  e.stopPropagation()
                                                                  if (it.programExerciseId && String(it.programExerciseId).startsWith('tmp-pe-')) return
                                                                  beginEditExercise(it as TimelineItem & { kind: 'exercise' })
                                                                }}
                                                                aria-label="Éditer"
                                                                title="Éditer"
                                                              >
                                                                <IconEdit size={14} />
                                                              </button>
                                                            )
                                                          ) : null}

                                                          {it.kind === 'exercise' && (props.deleteProgramExerciseAction || props.duplicateProgramExerciseAction) ? (
                                                            <div className="ml-auto flex items-center gap-2">
                                                              {props.duplicateProgramExerciseAction ? (
                                                                <button
                                                                  type="button"
                                                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200"
                                                                  onPointerDownCapture={(e) => e.stopPropagation()}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    duplicateExercise(it as TimelineItem & { kind: 'exercise' })
                                                                  }}
                                                                  aria-label="Dupliquer"
                                                                  title="Dupliquer"
                                                                >
                                                                  <IconDuplicate size={18} />
                                                                </button>
                                                              ) : null}

                                                              {props.deleteProgramExerciseAction && it.programExerciseId ? (
                                                                <button
                                                                  type="button"
                                                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200"
                                                                  onPointerDownCapture={(e) => e.stopPropagation()}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    deleteExercise(it.programExerciseId as string)
                                                                  }}
                                                                  aria-label="Supprimer"
                                                                  title="Supprimer"
                                                                >
                                                                  <IconTrash size={18} />
                                                                </button>
                                                              ) : null}
                                                            </div>
                                                          ) : null}

                                                          {it.kind === 'block' && props.updateBlockAction ? (
                                                            editingBlockId === it.blockId || effectiveOpenBlockId === it.blockId ? null : (
                                                              <button
                                                                type="button"
                                                                className="ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200 disabled:opacity-50"
                                                                onPointerDownCapture={(e) => e.stopPropagation()}
                                                                disabled={String(it.blockId).startsWith('tmp-block-')}
                                                                onClick={(e) => {
                                                                  e.preventDefault()
                                                                  e.stopPropagation()
                                                                  if (String(it.blockId).startsWith('tmp-block-')) return
                                                                  beginEditBlock(it.blockId)
                                                                }}
                                                                aria-label="Éditer"
                                                                title="Éditer"
                                                              >
                                                                <IconEdit size={14} />
                                                              </button>
                                                            )
                                                          ) : null}

                                                          {it.kind === 'block' && (props.deleteBlockAction || props.duplicateBlockAction) ? (
                                                            <div className="ml-auto flex items-center gap-2">
                                                              {props.duplicateBlockAction ? (
                                                                <button
                                                                  type="button"
                                                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200"
                                                                  onPointerDownCapture={(e) => e.stopPropagation()}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    duplicateBlock(it.blockId)
                                                                  }}
                                                                  aria-label="Dupliquer"
                                                                  title="Dupliquer"
                                                                >
                                                                  <IconDuplicate size={18} />
                                                                </button>
                                                              ) : null}
                                                              {props.deleteBlockAction ? (
                                                                <button
                                                                  type="button"
                                                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-200"
                                                                  onPointerDownCapture={(e) => e.stopPropagation()}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    deleteBlock(it.blockId)
                                                                  }}
                                                                  aria-label="Supprimer"
                                                                  title="Supprimer"
                                                                >
                                                                  <IconTrash size={18} />
                                                                </button>
                                                              ) : null}
                                                            </div>
                                                          ) : null}
                                                        </div>

                                                        {it.kind === 'exercise' && !(it.programExerciseId && editingProgramExerciseId === it.programExerciseId) ? (
                                                          it.sets != null || it.reps != null || it.rest_time || it.rpe != null || it.tempo || it.load || it.subtitle ? (
                                                            <div className="mt-1 grid gap-1">
                                                              <div className="truncate text-xs text-[var(--muted)]">
                                                                {[
                                                                  it.sets != null ? `${it.sets} séries` : null,
                                                                  it.reps != null ? `${it.reps} reps` : null,
                                                                  it.rest_time ? `repos ${it.rest_time}` : null,
                                                                  it.rpe != null ? `RPE ${it.rpe}` : null,
                                                                  it.tempo ? `tempo ${it.tempo}` : null,
                                                                  it.load ? String(it.load) : null,
                                                                ]
                                                                  .filter(Boolean)
                                                                  .join(' · ')}
                                                              </div>
                                                              {it.subtitle ? <div className="truncate text-xs text-[var(--muted)]">{it.subtitle}</div> : null}
                                                            </div>
                                                          ) : null
                                                        ) : null}

                                                        {it.kind === 'block' && editingBlockId === it.blockId ? (
                                                          null
                                                        ) : null}

                                                        {it.kind === 'exercise' && it.programExerciseId && editingProgramExerciseId === it.programExerciseId ? (
                                                          <div className="mt-2 grid gap-2">
                                                            <div className="grid grid-cols-3 gap-2">
                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">Séries</div>
                                                                <div className="relative">
                                                                  <input
                                                                    value={editSets}
                                                                    onChange={(e) => setEditSets(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pr-9 pl-2 text-sm"
                                                                    inputMode="numeric"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                  />
                                                                  <div className="absolute bottom-1 right-1 top-1 grid w-6 grid-rows-2 overflow-hidden rounded-md bg-white">
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditSets((cur) => stepNumberString(cur, +1, { min: 0 }))
                                                                      }}
                                                                    >
                                                                      +
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditSets((cur) => stepNumberString(cur, -1, { min: 0 }))
                                                                      }}
                                                                    >
                                                                      -
                                                                    </button>
                                                                  </div>
                                                                </div>
                                                              </div>

                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">Rép.</div>
                                                                <div className="relative">
                                                                  <input
                                                                    value={editReps}
                                                                    onChange={(e) => setEditReps(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pr-9 pl-2 text-sm"
                                                                    inputMode="numeric"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                  />
                                                                  <div className="absolute bottom-1 right-1 top-1 grid w-6 grid-rows-2 overflow-hidden rounded-md bg-white">
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditReps((cur) => stepNumberString(cur, +1, { min: 0 }))
                                                                      }}
                                                                    >
                                                                      +
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setEditReps((cur) => stepNumberString(cur, -1, { min: 0 }))
                                                                      }}
                                                                    >
                                                                      -
                                                                    </button>
                                                                  </div>
                                                                </div>
                                                              </div>

                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">Repos (min)</div>
                                                                <div className="relative">
                                                                  <input
                                                                    value={editRestTime}
                                                                    onChange={(e) => setEditRestTime(e.target.value)}
                                                                    className="h-8 w-full rounded-lg border border-gray-200 bg-white pr-9 pl-2 text-sm"
                                                                    placeholder="mm:ss"
                                                                    inputMode="numeric"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                  />
                                                                  <div className="absolute bottom-1 right-1 top-1 grid w-6 grid-rows-2 overflow-hidden rounded-md bg-white">
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        const cur = parseMmSsToSeconds(editRestTime) ?? 0
                                                                        setEditRestTime(formatSecondsToMmSs(cur + 15))
                                                                      }}
                                                                    >
                                                                      +
                                                                    </button>
                                                                    <button
                                                                      type="button"
                                                                      className="flex items-center justify-center text-[11px] font-semibold leading-none text-gray-700 hover:text-gray-900 focus:outline-none"
                                                                      onPointerDown={(e) => e.stopPropagation()}
                                                                      onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        const cur = parseMmSsToSeconds(editRestTime) ?? 0
                                                                        setEditRestTime(formatSecondsToMmSs(Math.max(0, cur - 15)))
                                                                      }}
                                                                    >
                                                                      -
                                                                    </button>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-2">
                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">RPE</div>
                                                                <div className="relative">
                                                                  <select
                                                                    value={editRpe}
                                                                    onChange={(e) => setEditRpe(e.target.value)}
                                                                    className="h-8 w-full appearance-none rounded-lg border border-gray-200 bg-white px-2 pr-8 text-sm"
                                                                    onPointerDown={(e) => e.stopPropagation()}
                                                                  >
                                                                    <option value="">—</option>
                                                                    {Array.from({ length: 10 }).map((_, idx) => {
                                                                      const v = String(idx + 1)
                                                                      return (
                                                                        <option key={v} value={v}>
                                                                          {v}
                                                                        </option>
                                                                      )
                                                                    })}
                                                                  </select>
                                                                  <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-500">
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                                                    </svg>
                                                                  </div>
                                                                </div>
                                                              </div>
                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">Tempo</div>
                                                                <input
                                                                  value={editTempo}
                                                                  onChange={(e) => setEditTempo(e.target.value)}
                                                                  className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
                                                                  placeholder="ex: 3010"
                                                                  onPointerDown={(e) => e.stopPropagation()}
                                                                />
                                                              </div>
                                                              <div className="grid gap-1">
                                                                <div className="text-[11px] font-semibold text-gray-600">Charge (Kg)</div>
                                                                <input
                                                                  value={editLoad}
                                                                  onChange={(e) => setEditLoad(e.target.value)}
                                                                  className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
                                                                  placeholder="ex: 40kg"
                                                                  onPointerDown={(e) => e.stopPropagation()}
                                                                />
                                                              </div>
                                                            </div>

                                                            <div className="grid gap-1">
                                                              <div className="text-[11px] font-semibold text-gray-600">Note</div>
                                                              <textarea
                                                                value={editExerciseNotes}
                                                                onChange={(e) => setEditExerciseNotes(e.target.value)}
                                                                className="min-h-[72px] w-full resize-y rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm"
                                                                placeholder="Note"
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                              />
                                                            </div>

                                                            <div className="flex justify-end gap-2">
                                                              <button
                                                                type="button"
                                                                className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                                                                disabled={savingProgramExerciseId === it.programExerciseId}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                                onClick={(e) => {
                                                                  e.stopPropagation()
                                                                  saveEditExercise(it as TimelineItem & { kind: 'exercise' }, { skipRefresh: true })
                                                                }}
                                                              >
                                                                Sauvegarder
                                                              </button>
                                                              <button
                                                                type="button"
                                                                className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 disabled:opacity-50"
                                                                disabled={savingProgramExerciseId === it.programExerciseId}
                                                                onPointerDown={(e) => e.stopPropagation()}
                                                                onClick={(e) => {
                                                                  e.stopPropagation()
                                                                  cancelEditExercise()
                                                                }}
                                                              >
                                                                Annuler
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ) : null}

                                                        {it.kind === 'block' && props.renderBlockEditor && effectiveOpenBlockId && it.blockId === effectiveOpenBlockId ? (
                                                          <div className="mt-3">
                                                            {props.addBlockExerciseAction ? (
                                                              <BlockEditorDropZone>
                                                                {(() => {
                                                                  const isTmpOpen = Boolean(effectiveOpenBlockId && String(effectiveOpenBlockId).startsWith('tmp-block-'))
                                                                  const editor = props.renderBlockEditor
                                                                  if (!editor) return null
                                                                  if (!isValidElement(editor)) return editor
                                                                  return cloneElement(editor as ReactElement<Record<string, unknown>>, {
                                                                    blockExercises: mergedBlockExercises,
                                                                    sessionBlocks: effectiveSessionBlocks,
                                                                    readOnly: isTmpOpen ? true : undefined,
                                                                  } as Record<string, unknown>)
                                                                })()}
                                                              </BlockEditorDropZone>
                                                            ) : (
                                                              <>
                                                                {(() => {
                                                                  const isTmpOpen = Boolean(effectiveOpenBlockId && String(effectiveOpenBlockId).startsWith('tmp-block-'))
                                                                  const editor = props.renderBlockEditor
                                                                  if (!editor) return null
                                                                  if (!isValidElement(editor)) return editor
                                                                  return cloneElement(editor as ReactElement<Record<string, unknown>>, {
                                                                    blockExercises: mergedBlockExercises,
                                                                    sessionBlocks: effectiveSessionBlocks,
                                                                    readOnly: isTmpOpen ? true : undefined,
                                                                  } as Record<string, unknown>)
                                                                })()}
                                                              </>
                                                            )}
                                                          </div>
                                                        ) : null}

                                                        {it.kind === 'block' && (!effectiveOpenBlockId || it.blockId !== effectiveOpenBlockId) ? (
                                                          <div className="mt-2 grid gap-1">
                                                            {it.subtitle ? <div className="text-xs text-gray-600">{it.subtitle}</div> : null}
                                                            {(blockExercisesByBlockId[it.blockId] ?? []).length ? (
                                                              <div className="mt-1">
                                                                <div className="grid gap-1">
                                                                  {(blockExercisesByBlockId[it.blockId] ?? []).slice(0, 4).map((be) => (
                                                                    <div key={be.id} className="grid min-w-0 grid-cols-[minmax(0,220px)_minmax(0,220px)] items-center gap-0">
                                                                      <div className="min-w-0 truncate pr-2 text-xs font-semibold text-[var(--brand)]">
                                                                        {be.exercise_library?.name ?? be.exercise_name ?? 'Exercice'}
                                                                      </div>
                                                                      {be.notes ? (
                                                                        <div className="truncate border-l border-gray-200 pl-2 text-left text-[11px] text-gray-600">
                                                                          {be.notes}
                                                                        </div>
                                                                      ) : null}
                                                                    </div>
                                                                  ))}
                                                                </div>

                                                                {(blockExercisesByBlockId[it.blockId] ?? []).length > 4 ? (
                                                                  <div className="mt-2 border-t border-gray-100 pt-2 text-[11px] font-semibold text-gray-500">
                                                                    +{(blockExercisesByBlockId[it.blockId] ?? []).length - 4} exercices
                                                                  </div>
                                                                ) : null}
                                                              </div>
                                                            ) : (
                                                              <div className="text-xs text-gray-500">Aucun exercice.</div>
                                                            )}
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    </div>
                                                  )}
                                                </SortableTimelineRow>
                                                <DropMarker id={`drop-marker:${idx + 1}`} active={activeInsertIndex === idx + 1} />
                                              </div>
                                            ))
                                          ) : (
                                            <div className="px-3 py-6 text-sm text-gray-600">Cliquer pour construire la séance.</div>
                                          )}
                                        </div>
                                      </SortableContext>
                                    </div>

                                    <div className="mt-0 px-3 pb-4">
                                      <div className="grid grid-cols-2 gap-0.5">
                                        <button
                                          type="button"
                                          className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()

                                            if (!openSessionId) return
                                            setOpenAddPanel((prev) =>
                                              prev && prev.sessionId === openSessionId && prev.kind === 'exercise'
                                                ? null
                                                : { sessionId: openSessionId, kind: 'exercise' }
                                            )
                                          }}
                                        >
                                          + Exercice
                                        </button>
                                        <button
                                          type="button"
                                          className="inline-flex h-12 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
                                          onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()

                                            if (!openSessionId) return
                                            setOpenAddPanel((prev) =>
                                              prev && prev.sessionId === openSessionId && prev.kind === 'block'
                                                ? null
                                                : { sessionId: openSessionId, kind: 'block' }
                                            )
                                          }}
                                        >
                                          + Bloc
                                        </button>
                                      </div>

                                      {openSessionId && openAddPanel?.sessionId === openSessionId && openAddPanel.kind === 'exercise' ? (
                                        <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3 shadow-sm shadow-black/10">
                                          <div className="grid grid-cols-[1fr_180px] gap-2">
                                            <input
                                              value={addExerciseQuery}
                                              onChange={(e) => setAddExerciseQuery(e.target.value)}
                                              placeholder="Rechercher…"
                                              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                                              onPointerDownCapture={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <select
                                              value={addExerciseMuscle}
                                              onChange={(e) => setAddExerciseMuscle(e.target.value)}
                                              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                                              onPointerDownCapture={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <option value="">Muscle</option>
                                              {(props.muscleGroups ?? []).map((m) => (
                                                <option key={m} value={m}>
                                                  {m}
                                                </option>
                                              ))}
                                            </select>
                                          </div>

                                          {addExerciseQuery.trim() || addExerciseMuscle.trim() ? (
                                            <div className="mt-2 grid gap-1">
                                              {filteredAddExerciseLibrary.slice(0, 8).map((ex) => (
                                                <button
                                                  key={ex.id}
                                                  type="button"
                                                  className="flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3 text-left text-sm font-semibold text-[var(--brand)] hover:bg-gray-50"
                                                  onPointerDownCapture={(e) => e.stopPropagation()}
                                                  onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    if (!openSessionId) return

                                                    const rows = (effectiveSessionItemsBySession[openSessionId] ?? []).slice()
                                                    const insertPosition = rows.length
                                                    insertExerciseAt(openSessionId, insertPosition, String(ex.id))
                                                    setOpenAddPanel(null)
                                                    setAddExerciseQuery('')
                                                    setAddExerciseMuscle('')
                                                  }}
                                                >
                                                  <div className="min-w-0 truncate">{String(ex.name ?? '').trim() || '—'}</div>
                                                  {ex.muscle_group ? (
                                                    <div className="ml-auto truncate pl-2 text-xs font-semibold text-gray-500">
                                                      {String(ex.muscle_group)}
                                                    </div>
                                                  ) : null}
                                                </button>
                                              ))}
                                              {!filteredAddExerciseLibrary.length ? (
                                                <div className="py-2 text-sm text-gray-600">Aucun exercice.</div>
                                              ) : null}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}

                                      {openSessionId && openAddPanel?.sessionId === openSessionId && openAddPanel.kind === 'block' ? (
                                        <div className="mt-2 rounded-xl border border-[var(--border)] bg-white px-3 py-3 shadow-sm shadow-black/10">
                                          <div className="grid grid-cols-[180px_1fr] gap-2">
                                            <select
                                              value={addBlockUiType}
                                              onChange={(e) => setAddBlockUiType(e.target.value as 'warmup' | 'crossfit' | 'superset')}
                                              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                                            >
                                              <option value="warmup">Warm-up</option>
                                              <option value="crossfit">CrossFit</option>
                                              <option value="superset">Superset</option>
                                            </select>
                                            <input
                                              value={addBlockTitle}
                                              onChange={(e) => setAddBlockTitle(e.target.value)}
                                              placeholder="Titre…"
                                              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
                                              onPointerDownCapture={(e) => e.stopPropagation()}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>

                                          <button
                                            type="button"
                                            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[rgb(245,245,245)] px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
                                            onPointerDownCapture={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                              e.preventDefault()
                                              e.stopPropagation()
                                              if (!openSessionId) return

                                              const rows = (effectiveSessionItemsBySession[openSessionId] ?? []).slice()
                                              const insertPosition = rows.length
                                              insertBlockAt(openSessionId, insertPosition, addBlockUiType, { titleOverride: addBlockTitle })
                                              setOpenAddPanel(null)
                                              setAddBlockTitle('')
                                            }}
                                          >
                                            + Créer
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                                    </div>
                                  )}
                                </SortableTimelineRow>
                            )
                          })}
                          </SortableContext>

                          <div className="mt-3">
                            <button
                              type="button"
                              className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[rgb(245,245,245)] px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()

                                if (!props.addSessionAction) return

                                const tmpSessionId = `tmp-session-${crypto.randomUUID()}`
                                const maxOrder = Math.max(-1, ...((sessionsByWeek[w.id] ?? []).map((s) => s.session_order ?? 0)))
                                setOptimisticSessions((prev) =>
                                  prev.concat([
                                    {
                                      id: tmpSessionId,
                                      week_id: w.id,
                                      title: 'Séance',
                                      description: null,
                                      session_order: maxOrder + 1,
                                    },
                                  ])
                                )
                                setOpenWeekId(w.id)
                                setClosedSessionId(null)
                                setOpenSessionId(tmpSessionId)
                                window.setTimeout(() => urlState.setOpenSessionId(tmpSessionId, { preserveScroll: true }), 0)

                                const fd = new FormData()
                                fd.set('client', '1')
                                fd.set('week_id', w.id)
                                fd.set('title', 'Séance')
                                startTransition(async () => {
                                  try {
                                    const res = (await props.addSessionAction?.(fd)) as void | { newSessionId?: string | null }
                                    const newSessionId = res && typeof res === 'object' ? (res.newSessionId ?? null) : null
                                    if (newSessionId) {
                                      setOptimisticSessions((prev) =>
                                        prev.map((s) => (String(s.id) === String(tmpSessionId) ? { ...s, id: String(newSessionId) } : s))
                                      )
                                      setOpenSessionId(String(newSessionId))
                                      window.setTimeout(() => urlState.setOpenSessionId(String(newSessionId), { preserveScroll: true }), 0)
                                    }
                                  } finally {
                                    // no refresh: we keep optimistic UI to avoid loading/scroll jumps
                                  }
                                })
                              }}
                            >
                              + Ajouter un training
                            </button>
                          </div>

                          {!sessions.length ? <div className="text-sm text-[var(--muted)]">Aucun training.</div> : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}

                <div className="mt-3">
                  <button
                    type="button"
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] shadow-sm shadow-black/10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()

                      if (!props.addWeekAction) return

                      const tmpWeekId = `tmp-week-${crypto.randomUUID()}`
                      const maxOrder = Math.max(-1, ...orderedWeeks.map((w) => w.week_order ?? 0))
                      setOptimisticWeeks((prev) =>
                        prev.concat([
                          {
                            id: tmpWeekId,
                            title: 'Semaine',
                            week_order: maxOrder + 1,
                            notes: null,
                          },
                        ])
                      )
                      setOpenWeekId(tmpWeekId)
                      setClosedSessionId(null)
                      setOpenSessionId(null)

                      const fd = new FormData()
                      fd.set('client', '1')
                      fd.set('title', 'Semaine')
                      startTransition(async () => {
                        try {
                          const res = (await props.addWeekAction?.(fd)) as
                            | void
                            | { newWeekId?: string | null; week_order?: number | null; title?: string | null; notes?: string | null }

                          const resObj: { newWeekId?: string | null; week_order?: number | null; title?: string | null; notes?: string | null } | null =
                            res && typeof res === 'object' ? (res as { newWeekId?: string | null; week_order?: number | null; title?: string | null; notes?: string | null }) : null
                          const realId = resObj ? (resObj.newWeekId ?? null) : null
                          if (realId) {
                            setOptimisticWeeks((prev) =>
                              prev
                                .filter((w) => w.id !== tmpWeekId)
                                .concat([
                                  {
                                    id: String(realId),
                                    title: String(resObj?.title ?? 'Semaine'),
                                    week_order: ((resObj?.week_order ?? maxOrder + 1) as number) ?? maxOrder + 1,
                                    notes: (resObj?.notes ?? null) as string | null,
                                  },
                                ])
                            )
                            setOpenWeekId(String(realId))
                          }
                        } finally {
                          // no refresh: we keep optimistic UI to avoid loading/scroll jumps
                        }
                      })
                    }}
                  >
                    + Ajouter une semaine
                  </button>
                </div>
                </div>
              </div>
            </div>

            <div className="hidden min-[1000px]:block min-[1000px]:col-start-3 min-[1000px]:sticky min-[1000px]:top-[136px] min-[1000px]:z-10 min-[1000px]:self-start min-[1000px]:max-h-[calc(100vh-156px)] min-[1000px]:overflow-auto min-w-0">
              <div className="flex min-h-0 flex-col rounded-2xl border border-gray-200 bg-[rgb(245,245,245)] min-[1000px]:max-h-[calc(100vh-156px)] min-[1000px]:overflow-auto">
                <div className="sticky top-0 z-10 bg-[rgb(245,245,245)] px-3 pb-3 pt-3">
                  <div className="text-xs font-extrabold text-[var(--brand)]">Exercices</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Bibliothèque (drag &amp; drop)</div>

                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={libraryQuery}
                      onChange={(e) => setLibraryQuery(e.target.value)}
                      placeholder="Rechercher…"
                      className="h-10 w-full min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm"
                    />
                    <select
                      value={libraryMuscle}
                      onChange={(e) => setLibraryMuscle(e.target.value)}
                      className="h-10 w-[120px] flex-none rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm"
                    >
                      <option value="">Muscle</option>
                      {(props.muscleGroups ?? []).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {props.insertSessionItemExerciseAtPositionAction && filteredExerciseLibrary.length ? (
                  <div className="relative mt-3 px-3 pb-3 pr-1">
                    <LibraryNeutralDropZone active={!!activeDragId} />
                    <div className="grid gap-2">
                      {filteredExerciseLibrary.map((ex) => (
                        <LibraryExerciseDraggable
                          key={ex.id}
                          id={`library-exercise:${ex.id}`}
                          label={String(ex.name ?? '').trim() || '—'}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 px-3 pb-3 text-sm text-gray-600">Aucun exercice.</div>
                )}
              </div>
            </div>
          </div>
        </DndContext>
      )}
    </>
  )
}
