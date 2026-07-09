'use client'

import type { DragEndEvent, DraggableAttributes } from '@dnd-kit/core'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Transform } from '@dnd-kit/utilities'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMarkProgramEditorReady } from './ProgramEditorNavigationClient'
import type { ReactNode } from 'react'
import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import ExerciseSearchClient from './ExerciseSearchClient'
import { IconCheck, IconDuplicate, IconEdit, IconNote, IconNoteValidated, IconPlus, IconSearch, IconTrash } from './ui/icons'

function IconRotate() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

type WeekRow = {
  id: string
  title: string
  week_order: number
}

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

type SessionBlockRow = {
  id: string
  program_session_id: string
  position: number
  type: string
  title: string | null
  notes: string | null
  crosstraining_style?: string | null
}

type BlockExerciseRow = {
  id: string
  session_block_id: string
  position: number
  exercise_id: string | null
  exercise_name: string | null
  load_text: string | null
  exercise_library?: { name: string } | null
}

type LibraryExercise = {
  id: string
  name: string
  muscle_group: string | null
  difficulty: string | null
}

type ProgramExerciseRow = {
  id: string
  session_id: string
  exercise_id: string | null
  name?: string | null
  exercise_order: number
  sets: number | null
  reps: number | null
  rest_time: string | null
  rpe?: number | null
  tempo: string | null
  load: string | null
  notes: string | null
  exercise_library: { name: string } | null
}

type Props = {
  programId: string
  readOnly: boolean
  hideExercises?: boolean
  weeks: WeekRow[]
  sessions: SessionRow[]
  programExercises: ProgramExerciseRow[]
  sessionBlocks?: SessionBlockRow[]
  blockExercises?: BlockExerciseRow[]
  openWeek?: string
  openSession?: string
  replaceExerciseId?: string
  uniqueMuscles: string[]
  addBlockAction?: (formData: FormData) => Promise<void>
  addBlockExerciseAction?: (formData: FormData) => Promise<void>
  updateBlockAction?: (formData: FormData) => Promise<void>
  deleteBlockAction?: (formData: FormData) => Promise<void>
  duplicateBlockAction?: (formData: FormData) => Promise<{ newBlockId?: string | null } | void>
  updateBlockExerciseAction?: (formData: FormData) => Promise<void>
  addWeekAction: (formData: FormData) => Promise<void>
  deleteWeekAction: (formData: FormData) => Promise<void>
  duplicateWeekAction: (formData: FormData) => Promise<void>
  addSessionAction: (formData: FormData) => Promise<void>
  deleteSessionAction: (formData: FormData) => Promise<void>
  duplicateSessionAction: (formData: FormData) => Promise<{ newSessionId?: string } | void>
  updateWeekTitleAction: (formData: FormData) => Promise<void>
  updateSessionTitleAction: (formData: FormData) => Promise<void>
  addExerciseToSessionAction: (formData: FormData) => Promise<void>
  replaceProgramExerciseAction: (formData: FormData) => Promise<void>
  deleteProgramExerciseAction: (formData: FormData) => Promise<void>
}

function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string
  disabled: boolean
  children: (args: {
    setNodeRef: (element: HTMLElement | null) => void
    setActivatorNodeRef: (element: HTMLElement | null) => void
    attributes: DraggableAttributes
    listeners: Record<string, unknown> | undefined
    isDragging: boolean
    transform: Transform | null
    transition: string | undefined
  }) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      {children({
        setNodeRef,
        setActivatorNodeRef,
        attributes,
        listeners,
        isDragging,
        transform,
        transition,
      })}
    </div>
  )
}

function StaticItem({
  children,
}: {
  children: (args: {
    setNodeRef: (element: HTMLElement | null) => void
    setActivatorNodeRef: (element: HTMLElement | null) => void
    attributes: DraggableAttributes
    listeners: Record<string, unknown> | undefined
    isDragging: boolean
    transform: Transform | null
    transition: string | undefined
  }) => ReactNode
}) {
  return (
    <div>
      {children({
        setNodeRef: () => {},
        setActivatorNodeRef: () => {},
        attributes: {} as DraggableAttributes,
        listeners: undefined,
        isDragging: false,
        transform: null,
        transition: undefined,
      })}
    </div>
  )
}

export default function ProgramStructureClient(props: Props) {
  useMarkProgramEditorReady()

  const router = useRouter()
  const [, startTransition] = useTransition()

  const hideExercises = props.hideExercises === true

  const mutationChainRef = useRef<Promise<void>>(Promise.resolve())
  const refreshTimerRef = useRef<number | null>(null)
  const pendingScrollYRef = useRef<number | null>(null)

  function requestRefresh() {
    pendingScrollYRef.current = window.scrollY
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current)
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null
      router.refresh()
      const y = pendingScrollYRef.current
      if (typeof y === 'number') {
        pendingScrollYRef.current = null
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, left: 0, behavior: 'auto' })
          window.setTimeout(() => {
            window.scrollTo({ top: y, left: 0, behavior: 'auto' })
          }, 50)
        })
      }
    }, 250)
  }

  function enqueueMutation(task: () => Promise<void>) {
    mutationChainRef.current = mutationChainRef.current
      .then(async () => {
        await task()
      })
      .catch(() => {
        // keep chain alive
      })
    return mutationChainRef.current
  }

  const urlSyncTimerRef = useRef<number | null>(null)

  type PendingUndo =
    | {
        kind: 'week'
        timeoutId: ReturnType<typeof setTimeout>
        week: WeekRow
        weekId: string
        sessionsByWeek: Record<string, SessionRow[]>
        exercisesBySession: Record<string, ProgramExerciseRow[]>
      }
    | {
        kind: 'session'
        timeoutId: ReturnType<typeof setTimeout>
        weekId: string
        session: SessionRow
        exercisesBySession: Record<string, ProgramExerciseRow[]>
      }

  const pendingUndoRef = useRef<PendingUndo | null>(null)

  function commitPendingUndoNow() {
    const pending = pendingUndoRef.current
    if (!pending) return
    clearTimeout(pending.timeoutId)
    pendingUndoRef.current = null

    if (pending.kind === 'week') {
      enqueueMutation(async () => {
        const fd = new FormData()
        fd.set('week_id', pending.weekId)
        fd.set('client', '1')
        await props.deleteWeekAction(fd)
        requestRefresh()
      })
      return
    }

    enqueueMutation(async () => {
      const fd = new FormData()
      fd.set('week_id', pending.weekId)
      fd.set('session_id', pending.session.id)
      fd.set('client', '1')
      await props.deleteSessionAction(fd)
      requestRefresh()
    })
  }

  function undoLastDeletion() {
    const pending = pendingUndoRef.current
    if (!pending) return
    clearTimeout(pending.timeoutId)
    pendingUndoRef.current = null

    if (pending.kind === 'week') {
      setWeeksDirty(true)
      setWeeksState((prev) => {
        const list = prev ?? []
        if (list.some((w) => w.id === pending.weekId)) return list
        return [...list, pending.week].sort((a, b) => (a.week_order ?? 0) - (b.week_order ?? 0))
      })
      setSessionsDirty((prev) => ({ ...prev, [pending.weekId]: true }))
      setSessionsByWeek((prev) => ({ ...prev, [pending.weekId]: pending.sessionsByWeek[pending.weekId] ?? [] }))
      setExercisesDirty((prev) => {
        const next = { ...prev }
        for (const sessionId of Object.keys(pending.exercisesBySession)) next[sessionId] = true
        return next
      })
      setExercisesBySession((prev) => ({ ...prev, ...pending.exercisesBySession }))
      return
    }

    setSessionsDirty((prev) => ({ ...prev, [pending.weekId]: true }))
    setSessionsByWeek((prev) => {
      const list = prev[pending.weekId] ?? []
      if (list.some((s) => s.id === pending.session.id)) return prev
      return {
        ...prev,
        [pending.weekId]: [...list, pending.session].sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0)),
      }
    })
    setExercisesDirty((prev) => ({ ...prev, [pending.session.id]: true }))
    setExercisesBySession((prev) => ({ ...prev, ...pending.exercisesBySession }))
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 2 } }))

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const dndEnabled = mounted && !props.readOnly

  const [openWeekId, setOpenWeekId] = useState<string | null>(props.openWeek ?? null)
  const [openSessionId, setOpenSessionId] = useState<string | null>(props.openSession ?? null)
  const [replaceExerciseId, setReplaceExerciseId] = useState<string | null>(props.replaceExerciseId ?? null)
  const [weekCloseNonceById, setWeekCloseNonceById] = useState<Record<string, number>>({})

  useEffect(() => {
    if (props.openWeek) {
      setOpenWeekId(props.openWeek)
    }
  }, [props.openWeek])

  useEffect(() => {
    if (props.openSession) {
      setOpenSessionId(props.openSession)
    }
  }, [props.openSession])

  useEffect(() => {
    if (props.replaceExerciseId) {
      setReplaceExerciseId(props.replaceExerciseId)
    }
  }, [props.replaceExerciseId])

  useEffect(() => {
    if (urlSyncTimerRef.current != null) {
      window.clearTimeout(urlSyncTimerRef.current)
    }
    urlSyncTimerRef.current = window.setTimeout(() => {
      urlSyncTimerRef.current = null

      const url = new URL(window.location.href)
      if (openWeekId) url.searchParams.set('openWeek', openWeekId)
      else url.searchParams.delete('openWeek')

      if (openSessionId) url.searchParams.set('openSession', openSessionId)
      else url.searchParams.delete('openSession')

      if (replaceExerciseId) url.searchParams.set('replaceExercise', replaceExerciseId)
      else url.searchParams.delete('replaceExercise')

      router.replace(url.pathname + url.search, { scroll: false })
    }, 150)
  }, [openSessionId, openWeekId, replaceExerciseId, router])

  const [weeksState, setWeeksState] = useState<WeekRow[]>(props.weeks)
  const [weeksDirty, setWeeksDirty] = useState(false)
  const [expectedWeeksCount, setExpectedWeeksCount] = useState<number | null>(null)

  const [editingWeekId, setEditingWeekId] = useState<string | null>(null)
  const [editingWeekTitle, setEditingWeekTitle] = useState('')

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingSessionTitle, setEditingSessionTitle] = useState('')

  const lastWeekTitleClickRef = useRef<{ at: number; weekId: string } | null>(null)
  const lastSessionTitleClickRef = useRef<{ at: number; sessionId: string } | null>(null)

  const sessionsByWeekInitial = useMemo(() => {
    const m = new Map<string, SessionRow[]>()
    for (const s of props.sessions) {
      const list = m.get(s.week_id) ?? []
      list.push(s)
      m.set(s.week_id, list)
    }
    for (const [k, list] of m) {
      list.sort((a, b) => a.session_order - b.session_order)
      m.set(k, list)
    }
    return m
  }, [props.sessions])

  const [sessionsByWeek, setSessionsByWeek] = useState<Record<string, SessionRow[]>>(() => {
    const obj: Record<string, SessionRow[]> = {}
    for (const [weekId, list] of sessionsByWeekInitial) obj[weekId] = list
    return obj
  })

  const [sessionsDirty, setSessionsDirty] = useState<Record<string, boolean>>({})
  const [expectedSessionsCountByWeekId, setExpectedSessionsCountByWeekId] = useState<Record<string, number>>({})

  useEffect(() => {
    if (weeksDirty) {
      if (expectedWeeksCount != null && props.weeks.length === expectedWeeksCount) {
        setWeeksState(props.weeks)
        setWeeksDirty(false)
        setExpectedWeeksCount(null)
      }
      return
    }

    setWeeksState(props.weeks)
  }, [expectedWeeksCount, props.weeks, weeksDirty])

  function optimisticUpdateWeekTitle(weekId: string, title: string) {
    setWeeksDirty(true)
    setWeeksState((prev) => prev.map((w) => (w.id === weekId ? { ...w, title } : w)))
  }

  function optimisticUpdateSessionTitle(weekId: string, sessionId: string, title: string) {
    setSessionsDirty((prev) => ({ ...prev, [weekId]: true }))
    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      return {
        ...prev,
        [weekId]: list.map((s) => (s.id === sessionId ? { ...s, title } : s)),
      }
    })
  }

  async function saveWeekTitle(weekId: string, title: string) {
    const fd = new FormData()
    fd.set('week_id', weekId)
    fd.set('title', title)
    fd.set('openWeek', openWeekId ?? '')
    fd.set('openSession', openSessionId ?? '')
    fd.set('client', '1')

    await enqueueMutation(async () => {
      await props.updateWeekTitleAction(fd)
      requestRefresh()
    })
  }

  async function saveSessionTitle(weekId: string, sessionId: string, title: string) {
    const fd = new FormData()
    fd.set('week_id', weekId)
    fd.set('session_id', sessionId)
    fd.set('title', title)
    fd.set('openWeek', openWeekId ?? '')
    fd.set('openSession', openSessionId ?? '')
    fd.set('client', '1')

    await enqueueMutation(async () => {
      await props.updateSessionTitleAction(fd)
      requestRefresh()
    })
  }

  useEffect(() => {
    setSessionsByWeek((prev) => {
      const next: Record<string, SessionRow[]> = { ...prev }
      for (const [weekId, list] of sessionsByWeekInitial) {
        if (!sessionsDirty[weekId]) {
          next[weekId] = list
        }
      }
      return next
    })
  }, [sessionsByWeekInitial, sessionsDirty])

  useEffect(() => {
    for (const [weekId, expectedCount] of Object.entries(expectedSessionsCountByWeekId)) {
      const current = sessionsByWeekInitial.get(weekId) ?? []
      if (current.length === expectedCount) {
        setSessionsDirty((prev) => ({ ...prev, [weekId]: false }))
        setExpectedSessionsCountByWeekId((prev) => {
          const next = { ...prev }
          delete next[weekId]
          return next
        })
      }
    }
  }, [expectedSessionsCountByWeekId, sessionsByWeekInitial])

  function optimisticDuplicateWeek(sourceWeekId: string) {
    setWeeksDirty(true)
    setExpectedWeeksCount((weeksState?.length ?? 0) + 1)

    const tmpWeekId = `tmp-${crypto.randomUUID()}`

    const sourceWeek = (weeksState ?? []).find((w) => w.id === sourceWeekId)
    const sourceSessions = (sessionsByWeekInitial.get(sourceWeekId) ?? sessionsByWeek[sourceWeekId] ?? [])
      .slice()
      .sort((a, b) => a.session_order - b.session_order)
    const sessionIdPairs = sourceSessions.map((s) => ({ sourceSessionId: s.id, tmpSessionId: `tmp-${crypto.randomUUID()}` }))

    setWeeksState((prev) => {
      const list = prev ?? []
      const maxOrder = list.reduce((acc, w) => Math.max(acc, w.week_order ?? 0), 0)

      return [
        ...list,
        {
          id: tmpWeekId,
          title: `${sourceWeek?.title ?? ''} (copie...)`,
          week_order: maxOrder + 1,
        },
      ]
    })

    setSessionsDirty((prev) => ({ ...prev, [tmpWeekId]: true }))
    setSessionsByWeek((prev) => {
      const clonedSessions: SessionRow[] = sourceSessions.map((s, idx) => {
        const nextId = sessionIdPairs[idx].tmpSessionId
        return {
          ...s,
          id: nextId,
          week_id: tmpWeekId,
        }
      })

      return {
        ...prev,
        [tmpWeekId]: clonedSessions,
      }
    })

    setExercisesDirty((prev) => {
      const next = { ...prev }
      for (const pair of sessionIdPairs) next[pair.tmpSessionId] = true
      return next
    })
    setExercisesBySession((prev) => {
      const next: Record<string, ProgramExerciseRow[]> = { ...prev }

      for (const pair of sessionIdPairs) {
        const sourceList = prev[pair.sourceSessionId] ?? exercisesBySessionInitial[pair.sourceSessionId] ?? []
        next[pair.tmpSessionId] = sourceList
          .slice()
          .sort((a, b) => a.exercise_order - b.exercise_order)
          .map((pe) => ({
            ...pe,
            id: `tmp-${crypto.randomUUID()}`,
            session_id: pair.tmpSessionId,
          }))
      }

      return next
    })

    return sessionIdPairs[0]?.tmpSessionId ?? null
  }

  function optimisticAddWeek() {
    setWeeksDirty(true)
    setExpectedWeeksCount((weeksState?.length ?? 0) + 1)
    setWeeksState((prev) => {
      const maxOrder = prev.reduce((acc, w) => Math.max(acc, w.week_order), 0)
      const tmpId = `tmp-week-${Date.now()}`
      return [...prev, { id: tmpId, title: 'Semaine (ajout...)', week_order: maxOrder + 1 }]
    })
  }

  function optimisticDeleteWeek(weekId: string) {
    setWeeksDirty(true)
    setExpectedWeeksCount(Math.max(0, (weeksState?.length ?? 0) - 1))
    setWeeksState((prev) => prev.filter((w) => w.id !== weekId))
    setSessionsByWeek((prev) => {
      const next = { ...prev }
      delete next[weekId]
      return next
    })
  }

  function optimisticAddSession(weekId: string) {
    setSessionsDirty((prev) => ({ ...prev, [weekId]: true }))
    setExpectedSessionsCountByWeekId((prev) => {
      const currentCount = (sessionsByWeekInitial.get(weekId) ?? []).length
      return { ...prev, [weekId]: currentCount + 1 }
    })
    const tmpId = `tmp-session-${Date.now()}`

    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      const maxOrder = list.reduce((acc, s) => Math.max(acc, s.session_order), 0)
      return {
        ...prev,
        [weekId]: [
          ...list,
          {
            id: tmpId,
            week_id: weekId,
            title: 'Séance (ajout...)',
            description: null,
            session_order: maxOrder + 1,
          },
        ],
      }
    })

    return tmpId
  }

  function optimisticDuplicateSession(weekId: string, sourceSessionId: string) {
    setSessionsDirty((prev) => ({ ...prev, [weekId]: true }))
    setExpectedSessionsCountByWeekId((prev) => {
      const currentCount = (sessionsByWeekInitial.get(weekId) ?? []).length
      return { ...prev, [weekId]: currentCount + 1 }
    })

    const tmpSessionId = `tmp-${crypto.randomUUID()}`

    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      const maxOrder = list.reduce((acc, s) => Math.max(acc, s.session_order ?? 0), 0)
      const source = list.find((s) => s.id === sourceSessionId)
      const next: Record<string, SessionRow[]> = { ...prev }
      next[weekId] = [
        ...list,
        {
          id: tmpSessionId,
          week_id: weekId,
          title: `${source?.title ?? ''} (copie...)`,
          description: source?.description ?? null,
          session_order: maxOrder + 1,
        },
      ]
      return next
    })

    setExercisesDirty((prev) => ({ ...prev, [tmpSessionId]: true }))
    setExercisesBySession((prev) => {
      const sourceList = prev[sourceSessionId] ?? exercisesBySessionInitial[sourceSessionId] ?? []
      const cloned: ProgramExerciseRow[] = sourceList
        .slice()
        .sort((a, b) => a.exercise_order - b.exercise_order)
        .map((pe) => ({
          ...pe,
          id: `tmp-${crypto.randomUUID()}`,
          session_id: tmpSessionId,
        }))

      return {
        ...prev,
        [tmpSessionId]: cloned,
      }
    })

    return tmpSessionId
  }

  function optimisticDeleteSession(weekId: string, sessionId: string) {
    setSessionsDirty((prev) => ({ ...prev, [weekId]: true }))
    setExpectedSessionsCountByWeekId((prev) => {
      const currentCount = (sessionsByWeekInitial.get(weekId) ?? []).length
      return { ...prev, [weekId]: Math.max(0, currentCount - 1) }
    })
    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      const deleted = list.find((s) => s.id === sessionId)
      const deletedOrder = deleted?.session_order ?? null
      const remaining = list.filter((s) => s.id !== sessionId)
      const renumbered =
        deletedOrder == null
          ? remaining
          : remaining.map((s) =>
              s.session_order > deletedOrder ? { ...s, session_order: s.session_order - 1 } : s
            )
      return { ...prev, [weekId]: renumbered }
    })
  }

  const exercisesBySessionInitial: Record<string, ProgramExerciseRow[]> = (() => {
    const obj: Record<string, ProgramExerciseRow[]> = {}
    for (const pe of props.programExercises) {
      const list = obj[pe.session_id] ?? []
      list.push(pe)
      obj[pe.session_id] = list
    }
    for (const sessionId of Object.keys(obj)) {
      obj[sessionId].sort((a, b) => a.exercise_order - b.exercise_order)
    }
    return obj
  })()

  const [exercisesBySessionState, setExercisesBySession] = useState<Record<string, ProgramExerciseRow[]>>(() => exercisesBySessionInitial)
  const [exercisesDirty, setExercisesDirty] = useState<Record<string, boolean>>({})
  const [optimisticallyDeletedExerciseIdsBySession, setOptimisticallyDeletedExerciseIdsBySession] = useState<
    Record<string, Record<string, true>>
  >({})
  const [notesOpenByExerciseId, setNotesOpenByExerciseId] = useState<Record<string, boolean>>({})
  const [notesDraftByExerciseId, setNotesDraftByExerciseId] = useState<Record<string, string>>({})
  const [notesDirtyByExerciseId, setNotesDirtyByExerciseId] = useState<Record<string, boolean>>({})
  const [notesConfirmedByExerciseId, setNotesConfirmedByExerciseId] = useState<Record<string, boolean>>({})
  const [notesClearedByExerciseId, setNotesClearedByExerciseId] = useState<Record<string, boolean>>({})
  const [addOpenBySessionId, setAddOpenBySessionId] = useState<Record<string, boolean>>({})
  const [addBlockOpenBySessionId, setAddBlockOpenBySessionId] = useState<Record<string, boolean>>({})
  const [selectedBlockIdBySessionId, setSelectedBlockIdBySessionId] = useState<Record<string, string | null>>({})
  const [blockSavedFlashById, setBlockSavedFlashById] = useState<Record<string, number>>({})
  const [blockLockedById, setBlockLockedById] = useState<Record<string, boolean>>({})
  const [blockDraftById, setBlockDraftById] = useState<Record<string, { title: string; notes: string }>>({})
  const pendingStructureSaveRef = useRef(false)
  const inputRefs = useRef<
    Record<
      string,
      {
        sets?: HTMLInputElement | null
        reps?: HTMLInputElement | null
        rest?: HTMLInputElement | null
        load?: HTMLInputElement | null
      }
    >
  >({})

  const exercisesBySession = useMemo(() => {
    const next: Record<string, ProgramExerciseRow[]> = { ...exercisesBySessionState }

    for (const [sessionId, list] of Object.entries(exercisesBySessionInitial)) {
      if (!exercisesDirty[sessionId]) {
        const deletedMap = optimisticallyDeletedExerciseIdsBySession[sessionId]
        next[sessionId] = deletedMap ? list.filter((pe) => !deletedMap[pe.id]) : list
      }
    }

    for (const [sessionId, list] of Object.entries(next)) {
      const deletedMap = optimisticallyDeletedExerciseIdsBySession[sessionId]
      if (deletedMap) {
        next[sessionId] = list.filter((pe) => !deletedMap[pe.id])
      }
    }

    return next
  }, [exercisesBySessionInitial, exercisesBySessionState, exercisesDirty, optimisticallyDeletedExerciseIdsBySession])

  const blocksBySessionId = useMemo(() => {
    const out: Record<string, SessionBlockRow[]> = {}
    for (const b of props.sessionBlocks ?? []) {
      const list = out[b.program_session_id] ?? []
      list.push(b)
      out[b.program_session_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return out
  }, [props.sessionBlocks])

  const blocksSyncSignature = useMemo(() => {
    return (props.sessionBlocks ?? [])
      .map(
        (b) =>
          `${b.id}:${b.program_session_id}:${String(b.position ?? '')}:${String(b.type ?? '')}:${String(b.title ?? '')}:${String(
            b.notes ?? ''
          )}`
      )
      .join('|')
  }, [props.sessionBlocks])

  const [blocksBySessionState, setBlocksBySessionState] = useState<Record<string, SessionBlockRow[]>>(() => {
    const initial: Record<string, SessionBlockRow[]> = {}
    for (const [sessionId, list] of Object.entries(blocksBySessionId)) {
      initial[sessionId] = list.slice()
    }
    return initial
  })
  const [blocksDirtyBySessionId, setBlocksDirtyBySessionId] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setBlocksBySessionState(() => {
      const next: Record<string, SessionBlockRow[]> = {}
      for (const [sessionId, list] of Object.entries(blocksBySessionId)) {
        next[sessionId] = list.slice()
      }
      return next
    })
    setBlocksDirtyBySessionId({})
  }, [blocksSyncSignature, blocksBySessionId])

  const blocksBySession = useMemo(() => {
    const next: Record<string, SessionBlockRow[]> = { ...blocksBySessionState }
    for (const [sessionId, list] of Object.entries(blocksBySessionId)) {
      if (!blocksDirtyBySessionId[sessionId]) {
        next[sessionId] = list
      }
    }
    return next
  }, [blocksBySessionState, blocksDirtyBySessionId, blocksBySessionId])

  useEffect(() => {
    if (!openSessionId) return
    const blocksForOpenSession = blocksBySession[openSessionId] ?? []
    if (!blocksForOpenSession.length) return
    const selected = selectedBlockIdBySessionId[openSessionId] ?? null
    if (selected && blocksForOpenSession.some((b) => b.id === selected)) return
    setSelectedBlockIdBySessionId((prev) => ({ ...prev, [openSessionId]: blocksForOpenSession[0]!.id }))
  }, [openSessionId, blocksBySession, selectedBlockIdBySessionId])

  const blockExercisesByBlockId = useMemo(() => {
    const out: Record<string, BlockExerciseRow[]> = {}
    for (const row of props.blockExercises ?? []) {
      const list = out[row.session_block_id] ?? []
      list.push(row)
      out[row.session_block_id] = list
    }
    for (const key of Object.keys(out)) {
      out[key].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    }
    return out
  }, [props.blockExercises])

  const [blockLoadTextDraftById, setBlockLoadTextDraftById] = useState<Record<string, string>>({})

  function getBlockLoadDraft(blockExerciseId: string, initial: string | null | undefined) {
    if (blockLoadTextDraftById[blockExerciseId] != null) return String(blockLoadTextDraftById[blockExerciseId])
    return initial ?? ''
  }

  function BlockCharacteristicsForm({ block }: { block: SessionBlockRow }) {
    if (block.type !== 'crosstraining') return null
    const draft = blockDraftById[block.id] ?? { title: block.title ?? '', notes: block.notes ?? '' }

    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <input
          value={draft.title}
          onChange={(e) => {
            const next = e.currentTarget.value
            setBlockDraftById((prev) => ({
              ...prev,
              [block.id]: { title: next, notes: prev[block.id]?.notes ?? block.notes ?? '' },
            }))
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onPointerDownCapture={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onKeyDownCapture={(e) => {
            e.stopPropagation()
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
          }}
          onKeyUpCapture={(e) => {
            e.stopPropagation()
          }}
          placeholder="Titre du bloc"
          disabled={props.readOnly}
          style={{
            height: 42,
            borderRadius: 14,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            padding: '0 12px',
            fontSize: 14,
            fontWeight: 900,
            color: 'var(--brand)',
          }}
        />

        <textarea
          value={draft.notes}
          onChange={(e) => {
            const next = e.currentTarget.value
            setBlockDraftById((prev) => ({
              ...prev,
              [block.id]: { title: prev[block.id]?.title ?? block.title ?? '', notes: next },
            }))
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
          onPointerDownCapture={(e) => {
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onKeyDownCapture={(e) => {
            e.stopPropagation()
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
          }}
          onKeyUpCapture={(e) => {
            e.stopPropagation()
          }}
          placeholder="Note"
          disabled={props.readOnly}
          style={{
            width: '100%',
            minHeight: 72,
            borderRadius: 14,
            border: '1px solid #e5e7eb',
            background: '#ffffff',
            padding: 12,
            fontSize: 14,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>
    )
  }

  function saveCrosstrainingBlock(block: SessionBlockRow) {
    if (props.readOnly) return
    if (!props.updateBlockAction) return
    const draft = blockDraftById[block.id] ?? { title: block.title ?? '', notes: block.notes ?? '' }
    const fd = new FormData()
    fd.set('session_block_id', block.id)
    fd.set('title', draft.title)
    fd.set('notes', draft.notes)
    fd.set('client', '1')

    const rawTitle = String(draft.title ?? '').trim()
    const rawNotes = String(draft.notes ?? '').trim()
    optimisticUpdateBlock(block.program_session_id, block.id, {
      title: rawTitle ? rawTitle : null,
      notes: rawNotes ? rawNotes : null,
    })

    setBlockSavedFlashById((prev) => ({ ...prev, [block.id]: Date.now() }))
    window.setTimeout(() => {
      setBlockSavedFlashById((prev) => {
        if (!prev[block.id]) return prev
        const next = { ...prev }
        delete next[block.id]
        return next
      })
    }, 1200)

    enqueueMutation(async () => {
      await props.updateBlockAction?.(fd)
      requestRefresh()
    })

    setBlockLockedById((prev) => ({ ...prev, [block.id]: true }))
  }

  function unlockCrosstrainingBlock(blockId: string, block: SessionBlockRow) {
    setBlockDraftById((prev) => ({
      ...prev,
      [blockId]: { title: block.title ?? '', notes: block.notes ?? '' },
    }))
    setBlockLockedById((prev) => ({ ...prev, [blockId]: false }))
  }

  function duplicateCrosstrainingBlock(block: SessionBlockRow) {
    if (props.readOnly) return
    if (!props.duplicateBlockAction) return
    const fd = new FormData()
    fd.set('session_block_id', block.id)
    fd.set('client', '1')
    enqueueMutation(async () => {
      const res = (await props.duplicateBlockAction?.(fd)) as unknown as { newBlockId?: string | null } | void
      const newBlockId = res && typeof res === 'object' ? (res as { newBlockId?: string | null }).newBlockId ?? null : null
      if (newBlockId) {
        setSelectedBlockIdBySessionId((prev) => ({ ...prev, [block.program_session_id]: newBlockId }))
      }
      requestRefresh()
    })
  }

  function deleteCrosstrainingBlock(block: SessionBlockRow) {
    if (props.readOnly) return
    if (!props.deleteBlockAction) return
    const fd = new FormData()
    fd.set('session_block_id', block.id)
    fd.set('client', '1')
    enqueueMutation(async () => {
      await props.deleteBlockAction?.(fd)
      setSelectedBlockIdBySessionId((prev) => ({ ...prev, [block.program_session_id]: null }))
      requestRefresh()
    })
  }

  function BlockExerciseSearch({ sessionBlockId }: { sessionBlockId: string }) {
    const [q, setQ] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [results, setResults] = useState<LibraryExercise[]>([])
    const [loadDraft, setLoadDraft] = useState('')
    const abortRef = useRef<AbortController | null>(null)

    useEffect(() => {
      const query = q.trim()
      if (!query) {
        setResults([])
        setError(null)
        setLoading(false)
        abortRef.current?.abort()
        return
      }

      const t = window.setTimeout(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setLoading(true)
        setError(null)
        try {
          const url = new URL(`/api/exercises/search`, window.location.origin)
          url.searchParams.set('q', query)
          const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
          const json = (await res.json()) as { exercises?: LibraryExercise[]; error?: string }
          if (!res.ok) {
            setError(json.error ?? 'Erreur')
            setResults([])
          } else {
            setResults(json.exercises ?? [])
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError('Erreur réseau')
          setResults([])
        } finally {
          setLoading(false)
        }
      }, 150)

      return () => window.clearTimeout(t)
    }, [q])

    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--brand)' }}>
              <IconSearch size={18} />
            </div>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
              }}
              placeholder="Rechercher un exercice"
              style={{
                width: '100%',
                height: 42,
                borderRadius: 14,
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                padding: '0 12px 0 40px',
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--brand)',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <input
            value={loadDraft}
            onChange={(e) => setLoadDraft(e.target.value)}
            placeholder="rep, poids…"
            disabled={props.readOnly || !props.addBlockExerciseAction}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 14,
              border: '1px solid #e5e7eb',
              background: '#ffffff',
              padding: '0 12px',
              fontSize: 14,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            disabled={props.readOnly || !props.addBlockExerciseAction || results.length === 0}
            onClick={() => {
              if (props.readOnly) return
              if (!props.addBlockExerciseAction) return
              const first = results[0]
              if (!first) return
              const fd = new FormData()
              fd.set('session_block_id', sessionBlockId)
              fd.set('exercise_id', first.id)
              fd.set('load_text', loadDraft.trim())
              fd.set('client', '1')
              enqueueMutation(async () => {
                await props.addBlockExerciseAction?.(fd)
                requestRefresh()
              })
              setQ('')
              setLoadDraft('')
              setResults([])
              setError(null)
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              border: '1px solid var(--brand)',
              background: 'var(--brand)',
              color: '#ffffff',
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: props.readOnly ? 'default' : 'pointer',
            }}
            aria-label="Ajouter"
            title="Ajouter"
          >
            <IconPlus />
          </button>
        </div>

        {error ? <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 700 }}>{error}</div> : null}

        {loading ? <div style={{ color: '#6b7280', fontSize: 12 }}>Recherche…</div> : null}

        {results.length > 0 ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {results.slice(0, 12).map((it) => (
              <button
                key={it.id}
                type="button"
                disabled={props.readOnly || !props.addBlockExerciseAction}
                onClick={() => {
                  if (props.readOnly) return
                  if (!props.addBlockExerciseAction) return
                  const fd = new FormData()
                  fd.set('session_block_id', sessionBlockId)
                  fd.set('exercise_id', it.id)
                  fd.set('load_text', loadDraft.trim())
                  fd.set('client', '1')
                  enqueueMutation(async () => {
                    await props.addBlockExerciseAction?.(fd)
                    requestRefresh()
                  })
                  setQ('')
                  setLoadDraft('')
                  setResults([])
                  setError(null)
                }}
                style={{
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  borderRadius: 14,
                  background: '#ffffff',
                  padding: '10px 12px',
                  cursor: props.readOnly ? 'default' : 'pointer',
                }}
              >
                <div style={{ fontWeight: 900, color: 'var(--brand)', overflowWrap: 'anywhere' }}>{it.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {it.muscle_group ? <span>{it.muscle_group}</span> : null}
                  {it.difficulty ? <span>{it.difficulty}</span> : null}
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  function optimisticAddExercise(sessionId: string, exercise: { id: string; name: string; tmpId: string }) {
    setExercisesDirty((prev) => ({ ...prev, [sessionId]: true }))
    setExercisesBySession((prev) => {
      const current = prev[sessionId] ?? []
      const nextOrder = (current[current.length - 1]?.exercise_order ?? 0) + 1
      const optimisticRow: ProgramExerciseRow = {
        id: exercise.tmpId,
        session_id: sessionId,
        exercise_id: exercise.id,
        exercise_order: nextOrder,
        sets: null,
        reps: null,
        rest_time: null,
        tempo: null,
        load: null,
        notes: null,
        exercise_library: { name: exercise.name },
      }

      return {
        ...prev,
        [sessionId]: [...current, optimisticRow],
      }
    })
  }

  function reconcileOptimisticExerciseId(sessionId: string, tmpId: string, insertedId: string) {
    setExercisesBySession((prev) => {
      const current = prev[sessionId] ?? []
      const idx = current.findIndex((pe) => pe.id === tmpId)
      if (idx === -1) return prev
      const next = [...current]
      next[idx] = { ...next[idx], id: insertedId }
      return {
        ...prev,
        [sessionId]: next,
      }
    })
  }

  function reconcileOptimisticSessionId(weekId: string, tmpSessionId: string, newSessionId: string) {
    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      const idx = list.findIndex((s) => s.id === tmpSessionId)
      if (idx === -1) return prev
      const nextList = [...list]
      nextList[idx] = { ...nextList[idx], id: newSessionId }
      return { ...prev, [weekId]: nextList }
    })

    setExercisesBySession((prev) => {
      if (!prev[tmpSessionId]) return prev
      const migrated = (prev[tmpSessionId] ?? []).map((pe) => ({ ...pe, session_id: newSessionId }))
      const next: Record<string, ProgramExerciseRow[]> = { ...prev }
      delete next[tmpSessionId]
      next[newSessionId] = migrated
      return next
    })

    setExercisesDirty((prev) => {
      if (!prev[tmpSessionId]) return prev
      const next = { ...prev }
      delete next[tmpSessionId]
      next[newSessionId] = true
      return next
    })

    setOptimisticallyDeletedExerciseIdsBySession((prev) => {
      if (!prev[tmpSessionId]) return prev
      const next = { ...prev }
      next[newSessionId] = next[tmpSessionId]
      delete next[tmpSessionId]
      return next
    })

    setOpenSessionId((cur) => (cur === tmpSessionId ? newSessionId : cur))
  }

  function optimisticAddBlock(sessionId: string, block: { tmpId: string; type: string; title: string | null }) {
    setBlocksDirtyBySessionId((prev) => ({ ...prev, [sessionId]: true }))
    setBlocksBySessionState((prev) => {
      const current = prev[sessionId] ?? []
      const nextPos = (current[current.length - 1]?.position ?? -1) + 1
      const row: SessionBlockRow = {
        id: block.tmpId,
        program_session_id: sessionId,
        position: nextPos,
        type: block.type,
        title: block.title,
        notes: null,
      }
      return { ...prev, [sessionId]: [...current, row] }
    })
    setSelectedBlockIdBySessionId((prev) => ({ ...prev, [sessionId]: block.tmpId }))
  }

  function optimisticUpdateBlock(sessionId: string, blockId: string, patch: { title?: string | null; notes?: string | null }) {
    setBlocksDirtyBySessionId((prev) => ({ ...prev, [sessionId]: true }))
    setBlocksBySessionState((prev) => {
      const list = prev[sessionId] ?? []
      const idx = list.findIndex((b) => b.id === blockId)
      if (idx < 0) return prev
      const next = list.slice()
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, [sessionId]: next }
    })
  }

  function reconcileOptimisticBlockId(sessionId: string, tmpId: string, newBlockId: string) {
    setBlocksBySessionState((prev) => {
      const current = prev[sessionId] ?? []
      const idx = current.findIndex((b) => b.id === tmpId)
      if (idx === -1) return prev
      const next = current.slice()
      next[idx] = { ...next[idx], id: newBlockId }
      return { ...prev, [sessionId]: next }
    })
    setSelectedBlockIdBySessionId((prev) => ({ ...prev, [sessionId]: prev[sessionId] === tmpId ? newBlockId : prev[sessionId] }))

    setBlockDraftById((prev) => {
      if (!prev[tmpId]) return prev
      const next = { ...prev }
      next[newBlockId] = next[tmpId]
      delete next[tmpId]
      return next
    })
    setBlockLockedById((prev) => {
      if (!prev[tmpId]) return prev
      const next = { ...prev }
      next[newBlockId] = next[tmpId]
      delete next[tmpId]
      return next
    })
    setBlockSavedFlashById((prev) => {
      if (!prev[tmpId]) return prev
      const next = { ...prev }
      next[newBlockId] = next[tmpId]
      delete next[tmpId]
      return next
    })
  }

  function optimisticReplaceExercise(sessionId: string, programExerciseId: string, exercise: { id: string; name: string }) {
    setExercisesDirty((prev) => ({ ...prev, [sessionId]: true }))
    setExercisesBySession((prev) => {
      const current = prev[sessionId] ?? []
      const idx = current.findIndex((pe) => pe.id === programExerciseId)
      if (idx === -1) return prev
      const next = [...current]
      next[idx] = {
        ...next[idx],
        exercise_id: exercise.id,
        exercise_library: { name: exercise.name },
      }
      return {
        ...prev,
        [sessionId]: next,
      }
    })
  }

  function optimisticDeleteExercise(sessionId: string, programExerciseId: string) {
    setExercisesDirty((prev) => ({ ...prev, [sessionId]: true }))
    setOptimisticallyDeletedExerciseIdsBySession((prev) => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] ?? {}), [programExerciseId]: true },
    }))
    setExercisesBySession((prev) => {
      const current = prev[sessionId] ?? exercisesBySessionInitial[sessionId] ?? []
      return {
        ...prev,
        [sessionId]: current.filter((pe) => pe.id !== programExerciseId),
      }
    })
  }

  function normalizeRestTimeMmSs(raw: string) {
    const v = (raw ?? '').trim()
    if (!v) return ''

    const digitsOnly = v.replace(/[^0-9]/g, '')
    if (digitsOnly.length === 0) return ''

    if (v.includes(':')) {
      const parts = v.split(':')
      const mm = Math.max(0, Math.min(99, Number(parts[0] ?? 0) || 0))
      const ss = Math.max(0, Math.min(59, Number(parts[1] ?? 0) || 0))
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    }

    const totalSeconds = Number(digitsOnly)
    if (!Number.isFinite(totalSeconds)) return ''
    const mm = Math.max(0, Math.min(99, Math.floor(totalSeconds / 60)))
    const ss = Math.max(0, Math.min(59, totalSeconds % 60))
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  function restTimeToSeconds(raw: string) {
    const v = normalizeRestTimeMmSs(raw)
    if (!v) return 0
    const [mm, ss] = v.split(':')
    const m = Number(mm) || 0
    const s = Number(ss) || 0
    return Math.max(0, m * 60 + s)
  }

  function secondsToRestTime(totalSeconds: number) {
    const safe = Math.max(0, Math.floor(totalSeconds))
    const mm = Math.max(0, Math.min(99, Math.floor(safe / 60)))
    const ss = Math.max(0, Math.min(59, safe % 60))
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }

  function formatMaybeNumber(value: unknown) {
    if (value == null) return ''
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
    return String(value).trim()
  }

  function formatRestClosed(value: unknown) {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    if (raw.includes(':')) return raw
    if (/^\d+(?:[\.,]\d+)?$/.test(raw)) return `${raw} min`
    return raw
  }

  function formatLoadClosed(value: unknown) {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    if (/kg\b/i.test(raw)) return raw
    if (/^\d+(?:[\.,]\d+)?$/.test(raw)) return `${raw} Kg`
    return raw
  }

  function stepNumberInput(el: HTMLInputElement | null | undefined, delta: number) {
    if (!el) return
    const currentRaw = el.value
    const currentNumber = currentRaw === '' ? 0 : Number(currentRaw)
    const safeCurrent = Number.isFinite(currentNumber) ? currentNumber : 0
    const next = safeCurrent + delta
    el.value = String(Math.max(0, next))
  }

  function stepRestTimeInput(el: HTMLInputElement | null | undefined, deltaSeconds: number) {
    if (!el) return
    const currentSeconds = restTimeToSeconds(el.value)
    const next = Math.max(0, currentSeconds + deltaSeconds)
    el.value = secondsToRestTime(next)
  }

  function requestSubmitSaveAllExercises() {
    const form = document.getElementById('save-all-exercises') as HTMLFormElement | null
    if (!form) return

    const openWeekInput = form.querySelector('input[name="openWeek"]') as HTMLInputElement | null
    const openSessionInput = form.querySelector('input[name="openSession"]') as HTMLInputElement | null
    if (openWeekInput) openWeekInput.value = openWeekId ?? ''
    if (openSessionInput) openSessionInput.value = openSessionId ?? ''

    form.requestSubmit()
  }

  function setSaveAllFieldValue(name: string, value: string) {
    const form = document.getElementById('save-all-exercises') as HTMLFormElement | null
    if (!form) return
    const el = form.querySelector(`input[name=${JSON.stringify(name)}]`) as HTMLInputElement | null
    if (!el) return
    el.value = value
  }

  function getNotesDraft(exerciseId: string, initialNotes: string | null) {
    if (Object.prototype.hasOwnProperty.call(notesDraftByExerciseId, exerciseId)) {
      return notesDraftByExerciseId[exerciseId] ?? ''
    }
    return initialNotes ?? ''
  }

  const structureOrderPayload = useMemo(() => {
    const orderedWeekIds = weeksState.map((w) => w.id)
    const sessionsByWeekIds: Record<string, string[]> = {}
    for (const [weekId, list] of Object.entries(sessionsByWeek)) {
      sessionsByWeekIds[weekId] = list.map((s) => s.id)
    }
    const dirtyWeekIds = Object.entries(sessionsDirty)
      .filter(([, dirty]) => dirty)
      .map(([weekId]) => weekId)

    const exercisesBySessionIds: Record<string, string[]> = {}
    for (const [sessionId, list] of Object.entries(exercisesBySession)) {
      exercisesBySessionIds[sessionId] = list.map((pe) => pe.id)
    }
    const dirtySessionIds = Object.entries(exercisesDirty)
      .filter(([, dirty]) => dirty)
      .map(([sessionId]) => sessionId)

    return JSON.stringify({
      weeksDirty,
      orderedWeekIds,
      dirtyWeekIds,
      sessionsByWeekIds,
      exercisesBySessionIds,
      dirtySessionIds,
    })
  }, [exercisesBySession, exercisesDirty, sessionsByWeek, sessionsDirty, weeksDirty, weeksState])

  function onDragEndWeek(event: DragEndEvent) {
    if (props.readOnly) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    setWeeksState((items) => {
      const oldIndex = items.findIndex((w) => w.id === active.id)
      const newIndex = items.findIndex((w) => w.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      const next = arrayMove(items, oldIndex, newIndex)
      setWeeksDirty(true)
      pendingStructureSaveRef.current = true
      return next
    })
  }

  useEffect(() => {
    if (props.readOnly) return
    if (!pendingStructureSaveRef.current) return
    if (!weeksDirty) return

    pendingStructureSaveRef.current = false
    requestSubmitSaveAllExercises()
  }, [props.readOnly, structureOrderPayload, weeksDirty])

  function onDragEndExercise(sessionId: string, event: DragEndEvent) {
    if (props.readOnly) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    setExercisesBySession((prev) => {
      const list = prev[sessionId] ?? []
      const oldIndex = list.findIndex((pe) => pe.id === active.id)
      const newIndex = list.findIndex((pe) => pe.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const nextList = arrayMove(list, oldIndex, newIndex)
      const next = { ...prev, [sessionId]: nextList }
      setExercisesDirty((d) => ({ ...d, [sessionId]: true }))
      return next
    })
  }

  function onDragEndSession(weekId: string, event: DragEndEvent) {
    if (props.readOnly) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSessionsByWeek((prev) => {
      const list = prev[weekId] ?? []
      const oldIndex = list.findIndex((s) => s.id === active.id)
      const newIndex = list.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return prev
      const nextList = arrayMove(list, oldIndex, newIndex)
      const next = { ...prev, [weekId]: nextList }
      setSessionsDirty((d) => ({ ...d, [weekId]: true }))
      return next
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = String(e.key || '').toLowerCase()
      if (key !== 'z') return
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      undoLastDeletion()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function scheduleDeleteWeek(weekId: string) {
    if (pendingUndoRef.current) commitPendingUndoNow()

    const week = (weeksState ?? []).find((w) => w.id === weekId)
    if (!week) {
      enqueueMutation(async () => {
        const fd = new FormData()
        fd.set('week_id', weekId)
        fd.set('client', '1')
        await props.deleteWeekAction(fd)
        requestRefresh()
      })
      return
    }

    const sessions = (sessionsByWeek[weekId] ?? []).slice()
    const exBySession: Record<string, ProgramExerciseRow[]> = {}
    for (const s of sessions) {
      exBySession[s.id] = (exercisesBySession[s.id] ?? []).slice()
    }

    optimisticDeleteWeek(weekId)

    const timeoutId = setTimeout(() => {
      if (!pendingUndoRef.current || pendingUndoRef.current.kind !== 'week' || pendingUndoRef.current.weekId !== weekId) {
        return
      }
      pendingUndoRef.current = null
      enqueueMutation(async () => {
        const fd = new FormData()
        fd.set('week_id', weekId)
        fd.set('client', '1')
        await props.deleteWeekAction(fd)
        requestRefresh()
      })
    }, 5000)

    pendingUndoRef.current = {
      kind: 'week',
      timeoutId,
      week,
      weekId,
      sessionsByWeek: { [weekId]: sessions },
      exercisesBySession: exBySession,
    }
  }

  function scheduleDeleteSession(weekId: string, sessionId: string) {
    if (pendingUndoRef.current) commitPendingUndoNow()

    const session = (sessionsByWeek[weekId] ?? []).find((s) => s.id === sessionId)
    if (!session) {
      enqueueMutation(async () => {
        const fd = new FormData()
        fd.set('week_id', weekId)
        fd.set('session_id', sessionId)
        fd.set('client', '1')
        await props.deleteSessionAction(fd)
        requestRefresh()
      })
      return
    }

    const exBySession: Record<string, ProgramExerciseRow[]> = {
      [sessionId]: (exercisesBySession[sessionId] ?? []).slice(),
    }

    optimisticDeleteSession(weekId, sessionId)

    const timeoutId = setTimeout(() => {
      if (!pendingUndoRef.current || pendingUndoRef.current.kind !== 'session') return
      if (pendingUndoRef.current.weekId !== weekId || pendingUndoRef.current.session.id !== sessionId) return
      pendingUndoRef.current = null
      enqueueMutation(async () => {
        const fd = new FormData()
        fd.set('week_id', weekId)
        fd.set('session_id', sessionId)
        fd.set('client', '1')
        await props.deleteSessionAction(fd)
        requestRefresh()
      })
    }, 5000)

    pendingUndoRef.current = {
      kind: 'session',
      timeoutId,
      weekId,
      session,
      exercisesBySession: exBySession,
    }
  }

  return (
    <section style={{ marginTop: 28 }}>
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
        }
        details {
          box-sizing: border-box;
          max-width: 100%;
        }

        .session-card {
          padding: 12px;
        }

        .exercise-card {
          padding: 12px;
          gap: 6px;
        }
        .exercise-title {
          font-size: 14px;
          line-height: 1.2;
        }
        .exercise-notes {
          min-height: 60px;
        }
        .icon-btn {
          padding: 4px 6px;
          border-radius: 6px;
          border: 1px solid #111827;
          background: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .add-exercise-btn {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px dashed #d1d5db;
          background: #ffffff;
          color: #111827;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 10px;
        }

        .add-exercise-panel {
          margin-top: 10px;
          border: 0;
          border-radius: 0;
          padding: 0;
          background: transparent;
          max-width: 100%;
          overflow: hidden;
        }
        .icon-btn-danger {
          padding: 4px 6px;
          border-radius: 6px;
          border: 1px solid #ef4444;
          background: #ef4444;
          color: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        details .session-actions-extra {
          display: none;
        }
        details[open] .session-actions-extra {
          display: inline-flex;
        }

        details[open] .week-actions-extra,
        details[open] .session-actions-extra {
          display: inline-flex;
        }

        .exercise-params-scroll {
          overflow-x: hidden;
          max-width: 100%;
        }
        .exercise-params-row-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
          width: 100%;
          max-width: 100%;
        }

        .exercise-params-row-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
          width: 100%;
          max-width: 100%;
          margin-top: 6px;
        }

        .exercise-params-row-2-notes {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
          gap: 6px;
          width: 100%;
          max-width: 100%;
          margin-top: 6px;
          align-items: end;
        }

        .exercise-params-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 4px;
          width: 100%;
          max-width: 100%;
        }
        .exercise-params-row label,
        .exercise-params-row-3 label,
        .exercise-params-row-2 label,
        .exercise-params-row-2-notes label {
          min-width: 0;
        }
        .exercise-params-row input,
        .exercise-params-row-3 input,
        .exercise-params-row-2 input,
        .exercise-params-row-2-notes input {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .stepper-field {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: 1fr 18px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          background: #ffffff;
        }

        .stepper-field input {
          border: 0 !important;
          outline: none;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 2px 4px;
          font-size: 13px;
          background: transparent;
        }

        .field-plain {
          width: 100%;
          min-width: 0;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          background: #ffffff;
        }

        .field-plain input {
          border: 0 !important;
          outline: none;
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: 2px 4px;
          font-size: 13px;
          background: transparent;
        }

        .notes-field {
          display: grid;
          grid-template-columns: 1fr 32px;
          gap: 8px;
          align-items: stretch;
          max-width: 100%;
        }

        .notes-actions {
          display: grid;
          grid-template-rows: 1fr 1fr;
          gap: 6px;
          align-items: center;
          justify-items: stretch;
        }

        .notes-action-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          line-height: 1;
        }

        .stepper-column {
          display: grid;
          grid-template-rows: 1fr 1fr;
          border-left: 1px solid #e5e7eb;
        }

        .stepper-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          background: #f9fafb;
          color: #6b7280;
          line-height: 1;
          font-size: 10px;
          padding: 0;
          cursor: pointer;
        }

        .stepper-button + .stepper-button {
          border-top: 1px solid #e5e7eb;
        }

        @media (max-width: 420px) {
          .session-card {
            padding-left: 1px;
            padding-right: 1px;
          }

          .exercise-params-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
          }
          .exercise-params-row label span {
            font-size: 11px;
            white-space: normal;
          }

          details {
            padding: 10px !important;
          }

          .exercise-card {
            padding: 10px;
            gap: 4px;
          }
          .exercise-title {
            font-size: 13px;
          }
          .exercise-notes {
            min-height: 44px;
          }
        }
      `}</style>

      {(weeksState ?? []).length > 0 ? (
        <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {!props.readOnly ? (
            <>
              <input type="hidden" name="structure_order" value={structureOrderPayload} form="save-all-exercises" />
            </>
          ) : null}

          {dndEnabled ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndWeek}>
              <SortableContext items={weeksState.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                {weeksState.map((w) => {
                  const sessionsForWeek = sessionsByWeek[w.id] ?? []

                  return (
                    <SortableItem key={w.id} id={w.id} disabled={props.readOnly}>
                      {({ setActivatorNodeRef, attributes, listeners }) => (
                        <details
                          open={openWeekId === w.id}
                          onToggle={(e) => {
                            const isOpen = e.currentTarget.open

                            if (isOpen) {
                              setOpenWeekId(w.id)
                              setOpenSessionId(null)
                              setReplaceExerciseId(null)
                              return
                            }

                            setReplaceExerciseId(null)
                            setOpenSessionId((prev) => (openWeekId === w.id ? null : prev))
                            setOpenWeekId((prev) => (prev === w.id ? null : prev))
                          }}
                          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}
                        >
                          <summary
                            ref={setActivatorNodeRef}
                            {...attributes}
                            {...listeners}
                            style={{
                              cursor: props.readOnly ? 'default' : 'grab',
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              touchAction: props.readOnly ? 'manipulation' : 'none',
                            }}
                          >
                            <strong
                              style={{ minWidth: 0, overflowWrap: 'anywhere', color: 'var(--brand)', fontWeight: 800, fontSize: 18 }}
                              onPointerDownCapture={(e) => {
                                e.stopPropagation()
                              }}
                              onClick={(e) => {
                                if (props.readOnly) return
                                const now = Date.now()
                                const last = lastWeekTitleClickRef.current
                                lastWeekTitleClickRef.current = { at: now, weekId: w.id }
                                if (last && last.weekId === w.id && now - last.at < 350) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setEditingWeekId(w.id)
                                  setEditingWeekTitle(String(w.title ?? `Semaine ${w.week_order}`).trim())
                                }
                              }}
                            >
                              {editingWeekId === w.id ? (
                                <input
                                  value={editingWeekTitle}
                                  autoFocus
                                  onChange={(e) => setEditingWeekTitle(e.target.value)}
                                  onPointerDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setEditingWeekId(null)
                                      setEditingWeekTitle('')
                                      return
                                    }
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const nextTitle = editingWeekTitle.trim()
                                      setEditingWeekId(null)
                                      setEditingWeekTitle('')
                                      optimisticUpdateWeekTitle(w.id, nextTitle)
                                      void saveWeekTitle(w.id, nextTitle)
                                    }
                                  }}
                                  onBlur={() => {
                                    const nextTitle = editingWeekTitle.trim()
                                    setEditingWeekId(null)
                                    setEditingWeekTitle('')
                                    optimisticUpdateWeekTitle(w.id, nextTitle)
                                    void saveWeekTitle(w.id, nextTitle)
                                  }}
                                  style={{
                                    fontWeight: 700,
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    marginLeft: 8,
                                    minWidth: 120,
                                  }}
                                />
                              ) : String(w.title ?? '').trim() === '' ? (
                                `Semaine ${w.week_order}`
                              ) : (
                                String(w.title)
                              )}
                            </strong>

                            {!props.readOnly ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <div className="week-actions-extra" style={{ gap: 6, alignItems: 'center' }}>
                                  <form
                                    action={props.duplicateWeekAction}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                    }}
                                    onSubmit={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (props.readOnly) return

                                      const fd = new FormData(e.currentTarget)
                                      const sourceWeekId = String(fd.get('week_id') ?? '')
                                      if (sourceWeekId) optimisticDuplicateWeek(sourceWeekId)

                                      enqueueMutation(async () => {
                                        await props.duplicateWeekAction(fd)
                                        requestRefresh()
                                      })
                                    }}
                                  >
                                    <input type="hidden" name="week_id" value={w.id} />
                                    <input type="hidden" name="client" value="1" />
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      title="Dupliquer la semaine"
                                      onPointerDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        e.currentTarget.form?.requestSubmit()
                                      }}
                                    >
                                      <IconDuplicate />
                                    </button>
                                  </form>
                                </div>

                                <form
                                  action={props.deleteWeekAction}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (props.readOnly) return

                                    const fd = new FormData(e.currentTarget)
                                    const weekId = String(fd.get('week_id') ?? '')
                                    if (!weekId) return

                                    scheduleDeleteWeek(weekId)
                                    if (openWeekId === weekId) {
                                      setOpenWeekId(null)
                                      setOpenSessionId(null)
                                      setReplaceExerciseId(null)
                                    }

                                    fd.set('client', '1')
                                  }}
                                >
                                  <input type="hidden" name="week_id" value={w.id} />
                                  <input type="hidden" name="client" value="1" />
                                  <button
                                    type="button"
                                    className="icon-btn-danger"
                                    title="Supprimer la semaine"
                                    onPointerDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.currentTarget.form?.requestSubmit()
                                    }}
                                  >
                                    <IconTrash />
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </summary>

                          <div
                            key={`week-content-${w.id}-${weekCloseNonceById[w.id] ?? 0}`}
                            style={{ marginTop: 10, display: 'grid', gap: 10 }}
                          >
                            {sessionsForWeek.length > 0 ? (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(e) => onDragEndSession(w.id, e)}
                              >
                                <SortableContext items={sessionsForWeek.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                                    {sessionsForWeek.map((s) => {
                                      const sessionExercises = hideExercises ? [] : exercisesBySession[s.id] ?? []
                                      const addOpenForSession = addOpenBySessionId[s.id] ?? false
                                      const addBlockOpenForSession = addBlockOpenBySessionId[s.id] ?? false
                                      const blocksForSession = blocksBySession[s.id] ?? []
                                      const selectedBlockId = selectedBlockIdBySessionId[s.id] ?? null
                                      const selectedBlock = selectedBlockId
                                        ? blocksForSession.find((b) => b.id === selectedBlockId) ?? null
                                        : null
                                      const selectedBlockExercises = selectedBlockId
                                        ? blockExercisesByBlockId[selectedBlockId] ?? []
                                        : []

                                      return (
                                        <SortableItem key={s.id} id={s.id} disabled={props.readOnly}>
                                          {({ setActivatorNodeRef, attributes, listeners }) => (
                                            <li
                                              className="session-card"
                                              style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#ffffff' }}
                                            >
                                              <details
                                                open={openWeekId === w.id && openSessionId === s.id}
                                                onToggle={(e) => {
                                                  const isOpen = e.currentTarget.open

                                                  setReplaceExerciseId(null)
                                                  if (isOpen) {
                                                    setOpenWeekId(w.id)
                                                    setOpenSessionId(s.id)
                                                    return
                                                  }
                                                  setOpenSessionId(null)
                                                }}
                                              >
                                                <summary
                                                  ref={setActivatorNodeRef}
                                                  {...attributes}
                                                  {...listeners}
                                                  style={{
                                                    cursor: props.readOnly ? 'default' : 'grab',
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                    alignItems: 'flex-start',
                                                    flexWrap: 'nowrap',
                                                    touchAction: props.readOnly ? 'manipulation' : 'none',
                                                  }}
                                                >
                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
                                                    <div
                                                      style={{
                                                        fontWeight: 800,
                                                        fontSize: 16,
                                                        minWidth: 0,
                                                        overflowWrap: 'anywhere',
                                                        color: 'var(--brand)',
                                                      }}
                                                      onPointerDownCapture={(e) => {
                                                        e.stopPropagation()
                                                      }}
                                                      onClick={(e) => {
                                                        if (props.readOnly) return
                                                        const now = Date.now()
                                                        const last = lastSessionTitleClickRef.current
                                                        lastSessionTitleClickRef.current = { at: now, sessionId: s.id }
                                                        if (last && last.sessionId === s.id && now - last.at < 350) {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                          setEditingSessionId(s.id)
                                                          setEditingSessionTitle(
                                                            String(s.title ?? `Entraînement ${s.session_order}`).trim()
                                                          )
                                                        }
                                                      }}
                                                    >
                                                      {editingSessionId === s.id ? (
                                                        <input
                                                          value={editingSessionTitle}
                                                          autoFocus
                                                          onChange={(e) => setEditingSessionTitle(e.target.value)}
                                                          onPointerDown={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                          }}
                                                          onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                          }}
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Escape') {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              setEditingSessionId(null)
                                                              setEditingSessionTitle('')
                                                              return
                                                            }
                                                            if (e.key === 'Enter') {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              const nextTitle = editingSessionTitle.trim()
                                                              setEditingSessionId(null)
                                                              setEditingSessionTitle('')
                                                              optimisticUpdateSessionTitle(w.id, s.id, nextTitle)
                                                              void saveSessionTitle(w.id, s.id, nextTitle)
                                                            }
                                                          }}
                                                          onBlur={() => {
                                                            const nextTitle = editingSessionTitle.trim()
                                                            setEditingSessionId(null)
                                                            setEditingSessionTitle('')
                                                            optimisticUpdateSessionTitle(w.id, s.id, nextTitle)
                                                            void saveSessionTitle(w.id, s.id, nextTitle)
                                                          }}
                                                          style={{
                                                            fontWeight: 700,
                                                            border: '1px solid #e5e7eb',
                                                            borderRadius: 6,
                                                            padding: '4px 8px',
                                                            marginLeft: 8,
                                                            minWidth: 120,
                                                          }}
                                                        />
                                                      ) : String(s.title ?? '').trim() === '' ? (
                                                        `Entraînement ${s.session_order}`
                                                      ) : (
                                                        String(s.title)
                                                      )}
                                                    </div>

                                                    {!hideExercises &&
                                                    !(openWeekId === w.id && openSessionId === s.id) &&
                                                    editingSessionId !== s.id &&
                                                    (sessionExercises.length > 0 || blocksForSession.length > 0) ? (
                                                      <div
                                                        style={{
                                                          fontSize: 12,
                                                          lineHeight: '14px',
                                                          color: '#6b7280',
                                                          whiteSpace: 'nowrap',
                                                          overflow: 'hidden',
                                                          maxWidth: '100%',
                                                          WebkitMaskImage:
                                                            'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                                                          maskImage:
                                                            'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                                                        }}
                                                      >
                                                        {[...sessionExercises
                                                          .map((pe) => String(pe.exercise_library?.name ?? '').trim())
                                                          .filter(Boolean),
                                                        ...blocksForSession
                                                          .map((b) => String(b.title ?? '').trim())
                                                          .filter(Boolean)]
                                                          .join(' • ')}
                                                      </div>
                                                    ) : null}
                                                  </div>

                                                  {!props.readOnly ? (
                                                    <div
                                                      style={{
                                                        display: 'flex',
                                                        gap: 6,
                                                        alignItems: 'center',
                                                        flex: '0 0 auto',
                                                        alignSelf: 'flex-start',
                                                      }}
                                                    >
                                                      <div className="session-actions-extra" style={{ gap: 6, alignItems: 'center' }}>
                                                        <form
                                                          action={props.duplicateSessionAction as unknown as (formData: FormData) => void}
                                                          onClick={(e) => {
                                                            e.stopPropagation()
                                                          }}
                                                          onSubmit={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            if (props.readOnly) return

                                                            const fd = new FormData(e.currentTarget)
                                                            const weekId = String(fd.get('week_id') ?? '')
                                                            const sessionId = String(fd.get('session_id') ?? '')
                                                            fd.set('client', '1')
                                                            let tmpSessionId: string | null = null
                                                            if (weekId && sessionId) {
                                                              tmpSessionId = optimisticDuplicateSession(weekId, sessionId)
                                                              setOpenWeekId(weekId)
                                                              setOpenSessionId(tmpSessionId)
                                                            }

                                                            enqueueMutation(async () => {
                                                              const res = (await props.duplicateSessionAction(fd)) as unknown as
                                                                | { newSessionId?: string }
                                                                | void

                                                              const newSessionId =
                                                                res && typeof res === 'object' ? (res as { newSessionId?: string }).newSessionId : null
                                                              if (weekId && tmpSessionId && newSessionId) {
                                                                reconcileOptimisticSessionId(weekId, tmpSessionId, newSessionId)
                                                              }
                                                              requestRefresh()
                                                            })
                                                          }}
                                                        >
                                                          <input type="hidden" name="week_id" value={w.id} />
                                                          <input type="hidden" name="session_id" value={s.id} />
                                                          <input type="hidden" name="client" value="1" />
                                                          <button
                                                            type="button"
                                                            className="icon-btn"
                                                            title="Dupliquer l'entraînement"
                                                            onPointerDown={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                            }}
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              e.currentTarget.form?.requestSubmit()
                                                            }}
                                                          >
                                                            <IconDuplicate />
                                                          </button>
                                                        </form>
                                                      </div>

                                                      <form
                                                        action={props.deleteSessionAction}
                                                        onClick={(e) => {
                                                          e.stopPropagation()
                                                        }}
                                                        onSubmit={(e) => {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                          if (props.readOnly) return

                                                          const fd = new FormData(e.currentTarget)
                                                          const weekId = String(fd.get('week_id') ?? '')
                                                          const sessionId = String(fd.get('session_id') ?? '')
                                                          if (!weekId || !sessionId) return

                                                          scheduleDeleteSession(weekId, sessionId)
                                                          if (openWeekId === weekId && openSessionId === sessionId) {
                                                            setOpenSessionId(null)
                                                            setReplaceExerciseId(null)
                                                          }

                                                          fd.set('openWeek', openWeekId ?? '')
                                                          fd.set('openSession', openSessionId ?? '')
                                                          fd.set('client', '1')
                                                        }}
                                                      >
                                                        <input type="hidden" name="week_id" value={w.id} />
                                                        <input type="hidden" name="session_id" value={s.id} />
                                                        <input type="hidden" name="openWeek" value={openWeekId ?? ''} />
                                                        <input type="hidden" name="openSession" value={openSessionId ?? ''} />
                                                        <input type="hidden" name="client" value="1" />
                                                        <button
                                                          type="button"
                                                          className="icon-btn-danger"
                                                          title="Supprimer l'entraînement"
                                                          onPointerDown={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                          }}
                                                          onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            e.currentTarget.form?.requestSubmit()
                                                          }}
                                                        >
                                                          <IconTrash />
                                                        </button>
                                                      </form>
                                                    </div>
                                                  ) : null}
                                                </summary>

                                                <div style={{ marginTop: 10 }}>
                                                  {openWeekId === w.id && openSessionId === s.id && selectedBlockId && selectedBlock && selectedBlock.type === 'crosstraining' ? (
                                                    <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                                                      <div
                                                        style={{
                                                          border: '1px solid #e5e7eb',
                                                          borderRadius: 14,
                                                          background: '#ffffff',
                                                          padding: 12,
                                                          display: 'grid',
                                                          gap: 10,
                                                        }}
                                                        onPointerDownCapture={(e) => {
                                                          e.stopPropagation()
                                                        }}
                                                        onKeyDownCapture={(e) => {
                                                          e.stopPropagation()
                                                        }}
                                                      >
                                                        {blockLockedById[selectedBlock.id] ? (
                                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                                            <div style={{ minWidth: 0 }}>
                                                              <div style={{ fontWeight: 900, color: 'var(--brand)', overflowWrap: 'anywhere' }}>
                                                                {selectedBlock.title ?? 'Crossfit'}
                                                              </div>
                                                              {selectedBlock.notes ? (
                                                                <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere' }}>
                                                                  {selectedBlock.notes}
                                                                </div>
                                                              ) : null}
                                                            </div>

                                                            {!props.readOnly ? (
                                                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
                                                                <button
                                                                  type="button"
                                                                  className="icon-btn"
                                                                  title="Éditer"
                                                                  onPointerDown={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                  }}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    unlockCrosstrainingBlock(selectedBlock.id, selectedBlock)
                                                                  }}
                                                                >
                                                                  <IconEdit size={18} />
                                                                </button>

                                                                <button
                                                                  type="button"
                                                                  className="icon-btn"
                                                                  title="Dupliquer"
                                                                  onPointerDown={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                  }}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    duplicateCrosstrainingBlock(selectedBlock)
                                                                  }}
                                                                >
                                                                  <IconDuplicate />
                                                                </button>

                                                                <button
                                                                  type="button"
                                                                  className="icon-btn-danger"
                                                                  title="Supprimer"
                                                                  onPointerDown={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                  }}
                                                                  onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    deleteCrosstrainingBlock(selectedBlock)
                                                                  }}
                                                                >
                                                                  <IconTrash />
                                                                </button>
                                                              </div>
                                                            ) : null}
                                                          </div>
                                                        ) : (
                                                          <>
                                                            <div style={{ display: 'grid', gap: 2 }}>
                                                              <div style={{ fontWeight: 900, color: 'var(--brand)' }}>Crossfit</div>
                                                              {selectedBlock.title ? (
                                                                <div
                                                                  style={{
                                                                    fontSize: 12,
                                                                    color: '#6b7280',
                                                                    fontWeight: 700,
                                                                    overflowWrap: 'anywhere',
                                                                  }}
                                                                >
                                                                  {selectedBlock.title}
                                                                </div>
                                                              ) : null}
                                                            </div>

                                                            <BlockCharacteristicsForm block={selectedBlock} />
                                                          </>
                                                        )}

                                                        {selectedBlockExercises.length > 0 ? (
                                                          <div style={{ display: 'grid', gap: 8 }}>
                                                            {selectedBlockExercises.map((row) => (
                                                              <div
                                                                key={row.id}
                                                                style={{
                                                                  border: '1px solid #e5e7eb',
                                                                  borderRadius: 14,
                                                                  background: '#ffffff',
                                                                  padding: '10px 12px',
                                                                  display: 'grid',
                                                                  gridTemplateColumns: '1fr 220px',
                                                                  gap: 10,
                                                                  alignItems: 'center',
                                                                }}
                                                              >
                                                                <div style={{ fontWeight: 900, color: 'var(--brand)', overflowWrap: 'anywhere' }}>
                                                                  {row.exercise_library?.name ?? row.exercise_name ?? 'Exercice'}
                                                                </div>

                                                                {blockLockedById[selectedBlock.id] ? (
                                                                  getBlockLoadDraft(row.id, row.load_text) ? (
                                                                    <div style={{ fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere', textAlign: 'right' }}>
                                                                      {getBlockLoadDraft(row.id, row.load_text)}
                                                                    </div>
                                                                  ) : null
                                                                ) : (
                                                                  <input
                                                                    value={getBlockLoadDraft(row.id, row.load_text)}
                                                                    onChange={(e) => {
                                                                      const value = e.currentTarget.value
                                                                      setBlockLoadTextDraftById((prev) => ({
                                                                        ...prev,
                                                                        [row.id]: value,
                                                                      }))
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                      if (e.key !== 'Enter') return
                                                                      e.preventDefault()
                                                                      e.stopPropagation()
                                                                      if (props.readOnly) return
                                                                      if (!props.updateBlockExerciseAction) return
                                                                      const fd = new FormData()
                                                                      fd.set('block_exercise_id', row.id)
                                                                      fd.set('load_text', getBlockLoadDraft(row.id, row.load_text))
                                                                      fd.set('client', '1')
                                                                      enqueueMutation(async () => {
                                                                        await props.updateBlockExerciseAction?.(fd)
                                                                        requestRefresh()
                                                                      })
                                                                    }}
                                                                    onBlur={() => {
                                                                      if (props.readOnly) return
                                                                      if (!props.updateBlockExerciseAction) return
                                                                      const fd = new FormData()
                                                                      fd.set('block_exercise_id', row.id)
                                                                      fd.set('load_text', getBlockLoadDraft(row.id, row.load_text))
                                                                      fd.set('client', '1')
                                                                      enqueueMutation(async () => {
                                                                        await props.updateBlockExerciseAction?.(fd)
                                                                        requestRefresh()
                                                                      })
                                                                    }}
                                                                    placeholder="rep, poids…"
                                                                    disabled={props.readOnly || !props.updateBlockExerciseAction}
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid #e5e7eb',
                                                                      background: '#ffffff',
                                                                      padding: '0 12px',
                                                                      fontSize: 14,
                                                                      width: '100%',
                                                                      boxSizing: 'border-box',
                                                                    }}
                                                                  />
                                                                )}
                                                              </div>
                                                            ))}
                                                          </div>
                                                        ) : null}

                                                        {!blockLockedById[selectedBlock.id] && props.addBlockExerciseAction ? (
                                                          <BlockExerciseSearch sessionBlockId={selectedBlockId} />
                                                        ) : null}
                                                      </div>

                                                      {!blockLockedById[selectedBlock.id] ? (
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                          <button
                                                            type="button"
                                                            disabled={props.readOnly}
                                                            onPointerDown={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                            }}
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              saveCrosstrainingBlock(selectedBlock)
                                                            }}
                                                            style={{
                                                              height: 40,
                                                              borderRadius: 12,
                                                              border: '1px solid var(--brand)',
                                                              background: 'var(--brand)',
                                                              color: '#ffffff',
                                                              padding: '0 14px',
                                                              fontWeight: 900,
                                                              cursor: props.readOnly ? 'default' : 'pointer',
                                                            }}
                                                          >
                                                            {blockSavedFlashById[selectedBlock.id] ? 'Enregistré' : 'Enregistrer'}
                                                          </button>
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : null}

                                                  {hideExercises ? null : sessionExercises.length > 0 ? (
                                                    <div style={{ display: 'grid', gap: 8 }}>
                                                      <DndContext
                                                        sensors={sensors}
                                                        collisionDetection={closestCenter}
                                                        onDragEnd={(e) => onDragEndExercise(s.id, e)}
                                                      >
                                                        <SortableContext
                                                          items={sessionExercises.map((pe) => pe.id)}
                                                          strategy={verticalListSortingStrategy}
                                                        >
                                                          <div style={{ display: 'grid', gap: 8 }}>
                                                            {sessionExercises.map((pe) => (
                                                              <SortableItem key={pe.id} id={pe.id} disabled={props.readOnly}>
                                                                {({ setActivatorNodeRef, attributes, listeners }) => (
                                                                  <div
                                                                    id={`pe-${pe.id}`}
                                                                    className="exercise-card"
                                                                    style={{
                                                                      border: '1px solid #e5e7eb',
                                                                      borderRadius: 12,
                                                                      padding: 12,
                                                                      display: 'grid',
                                                                      gap: 8,
                                                                      background: '#ffffff',
                                                                    }}
                                                                  >
                                                                    <div style={{ display: 'grid', gap: 6 }}>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                                                        <strong
                                                                          ref={setActivatorNodeRef}
                                                                          className="exercise-title"
                                                                          style={{
                                                                            minWidth: 0,
                                                                            overflowWrap: 'anywhere',
                                                                            fontSize: 16,
                                                                            color: 'var(--brand)',
                                                                            cursor: props.readOnly ? 'default' : 'grab',
                                                                            touchAction: props.readOnly ? 'manipulation' : 'none',
                                                                          }}
                                                                          {...attributes}
                                                                          {...listeners}
                                                                        >
                                                                          {pe.exercise_library?.name ?? (pe.name ?? 'Exercice')}
                                                                        </strong>

                                                                        {!props.readOnly ? (
                                                                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                            <button
                                                                              type="button"
                                                                              className="icon-btn"
                                                                              title="Remplacer l'exercice"
                                                                              onPointerDown={(e) => {
                                                                                e.preventDefault()
                                                                                e.stopPropagation()
                                                                              }}
                                                                              onClick={(e) => {
                                                                                e.preventDefault()
                                                                                e.stopPropagation()
                                                                                setOpenWeekId(w.id)
                                                                                setOpenSessionId(s.id)
                                                                                setReplaceExerciseId(pe.id)
                                                                              }}
                                                                            >
                                                                              <IconRotate />
                                                                            </button>

                                                                            <form
                                                                              action={props.deleteProgramExerciseAction}
                                                                              onClick={(e) => {
                                                                                e.stopPropagation()
                                                                              }}
                                                                              onSubmit={(e) => {
                                                                                e.preventDefault()
                                                                                e.stopPropagation()
                                                                                if (props.readOnly) return

                                                                                optimisticDeleteExercise(s.id, pe.id)

                                                                                const fd = new FormData(e.currentTarget)
                                                                                fd.set('openWeek', openWeekId ?? '')
                                                                                fd.set('openSession', openSessionId ?? '')
                                                                                fd.set('client', '1')

                                                                                enqueueMutation(async () => {
                                                                                  await props.deleteProgramExerciseAction(fd)
                                                                                  requestRefresh()
                                                                                })
                                                                              }}
                                                                            >
                                                                              <input type="hidden" name="program_exercise_id" value={pe.id} />
                                                                              <input type="hidden" name="session_id" value={s.id} />
                                                                              <input type="hidden" name="openWeek" value={openWeekId ?? ''} />
                                                                              <input type="hidden" name="openSession" value={openSessionId ?? ''} />
                                                                              <input type="hidden" name="client" value="1" />
                                                                              <button
                                                                                type="button"
                                                                                className="icon-btn-danger"
                                                                                title="Supprimer l'exercice"
                                                                                onPointerDown={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()
                                                                                }}
                                                                                onClick={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()
                                                                                  e.currentTarget.form?.requestSubmit()
                                                                                }}
                                                                              >
                                                                                <IconTrash />
                                                                              </button>
                                                                            </form>
                                                                          </div>
                                                                        ) : null}
                                                                      </div>
                                                                    </div>

                                                                    {props.readOnly ? (
                                                                      <>
                                                                        {pe.sets != null ||
                                                                        pe.reps != null ||
                                                                        !!String(pe.rest_time ?? '').trim() ||
                                                                        !!String(pe.tempo ?? '').trim() ||
                                                                        !!String(pe.load ?? '').trim() ||
                                                                        !!String(pe.notes ?? '').trim() ? (
                                                                          <>
                                                                            {pe.sets != null || pe.reps != null || !!String(pe.rest_time ?? '').trim() ? (
                                                                              <div className="exercise-params-row-3">
                                                                                {pe.sets != null ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Séries</div>
                                                                                    <div className="field-plain">{formatMaybeNumber(pe.sets)}</div>
                                                                                  </div>
                                                                                ) : null}

                                                                                {pe.reps != null ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Rép.</div>
                                                                                    <div className="field-plain">{formatMaybeNumber(pe.reps)}</div>
                                                                                  </div>
                                                                                ) : null}

                                                                                {!!String(pe.rest_time ?? '').trim() ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Repos</div>
                                                                                    <div className="field-plain">{formatRestClosed(pe.rest_time)}</div>
                                                                                  </div>
                                                                                ) : null}
                                                                              </div>
                                                                            ) : null}

                                                                            {((!!String(pe.tempo ?? '').trim() ? 1 : 0) +
                                                                              (!!String(pe.load ?? '').trim() ? 1 : 0) +
                                                                              (!!String(pe.notes ?? '').trim() ? 1 : 0)) > 0 ? (
                                                                              <div className="exercise-params-row-2-notes">
                                                                                {!!String(pe.tempo ?? '').trim() ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Tempo</div>
                                                                                    <div className="field-plain">{String(pe.tempo ?? '').trim()}</div>
                                                                                  </div>
                                                                                ) : null}

                                                                                {!!String(pe.load ?? '').trim() ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Charge</div>
                                                                                    <div className="field-plain">{formatLoadClosed(pe.load)}</div>
                                                                                  </div>
                                                                                ) : null}

                                                                                {!!String(pe.notes ?? '').trim() ? (
                                                                                  <div style={{ display: 'grid', gap: 2, minWidth: 0, gridColumn: '1 / span 2' }}>
                                                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                                                                                    <div className="field-plain" style={{ minHeight: 52 }}>
                                                                                      {String(pe.notes ?? '').trim()}
                                                                                    </div>
                                                                                  </div>
                                                                                ) : null}
                                                                              </div>
                                                                            ) : null}
                                                                          </>
                                                                        ) : null}
                                                                      </>
                                                                    ) : (
                                                                      <>
                                                                        <input type="hidden" name="pe_ids" value={pe.id} form="save-all-exercises" />

                                                                        <div className="exercise-params-row-3">
                                                                          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Séries</div>
                                                                            <div className="stepper-field">
                                                                              <input
                                                                                ref={(el) => {
                                                                                  inputRefs.current[pe.id] = {
                                                                                    ...(inputRefs.current[pe.id] ?? {}),
                                                                                    sets: el,
                                                                                  }
                                                                                }}
                                                                                name={`sets_${pe.id}`}
                                                                                defaultValue={pe.sets ?? ''}
                                                                                inputMode="numeric"
                                                                                form="save-all-exercises"
                                                                                disabled={props.readOnly}
                                                                              />
                                                                              {!props.readOnly ? (
                                                                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.sets, +1)
                                                                                  }}
                                                                                  aria-label="Augmenter séries"
                                                                                >
                                                                                  +
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.sets, -1)
                                                                                  }}
                                                                                  aria-label="Diminuer séries"
                                                                                >
                                                                                  −
                                                                                </button>
                                                                              </div>
                                                                              ) : null}
                                                                            </div>
                                                                          </div>

                                                                          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Rép.</div>
                                                                            <div className="stepper-field">
                                                                              <input
                                                                                ref={(el) => {
                                                                                  inputRefs.current[pe.id] = {
                                                                                    ...(inputRefs.current[pe.id] ?? {}),
                                                                                    reps: el,
                                                                                  }
                                                                                }}
                                                                                name={`reps_${pe.id}`}
                                                                                defaultValue={pe.reps ?? ''}
                                                                                inputMode="numeric"
                                                                                form="save-all-exercises"
                                                                                disabled={props.readOnly}
                                                                              />
                                                                              {!props.readOnly ? (
                                                                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.reps, +1)
                                                                                  }}
                                                                                  aria-label="Augmenter répétitions"
                                                                                >
                                                                                  +
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.reps, -1)
                                                                                  }}
                                                                                  aria-label="Diminuer répétitions"
                                                                                >
                                                                                  −
                                                                                </button>
                                                                              </div>
                                                                              ) : null}
                                                                            </div>
                                                                          </div>

                                                                          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Repos</div>
                                                                            <div className="stepper-field">
                                                                              <input
                                                                                ref={(el) => {
                                                                                  inputRefs.current[pe.id] = {
                                                                                    ...(inputRefs.current[pe.id] ?? {}),
                                                                                    rest: el,
                                                                                  }
                                                                                }}
                                                                                name={`rest_time_${pe.id}`}
                                                                                defaultValue={pe.rest_time ?? ''}
                                                                                inputMode="numeric"
                                                                                placeholder="mm:ss"
                                                                                form="save-all-exercises"
                                                                                disabled={props.readOnly}
                                                                                onBlur={(e) => {
                                                                                  if (props.readOnly) return
                                                                                  e.currentTarget.value = normalizeRestTimeMmSs(e.currentTarget.value)
                                                                                }}
                                                                              />
                                                                              {!props.readOnly ? (
                                                                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepRestTimeInput(inputRefs.current[pe.id]?.rest, +30)
                                                                                  }}
                                                                                  aria-label="Augmenter repos"
                                                                                >
                                                                                  +
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepRestTimeInput(inputRefs.current[pe.id]?.rest, -30)
                                                                                  }}
                                                                                  aria-label="Diminuer repos"
                                                                                >
                                                                                  −
                                                                                </button>
                                                                              </div>
                                                                              ) : null}
                                                                            </div>
                                                                          </div>
                                                                        </div>

                                                                        <div className="exercise-params-row-2-notes">
                                                                          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Tempo</div>
                                                                            <div className="stepper-field">
                                                                              <input
                                                                                name={`tempo_${pe.id}`}
                                                                                defaultValue={pe.tempo ?? ''}
                                                                                form="save-all-exercises"
                                                                                disabled={props.readOnly}
                                                                              />
                                                                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }} aria-hidden>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  tabIndex={-1}
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0, visibility: 'hidden' }}
                                                                                >
                                                                                  +
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  tabIndex={-1}
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0, visibility: 'hidden' }}
                                                                                >
                                                                                  −
                                                                                </button>
                                                                              </div>
                                                                            </div>
                                                                          </div>

                                                                          <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                            <div style={{ fontSize: 12, color: '#6b7280' }}>Charge</div>
                                                                            <div className="stepper-field">
                                                                              <input
                                                                                ref={(el) => {
                                                                                  inputRefs.current[pe.id] = {
                                                                                    ...(inputRefs.current[pe.id] ?? {}),
                                                                                    load: el,
                                                                                  }
                                                                                }}
                                                                                name={`load_${pe.id}`}
                                                                                defaultValue={pe.load ?? ''}
                                                                                form="save-all-exercises"
                                                                                disabled={props.readOnly}
                                                                              />
                                                                              {!props.readOnly ? (
                                                                              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr' }}>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.load, +1)
                                                                                  }}
                                                                                  aria-label="Augmenter charge"
                                                                                >
                                                                                  +
                                                                                </button>
                                                                                <button
                                                                                  type="button"
                                                                                  className="icon-btn"
                                                                                  style={{ border: 0, borderRadius: 0, padding: 0 }}
                                                                                  onPointerDown={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                  }}
                                                                                  onClick={(e) => {
                                                                                    e.preventDefault()
                                                                                    e.stopPropagation()
                                                                                    stepNumberInput(inputRefs.current[pe.id]?.load, -1)
                                                                                  }}
                                                                                  aria-label="Diminuer charge"
                                                                                >
                                                                                  −
                                                                                </button>
                                                                              </div>
                                                                              ) : null}
                                                                            </div>
                                                                          </div>

                                                                          <button
                                                                            type="button"
                                                                            className="icon-btn"
                                                                            title="Notes"
                                                                            style={{
                                                                              alignSelf: 'end',
                                                                              padding: 0,
                                                                              width: 28,
                                                                              height: 28,
                                                                              fontSize: 16,
                                                                              position: 'relative',
                                                                            }}
                                                                            onPointerDown={(e) => {
                                                                              e.preventDefault()
                                                                              e.stopPropagation()
                                                                            }}
                                                                            onClick={(e) => {
                                                                              e.preventDefault()
                                                                              e.stopPropagation()
                                                                              setNotesOpenByExerciseId((prev) => ({
                                                                                ...prev,
                                                                                [pe.id]: !(prev[pe.id] ?? false),
                                                                              }))
                                                                            }}
                                                                            aria-pressed={notesOpenByExerciseId[pe.id] ?? false}
                                                                          >
                                                                            {(notesConfirmedByExerciseId[pe.id] ?? false) ||
                                                                            (!!String(pe.notes ?? '').trim() && !(notesClearedByExerciseId[pe.id] ?? false)) ? (
                                                                              <IconNoteValidated size={20} />
                                                                            ) : (
                                                                              <IconNote size={20} />
                                                                            )}
                                                                          </button>
                                                                        </div>

                                                                        {notesOpenByExerciseId[pe.id] ? (
                                                                          <div className="exercise-params-row-2-notes">
                                                                            <div style={{ display: 'grid', gap: 2, minWidth: 0, gridColumn: '1 / span 2' }}>
                                                                              <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                                                                              <div className="field-plain">
                                                                                <input
                                                                                  name={`notes_${pe.id}`}
                                                                                  value={getNotesDraft(pe.id, pe.notes)}
                                                                                  form="save-all-exercises"
                                                                                  style={{ height: 52 }}
                                                                                  disabled={props.readOnly}
                                                                                  onChange={(e) => {
                                                                                    if (props.readOnly) return
                                                                                    const next = e.currentTarget.value
                                                                                    setNotesDraftByExerciseId((prev) => ({ ...prev, [pe.id]: next }))
                                                                                    setNotesDirtyByExerciseId((prev) => ({ ...prev, [pe.id]: true }))
                                                                                  }}
                                                                                />
                                                                              </div>
                                                                            </div>

                                                                            {!props.readOnly ? (
                                                                            <div style={{ display: 'grid', gap: 6, alignItems: 'end' }}>
                                                                              <button
                                                                                type="button"
                                                                                className="icon-btn"
                                                                                title="Valider"
                                                                                onPointerDown={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()
                                                                                }}
                                                                                onClick={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()

                                                                                  const draft = String(getNotesDraft(pe.id, pe.notes)).trim()
                                                                                  setNotesOpenByExerciseId((prev) => ({ ...prev, [pe.id]: false }))

                                                                                  if (!draft) return

                                                                                  setNotesConfirmedByExerciseId((prev) => ({ ...prev, [pe.id]: true }))
                                                                                  setNotesClearedByExerciseId((prev) => ({ ...prev, [pe.id]: false }))

                                                                                  requestSubmitSaveAllExercises()
                                                                                }}
                                                                              >
                                                                                <IconCheck size={18} />
                                                                              </button>

                                                                              <button
                                                                                type="button"
                                                                                className="icon-btn-danger"
                                                                                title="Supprimer"
                                                                                onPointerDown={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()
                                                                                }}
                                                                                onClick={(e) => {
                                                                                  e.preventDefault()
                                                                                  e.stopPropagation()

                                                                                  setNotesDraftByExerciseId((prev) => ({ ...prev, [pe.id]: '' }))
                                                                                  setNotesDirtyByExerciseId((prev) => ({ ...prev, [pe.id]: true }))
                                                                                  setNotesClearedByExerciseId((prev) => ({ ...prev, [pe.id]: true }))
                                                                                  setNotesConfirmedByExerciseId((prev) => ({ ...prev, [pe.id]: false }))
                                                                                  setNotesOpenByExerciseId((prev) => ({ ...prev, [pe.id]: false }))

                                                                                  setSaveAllFieldValue(`notes_${pe.id}`, '')

                                                                                  requestSubmitSaveAllExercises()
                                                                                }}
                                                                              >
                                                                                <IconTrash size={18} />
                                                                              </button>
                                                                            </div>
                                                                            ) : null}
                                                                          </div>
                                                                        ) : null}

                                                                        {!props.readOnly && replaceExerciseId === pe.id ? (
                                                                          <div className="add-exercise-panel" id={`replace-${pe.id}`}>
                                                                            <ExerciseSearchClient
                                                                              mode="replace"
                                                                              sessionId={s.id}
                                                                              programExerciseId={pe.id}
                                                                              openWeek={w.id}
                                                                              openSession={s.id}
                                                                              uniqueMuscles={props.uniqueMuscles}
                                                                              autoFocus
                                                                              onDone={() => {
                                                                                setReplaceExerciseId(null)
                                                                              }}
                                                                              onReplaced={(exercise) => optimisticReplaceExercise(s.id, pe.id, exercise)}
                                                                              addAction={props.addExerciseToSessionAction}
                                                                              replaceAction={props.replaceProgramExerciseAction}
                                                                            />
                                                                          </div>
                                                                        ) : null}
                                                                      </>
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </SortableItem>
                                                            ))}
                                                          </div>
                                                        </SortableContext>
                                                      </DndContext>

                                                      {!props.readOnly ? (
                                                        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                            <button
                                                              type="button"
                                                              className="add-exercise-btn"
                                                              disabled={props.readOnly}
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                setOpenWeekId(w.id)
                                                                setOpenSessionId(s.id)
                                                                setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                              }}
                                                              title="Ajouter un exercice"
                                                              style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 10,
                                                                padding: '10px 12px',
                                                                borderRadius: 12,
                                                                border: '1px solid var(--brand)',
                                                                background: 'rgba(52, 28, 68, 0.06)',
                                                                color: 'var(--brand)',
                                                                fontWeight: 900,
                                                                cursor: props.readOnly ? 'default' : 'pointer',
                                                              }}
                                                            >
                                                              <IconPlus />
                                                              <span>Exercice</span>
                                                            </button>

                                                            <button
                                                              type="button"
                                                              className="add-exercise-btn"
                                                              disabled={props.readOnly || !props.addBlockAction}
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                if (!props.addBlockAction) return
                                                                setOpenWeekId(w.id)
                                                                setOpenSessionId(s.id)
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                              }}
                                                              title={props.addBlockAction ? "Ajouter un bloc" : "Bloc indisponible"}
                                                              style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 10,
                                                                padding: '10px 12px',
                                                                borderRadius: 12,
                                                                border: '1px solid var(--brand)',
                                                                background: '#ffffff',
                                                                color: 'var(--brand)',
                                                                fontWeight: 900,
                                                                cursor: props.readOnly || !props.addBlockAction ? 'not-allowed' : 'pointer',
                                                                opacity: props.addBlockAction ? 1 : 0.5,
                                                              }}
                                                            >
                                                              <IconPlus />
                                                              <span>Bloc</span>
                                                            </button>
                                                          </div>

                                                          {addOpenForSession ? (
                                                            <div className="add-exercise-panel" id={`add-${s.id}`} style={{ background: '#ffffff', borderRadius: 12 }}>
                                                              <ExerciseSearchClient
                                                                mode="add"
                                                                sessionId={s.id}
                                                                openWeek={w.id}
                                                                openSession={s.id}
                                                                uniqueMuscles={props.uniqueMuscles}
                                                                autoFocus
                                                                onDone={() => {
                                                                  setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                }}
                                                                onOptimisticAdd={(exercise) => {
                                                                  setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                  optimisticAddExercise(s.id, exercise)
                                                                }}
                                                                onReconcileOptimisticId={(tmpId, insertedId) =>
                                                                  reconcileOptimisticExerciseId(s.id, tmpId, insertedId)
                                                                }
                                                                addAction={props.addExerciseToSessionAction}
                                                                replaceAction={props.replaceProgramExerciseAction}
                                                              />
                                                            </div>
                                                          ) : null}

                                                          {addBlockOpenForSession && props.addBlockAction ? (
                                                            <div className="add-exercise-panel" style={{ background: '#ffffff', borderRadius: 12 }}>
                                                              <form
                                                                action={props.addBlockAction as unknown as (formData: FormData) => void}
                                                                onSubmit={(e) => {
                                                                  e.preventDefault()
                                                                  e.stopPropagation()
                                                                  if (props.readOnly) return
                                                                  if (!props.addBlockAction) return

                                                                  const fd = new FormData(e.currentTarget)
                                                                  const sessionId = String(fd.get('session_id') ?? '').trim()
                                                                  const rawType = String(fd.get('type') ?? '').trim().toLowerCase()
                                                                  const type = rawType || 'strength'
                                                                  const rawTitle = String(fd.get('title') ?? '').trim()
                                                                  const title = rawTitle ? rawTitle : null
                                                                  const tmpId = `tmp-block-${crypto.randomUUID()}`
                                                                  if (sessionId) {
                                                                    optimisticAddBlock(sessionId, { tmpId, type, title })
                                                                  }
                                                                  enqueueMutation(async () => {
                                                                    const res = (await props.addBlockAction?.(fd)) as unknown as
                                                                      | { newBlockId?: string | null }
                                                                      | void
                                                                    const newBlockId = res && typeof res === 'object' ? res.newBlockId ?? null : null
                                                                    if (sessionId && newBlockId && tmpId) {
                                                                      reconcileOptimisticBlockId(sessionId, tmpId, newBlockId)
                                                                    }
                                                                    if (sessionId && newBlockId) {
                                                                      setSelectedBlockIdBySessionId((prev) => ({ ...prev, [sessionId]: newBlockId }))
                                                                    }
                                                                    requestRefresh()
                                                                  })
                                                                  setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                }}
                                                                style={{ display: 'grid', gap: 8 }}
                                                              >
                                                                <input type="hidden" name="session_id" value={s.id} />
                                                                <input type="hidden" name="client" value="1" />

                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                  <label style={{ display: 'grid', gap: 4 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Type</span>
                                                                    <select
                                                                      name="type"
                                                                      defaultValue="strength"
                                                                      disabled={props.readOnly}
                                                                      style={{
                                                                        height: 40,
                                                                        borderRadius: 12,
                                                                        border: '1px solid #e5e7eb',
                                                                        background: '#ffffff',
                                                                        padding: '0 12px',
                                                                        fontSize: 14,
                                                                      }}
                                                                    >
                                                                      <option value="strength">Muscu</option>
                                                                      <option value="warmup">Warm-up</option>
                                                                      <option value="crosstraining">CrossFit</option>
                                                                      <option value="cardio">Cardio</option>
                                                                      <option value="mobility">Mobilité</option>
                                                                    </select>
                                                                  </label>

                                                                  <label style={{ display: 'grid', gap: 4 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Titre</span>
                                                                    <input
                                                                      name="title"
                                                                      placeholder="Nom du bloc"
                                                                      disabled={props.readOnly}
                                                                      style={{
                                                                        height: 40,
                                                                        borderRadius: 12,
                                                                        border: '1px solid #e5e7eb',
                                                                        background: '#ffffff',
                                                                        padding: '0 12px',
                                                                        fontSize: 14,
                                                                      }}
                                                                    />
                                                                  </label>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))}
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid #e5e7eb',
                                                                      background: '#ffffff',
                                                                      padding: '0 12px',
                                                                      fontWeight: 800,
                                                                      cursor: 'pointer',
                                                                    }}
                                                                  >
                                                                    Annuler
                                                                  </button>

                                                                  <button
                                                                    type="submit"
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid var(--brand)',
                                                                      background: 'var(--brand)',
                                                                      color: '#ffffff',
                                                                      padding: '0 14px',
                                                                      fontWeight: 900,
                                                                      cursor: 'pointer',
                                                                      display: 'inline-flex',
                                                                      alignItems: 'center',
                                                                      gap: 10,
                                                                    }}
                                                                  >
                                                                    <IconPlus />
                                                                    Créer
                                                                  </button>
                                                                </div>
                                                              </form>
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  ) : (
                                                    <div style={{ display: 'grid', gap: 8 }}>
                                                      <div style={{ color: '#6b7280' }}>
                                                        Aucun exercice pour cet entraînement.
                                                      </div>
                                                      {!props.readOnly ? (
                                                        <div style={{ display: 'grid', gap: 8 }}>
                                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                            <button
                                                              type="button"
                                                              className="add-exercise-btn"
                                                              disabled={props.readOnly}
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                setOpenWeekId(w.id)
                                                                setOpenSessionId(s.id)
                                                                setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                              }}
                                                              title="Ajouter un exercice"
                                                              style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 10,
                                                                padding: '10px 12px',
                                                                borderRadius: 12,
                                                                border: '1px solid var(--brand)',
                                                                background: 'rgba(52, 28, 68, 0.06)',
                                                                color: 'var(--brand)',
                                                                fontWeight: 900,
                                                                cursor: props.readOnly ? 'default' : 'pointer',
                                                              }}
                                                            >
                                                              <IconPlus />
                                                              <span>Exercice</span>
                                                            </button>

                                                            <button
                                                              type="button"
                                                              className="add-exercise-btn"
                                                              disabled={props.readOnly || !props.addBlockAction}
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                if (!props.addBlockAction) return
                                                                setOpenWeekId(w.id)
                                                                setOpenSessionId(s.id)
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                              }}
                                                              title={props.addBlockAction ? 'Ajouter un bloc' : 'Bloc indisponible'}
                                                              style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: 10,
                                                                padding: '10px 12px',
                                                                borderRadius: 12,
                                                                border: '1px solid var(--brand)',
                                                                background: '#ffffff',
                                                                color: 'var(--brand)',
                                                                fontWeight: 900,
                                                                cursor: props.readOnly || !props.addBlockAction ? 'not-allowed' : 'pointer',
                                                                opacity: props.addBlockAction ? 1 : 0.5,
                                                              }}
                                                            >
                                                              <IconPlus />
                                                              <span>Bloc</span>
                                                            </button>
                                                          </div>

                                                          {addOpenForSession ? (
                                                            <div className="add-exercise-panel" id={`add-${s.id}`}>
                                                              <ExerciseSearchClient
                                                                mode="add"
                                                                sessionId={s.id}
                                                                openWeek={w.id}
                                                                openSession={s.id}
                                                                uniqueMuscles={props.uniqueMuscles}
                                                                autoFocus
                                                                onDone={() => {
                                                                  setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                }}
                                                                onOptimisticAdd={(exercise) => {
                                                                  setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                  optimisticAddExercise(s.id, exercise)
                                                                }}
                                                                onReconcileOptimisticId={(tmpId, insertedId) =>
                                                                  reconcileOptimisticExerciseId(s.id, tmpId, insertedId)
                                                                }
                                                                addAction={props.addExerciseToSessionAction}
                                                                replaceAction={props.replaceProgramExerciseAction}
                                                              />
                                                            </div>
                                                          ) : null}

                                                          {addBlockOpenForSession && props.addBlockAction ? (
                                                            <div className="add-exercise-panel" style={{ background: '#ffffff', borderRadius: 12 }}>
                                                              <form
                                                                action={props.addBlockAction as unknown as (formData: FormData) => void}
                                                                onSubmit={(e) => {
                                                                  e.preventDefault()
                                                                  e.stopPropagation()
                                                                  if (props.readOnly) return
                                                                  if (!props.addBlockAction) return

                                                                  const fd = new FormData(e.currentTarget)
                                                                  const sessionId = String(fd.get('session_id') ?? '').trim()
                                                                  const rawType = String(fd.get('type') ?? '').trim().toLowerCase()
                                                                  const type = rawType || 'strength'
                                                                  const rawTitle = String(fd.get('title') ?? '').trim()
                                                                  const title = rawTitle ? rawTitle : null
                                                                  const tmpId = `tmp-block-${crypto.randomUUID()}`
                                                                  if (sessionId) {
                                                                    optimisticAddBlock(sessionId, { tmpId, type, title })
                                                                  }

                                                                  enqueueMutation(async () => {
                                                                    const res = (await props.addBlockAction?.(fd)) as unknown as
                                                                      | { newBlockId?: string | null }
                                                                      | void
                                                                    const newBlockId = res && typeof res === 'object' ? res.newBlockId ?? null : null
                                                                    if (sessionId && newBlockId && tmpId) {
                                                                      reconcileOptimisticBlockId(sessionId, tmpId, newBlockId)
                                                                    }
                                                                    if (sessionId && newBlockId) {
                                                                      setSelectedBlockIdBySessionId((prev) => ({ ...prev, [sessionId]: newBlockId }))
                                                                    }
                                                                    requestRefresh()
                                                                  })
                                                                  setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                }}
                                                                style={{ display: 'grid', gap: 8 }}
                                                              >
                                                                <input type="hidden" name="session_id" value={s.id} />
                                                                <input type="hidden" name="client" value="1" />

                                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                  <label style={{ display: 'grid', gap: 4 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Type</span>
                                                                    <select
                                                                      name="type"
                                                                      defaultValue="strength"
                                                                      disabled={props.readOnly}
                                                                      style={{
                                                                        height: 40,
                                                                        borderRadius: 12,
                                                                        border: '1px solid #e5e7eb',
                                                                        background: '#ffffff',
                                                                        padding: '0 12px',
                                                                        fontSize: 14,
                                                                      }}
                                                                    >
                                                                      <option value="strength">Muscu</option>
                                                                      <option value="warmup">Warm-up</option>
                                                                      <option value="crosstraining">CrossFit</option>
                                                                      <option value="cardio">Cardio</option>
                                                                      <option value="mobility">Mobilité</option>
                                                                    </select>
                                                                  </label>

                                                                  <label style={{ display: 'grid', gap: 4 }}>
                                                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Titre</span>
                                                                    <input
                                                                      name="title"
                                                                      placeholder="Nom du bloc"
                                                                      disabled={props.readOnly}
                                                                      style={{
                                                                        height: 40,
                                                                        borderRadius: 12,
                                                                        border: '1px solid #e5e7eb',
                                                                        background: '#ffffff',
                                                                        padding: '0 12px',
                                                                        fontSize: 14,
                                                                      }}
                                                                    />
                                                                  </label>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                                  <button
                                                                    type="button"
                                                                    onClick={() => setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))}
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid #e5e7eb',
                                                                      background: '#ffffff',
                                                                      padding: '0 12px',
                                                                      fontWeight: 800,
                                                                      cursor: 'pointer',
                                                                    }}
                                                                  >
                                                                    Annuler
                                                                  </button>

                                                                  <button
                                                                    type="submit"
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid var(--brand)',
                                                                      background: 'var(--brand)',
                                                                      color: '#ffffff',
                                                                      padding: '0 14px',
                                                                      fontWeight: 900,
                                                                      cursor: 'pointer',
                                                                      display: 'inline-flex',
                                                                      alignItems: 'center',
                                                                      gap: 10,
                                                                    }}
                                                                  >
                                                                    <IconPlus />
                                                                    Créer
                                                                  </button>
                                                                </div>
                                                              </form>
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      ) : null}
                                                    </div>
                                                  )}
                                                </div>
                                              </details>
                                            </li>
                                          )}
                                        </SortableItem>
                                      )
                                    })}
                                  </ul>
                                  </SortableContext>
                                </DndContext>
                              ) : (
                                <div style={{ color: '#6b7280' }}>Aucun entraînement pour cette semaine.</div>
                              )}

                              {!props.readOnly ? (
                                <form
                                  action={props.addSessionAction}
                                  style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}
                                  onSubmit={async (e) => {
                                    e.preventDefault()
                                    if (props.readOnly) return

                                    const fd = new FormData(e.currentTarget)
                                    const weekId = String(fd.get('week_id') ?? '')
                                    if (!weekId) return

                                    const newSessionId = optimisticAddSession(weekId)

                                    setOpenWeekId(weekId)
                                    setOpenSessionId(newSessionId)
                                    setReplaceExerciseId(null)

                                    fd.set('client', '1')

                                    enqueueMutation(async () => {
                                      await props.addSessionAction(fd)
                                      requestRefresh()
                                    })
                                  }}
                                >
                                  <input type="hidden" name="week_id" value={w.id} />
                                  <input type="hidden" name="title" value="" />
                                  <input type="hidden" name="client" value="1" />
                                  <button
                                    type="button"
                                    disabled={props.readOnly}
                                    onPointerDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.currentTarget.form?.requestSubmit()
                                    }}
                                    title="Ajouter un training"
                                    style={{
                                      display: 'inline-flex',
                                      width: '100%',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: 10,
                                      padding: '10px 12px',
                                      borderRadius: 12,
                                      border: '1px solid var(--brand)',
                                      background: 'rgba(52, 28, 68, 0.06)',
                                      color: 'var(--brand)',
                                      fontWeight: 900,
                                      cursor: props.readOnly ? 'default' : 'pointer',
                                    }}
                                  >
                                    <IconPlus />
                                    <span>Ajouter un training</span>
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          </details>
                        )}
                      </SortableItem>
                    )
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {weeksState.map((w) => {
                  const sessionsForWeek = sessionsByWeek[w.id] ?? []

                  return (
                    <StaticItem key={w.id}>
                      {({ setActivatorNodeRef, attributes, listeners }) => (
                        <details
                          open={openWeekId === w.id}
                          onToggle={(e) => {
                            const isOpen = e.currentTarget.open

                            if (isOpen) {
                              setOpenWeekId(w.id)
                              setOpenSessionId(null)
                              setReplaceExerciseId(null)
                              return
                            }

                            setReplaceExerciseId(null)
                            setOpenSessionId((prev) => (openWeekId === w.id ? null : prev))
                            setOpenWeekId((prev) => (prev === w.id ? null : prev))
                          }}
                          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}
                        >
                          <summary
                            ref={setActivatorNodeRef}
                            {...attributes}
                            {...listeners}
                            style={{
                              cursor: props.readOnly ? 'default' : 'grab',
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 12,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              touchAction: props.readOnly ? 'manipulation' : 'none',
                            }}
                          >
                            <strong
                              style={{
                                minWidth: 0,
                                overflowWrap: 'anywhere',
                                color: 'var(--brand)',
                                fontWeight: 800,
                                fontSize: 18,
                              }}
                              onPointerDownCapture={(e) => {
                                e.stopPropagation()
                              }}
                              onClick={(e) => {
                                if (props.readOnly) return
                                const now = Date.now()
                                const last = lastWeekTitleClickRef.current
                                lastWeekTitleClickRef.current = { at: now, weekId: w.id }
                                if (last && last.weekId === w.id && now - last.at < 350) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setEditingWeekId(w.id)
                                  setEditingWeekTitle(String(w.title ?? `Semaine ${w.week_order}`).trim())
                                }
                              }}
                            >
                              {editingWeekId === w.id ? (
                                <input
                                  value={editingWeekTitle}
                                  autoFocus
                                  onChange={(e) => setEditingWeekTitle(e.target.value)}
                                  onPointerDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setEditingWeekId(null)
                                      setEditingWeekTitle('')
                                      return
                                    }
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const nextTitle = editingWeekTitle.trim()
                                      setEditingWeekId(null)
                                      setEditingWeekTitle('')
                                      optimisticUpdateWeekTitle(w.id, nextTitle)
                                      void saveWeekTitle(w.id, nextTitle)
                                    }
                                  }}
                                  onBlur={() => {
                                    const nextTitle = editingWeekTitle.trim()
                                    setEditingWeekId(null)
                                    setEditingWeekTitle('')
                                    optimisticUpdateWeekTitle(w.id, nextTitle)
                                    void saveWeekTitle(w.id, nextTitle)
                                  }}
                                  style={{
                                    fontWeight: 700,
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    marginLeft: 8,
                                    minWidth: 120,
                                  }}
                                />
                              ) : String(w.title ?? '').trim() === '' ? (
                                `Semaine ${w.week_order}`
                              ) : (
                                String(w.title)
                              )}
                            </strong>

                            {!props.readOnly ? (
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <div
                                  className="week-actions-extra"
                                  style={{ gap: 6, alignItems: 'center' }}
                                >
                                  <form
                                    action={props.duplicateWeekAction}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                    }}
                                    onSubmit={async (e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (props.readOnly) return

                                      const fd = new FormData(e.currentTarget)
                                      const sourceWeekId = String(fd.get('week_id') ?? '')
                                      if (sourceWeekId) {
                                        const newSessionId = optimisticDuplicateWeek(sourceWeekId)
                                        if (newSessionId) {
                                          setOpenWeekId(sourceWeekId)
                                          setOpenSessionId(newSessionId)
                                        }
                                        setReplaceExerciseId(null)
                                      }

                                      fd.set('client', '1')

                                      enqueueMutation(async () => {
                                        await props.duplicateWeekAction(fd)
                                        requestRefresh()
                                      })
                                    }}
                                  >
                                    <input type="hidden" name="week_id" value={w.id} />
                                    <input type="hidden" name="client" value="1" />
                                    <button
                                      type="button"
                                      className="icon-btn"
                                      title="Dupliquer la semaine"
                                      onPointerDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        e.currentTarget.form?.requestSubmit()
                                      }}
                                    >
                                      <IconDuplicate />
                                    </button>
                                  </form>
                                </div>

                                <form
                                  action={props.deleteWeekAction}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                  }}
                                  onSubmit={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (props.readOnly) return

                                    const fd = new FormData(e.currentTarget)
                                    const weekId = String(fd.get('week_id') ?? '')
                                    if (!weekId) return

                                    scheduleDeleteWeek(weekId)
                                    if (openWeekId === weekId) {
                                      setOpenWeekId(null)
                                      setOpenSessionId(null)
                                      setReplaceExerciseId(null)
                                    }

                                    fd.set('client', '1')
                                  }}
                                >
                                  <input type="hidden" name="week_id" value={w.id} />
                                  <input type="hidden" name="client" value="1" />
                                  <button
                                    type="button"
                                    className="icon-btn-danger"
                                    title="Supprimer la semaine"
                                    onPointerDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                    }}
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      e.currentTarget.form?.requestSubmit()
                                    }}
                                  >
                                    <IconTrash />
                                  </button>
                                </form>
                              </div>
                            ) : null}
                          </summary>

                          <div
                            key={`week-content-${w.id}-${weekCloseNonceById[w.id] ?? 0}`}
                            style={{ marginTop: 10, display: 'grid', gap: 10 }}
                          >
                            {sessionsForWeek.length > 0 ? (
                              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                                {sessionsForWeek.map((s) => {
                                  const sessionExercises = hideExercises ? [] : exercisesBySession[s.id] ?? []
                                  const addOpenForSession = addOpenBySessionId[s.id] ?? false
                                  const addBlockOpenForSession = addBlockOpenBySessionId[s.id] ?? false
                                  const blocksForSession = blocksBySession[s.id] ?? []
                                  const selectedBlockId = selectedBlockIdBySessionId[s.id] ?? null
                                  const selectedBlock = selectedBlockId
                                    ? blocksForSession.find((b) => b.id === selectedBlockId) ?? null
                                    : null
                                  const selectedBlockExercises = selectedBlockId
                                    ? blockExercisesByBlockId[selectedBlockId] ?? []
                                    : []

                                  return (
                                    <StaticItem key={s.id}>
                                      {({ setActivatorNodeRef, attributes, listeners }) => (
                                        <li
                                          className="session-card"
                                          style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#ffffff' }}
                                        >
                                          <details
                                            open={openWeekId === w.id && openSessionId === s.id}
                                            onToggle={(e) => {
                                              const isOpen = e.currentTarget.open

                                              if (isOpen) {
                                                setOpenWeekId(w.id)
                                                setOpenSessionId(s.id)
                                                setReplaceExerciseId(null)
                                                return
                                              }

                                              setReplaceExerciseId(null)
                                              setOpenSessionId(null)
                                            }}
                                          >
                                            <summary
                                              ref={setActivatorNodeRef}
                                              {...attributes}
                                              {...listeners}
                                              style={{
                                                cursor: props.readOnly ? 'default' : 'grab',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                gap: 12,
                                                alignItems: 'flex-start',
                                                flexWrap: 'nowrap',
                                                touchAction: props.readOnly ? 'manipulation' : 'none',
                                              }}
                                            >
                                              <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: '1 1 auto' }}>
                                                <div
                                                  style={{
                                                    fontWeight: 800,
                                                    fontSize: 16,
                                                    minWidth: 0,
                                                    overflowWrap: 'anywhere',
                                                    color: 'var(--brand)',
                                                  }}
                                                  onPointerDownCapture={(e) => {
                                                    e.stopPropagation()
                                                  }}
                                                  onClick={(e) => {
                                                    if (props.readOnly) return
                                                    const now = Date.now()
                                                    const last = lastSessionTitleClickRef.current
                                                    lastSessionTitleClickRef.current = { at: now, sessionId: s.id }
                                                    if (last && last.sessionId === s.id && now - last.at < 350) {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                      setEditingSessionId(s.id)
                                                      setEditingSessionTitle(
                                                        String(s.title ?? `Entraînement ${s.session_order}`).trim()
                                                      )
                                                    }
                                                  }}
                                                >
                                                  {editingSessionId === s.id ? (
                                                  <input
                                                    value={editingSessionTitle}
                                                    autoFocus
                                                    onChange={(e) => setEditingSessionTitle(e.target.value)}
                                                    onPointerDown={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                    }}
                                                    onClick={(e) => {
                                                      e.preventDefault()
                                                      e.stopPropagation()
                                                    }}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Escape') {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        setEditingSessionId(null)
                                                        setEditingSessionTitle('')
                                                        return
                                                      }
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        const nextTitle = editingSessionTitle.trim()
                                                        setEditingSessionId(null)
                                                        setEditingSessionTitle('')
                                                        optimisticUpdateSessionTitle(w.id, s.id, nextTitle)
                                                        void saveSessionTitle(w.id, s.id, nextTitle)
                                                      }
                                                    }}
                                                    onBlur={() => {
                                                      const nextTitle = editingSessionTitle.trim()
                                                      setEditingSessionId(null)
                                                      setEditingSessionTitle('')
                                                      optimisticUpdateSessionTitle(w.id, s.id, nextTitle)
                                                      void saveSessionTitle(w.id, s.id, nextTitle)
                                                    }}
                                                    style={{
                                                      fontWeight: 700,
                                                      border: '1px solid #e5e7eb',
                                                      borderRadius: 6,
                                                      padding: '4px 8px',
                                                      marginLeft: 8,
                                                      minWidth: 120,
                                                    }}
                                                  />
                                                ) : String(s.title ?? '').trim() === '' ? (
                                                  `Entraînement ${s.session_order}`
                                                ) : (
                                                  String(s.title)
                                                )}
                                                </div>

                                                {hideExercises ? null : !(openWeekId === w.id && openSessionId === s.id) &&
                                                editingSessionId !== s.id &&
                                                (sessionExercises.length > 0 || blocksForSession.length > 0) ? (
                                                  <div
                                                    style={{
                                                      fontSize: 12,
                                                      lineHeight: '14px',
                                                      color: '#6b7280',
                                                      whiteSpace: 'nowrap',
                                                      overflow: 'hidden',
                                                      maxWidth: '100%',
                                                      WebkitMaskImage:
                                                        'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                                                      maskImage:
                                                        'linear-gradient(to right, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%)',
                                                    }}
                                                  >
                                                    {[...sessionExercises
                                                      .map((pe) => String(pe.exercise_library?.name ?? '').trim())
                                                      .filter(Boolean),
                                                    ...blocksForSession
                                                      .map((b) => String(b.title ?? '').trim())
                                                      .filter(Boolean)]
                                                      .join(' • ')}
                                                  </div>
                                                ) : null}
                                              </div>

                                              {!props.readOnly ? (
                                                <div
                                                  style={{
                                                    display: 'flex',
                                                    gap: 6,
                                                    alignItems: 'center',
                                                    flex: '0 0 auto',
                                                    alignSelf: 'flex-start',
                                                  }}
                                                >
                                                  <div className="session-actions-extra" style={{ gap: 6, alignItems: 'center' }}>
                                                    <form
                                                      action={props.duplicateSessionAction as unknown as (formData: FormData) => void}
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                      }}
                                                      onSubmit={async (e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        if (props.readOnly) return

                                                        const fd = new FormData(e.currentTarget)
                                                        const weekId = String(fd.get('week_id') ?? '')
                                                        const sessionId = String(fd.get('session_id') ?? '')
                                                        fd.set('client', '1')
                                                        let tmpSessionId: string | null = null
                                                        if (weekId && sessionId) {
                                                          tmpSessionId = optimisticDuplicateSession(weekId, sessionId)
                                                          setOpenWeekId(weekId)
                                                          setOpenSessionId(tmpSessionId)
                                                          setReplaceExerciseId(null)
                                                        }

                                                        fd.set('openWeek', weekId)
                                                        if (tmpSessionId) fd.set('openSession', tmpSessionId)
                                                        else fd.delete('openSession')

                                                        enqueueMutation(async () => {
                                                          const res = (await props.duplicateSessionAction(fd)) as unknown as
                                                            | { newSessionId?: string }
                                                            | void

                                                          const newSessionId =
                                                            res && typeof res === 'object'
                                                              ? (res as { newSessionId?: string }).newSessionId
                                                              : null

                                                          if (weekId && tmpSessionId && newSessionId) {
                                                            reconcileOptimisticSessionId(weekId, tmpSessionId, newSessionId)
                                                          }

                                                          requestRefresh()
                                                        })
                                                      }}
                                                    >
                                                      <input type="hidden" name="week_id" value={w.id} />
                                                      <input type="hidden" name="session_id" value={s.id} />
                                                      <input type="hidden" name="client" value="1" />
                                                      <button
                                                        type="button"
                                                        className="icon-btn"
                                                        title="Dupliquer l’entraînement"
                                                        onPointerDown={(e) => {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                        }}
                                                        onClick={(e) => {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                          e.currentTarget.form?.requestSubmit()
                                                        }}
                                                      >
                                                        <IconDuplicate />
                                                      </button>
                                                    </form>
                                                  </div>
                                                </div>
                                              ) : null}
                                            </summary>

                                            <div style={{ marginTop: 10 }}>
                                              {openWeekId === w.id && openSessionId === s.id && selectedBlockId && selectedBlock && selectedBlock.type === 'crosstraining' ? (
                                                <div style={{ display: 'grid', gap: 10, marginBottom: 10 }}>
                                                  <div
                                                    style={{
                                                      border: '1px solid #e5e7eb',
                                                      borderRadius: 14,
                                                      background: '#ffffff',
                                                      padding: 12,
                                                      display: 'grid',
                                                      gap: 10,
                                                    }}
                                                    onPointerDownCapture={(e) => {
                                                      e.stopPropagation()
                                                    }}
                                                    onKeyDownCapture={(e) => {
                                                      e.stopPropagation()
                                                    }}
                                                  >
                                                    {blockLockedById[selectedBlock.id] ? (
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                                        <div style={{ minWidth: 0 }}>
                                                          <div style={{ fontWeight: 900, color: 'var(--brand)', overflowWrap: 'anywhere' }}>
                                                            {selectedBlock.title ?? 'Crossfit'}
                                                          </div>
                                                          {selectedBlock.notes ? (
                                                            <div style={{ marginTop: 2, fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere' }}>
                                                              {selectedBlock.notes}
                                                            </div>
                                                          ) : null}
                                                        </div>

                                                        {!props.readOnly ? (
                                                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: '0 0 auto' }}>
                                                            <button
                                                              type="button"
                                                              className="icon-btn"
                                                              title="Éditer"
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                unlockCrosstrainingBlock(selectedBlock.id, selectedBlock)
                                                              }}
                                                            >
                                                              <IconEdit size={18} />
                                                            </button>

                                                            <button
                                                              type="button"
                                                              className="icon-btn"
                                                              title="Dupliquer"
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                duplicateCrosstrainingBlock(selectedBlock)
                                                              }}
                                                            >
                                                              <IconDuplicate />
                                                            </button>

                                                            <button
                                                              type="button"
                                                              className="icon-btn-danger"
                                                              title="Supprimer"
                                                              onPointerDown={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                              }}
                                                              onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                deleteCrosstrainingBlock(selectedBlock)
                                                              }}
                                                            >
                                                              <IconTrash />
                                                            </button>
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <div style={{ display: 'grid', gap: 2 }}>
                                                          <div style={{ fontWeight: 900, color: 'var(--brand)' }}>Crossfit</div>
                                                          {selectedBlock.title ? (
                                                            <div
                                                              style={{
                                                                fontSize: 12,
                                                                color: '#6b7280',
                                                                fontWeight: 700,
                                                                overflowWrap: 'anywhere',
                                                              }}
                                                            >
                                                              {selectedBlock.title}
                                                            </div>
                                                          ) : null}
                                                        </div>

                                                        <BlockCharacteristicsForm block={selectedBlock} />
                                                      </>
                                                    )}

                                                    {selectedBlockExercises.length > 0 ? (
                                                      <div style={{ display: 'grid', gap: 8 }}>
                                                        {selectedBlockExercises.map((row) => (
                                                          <div
                                                            key={row.id}
                                                            style={{
                                                              border: '1px solid #e5e7eb',
                                                              borderRadius: 14,
                                                              background: '#ffffff',
                                                              padding: '10px 12px',
                                                              display: 'grid',
                                                              gridTemplateColumns: '1fr 220px',
                                                              gap: 10,
                                                              alignItems: 'center',
                                                            }}
                                                          >
                                                            <div style={{ fontWeight: 900, color: 'var(--brand)', overflowWrap: 'anywhere' }}>
                                                              {row.exercise_library?.name ?? row.exercise_name ?? 'Exercice'}
                                                            </div>

                                                            {blockLockedById[selectedBlock.id] ? (
                                                              getBlockLoadDraft(row.id, row.load_text) ? (
                                                                <div style={{ fontSize: 12, color: '#6b7280', overflowWrap: 'anywhere', textAlign: 'right' }}>
                                                                  {getBlockLoadDraft(row.id, row.load_text)}
                                                                </div>
                                                              ) : null
                                                            ) : (
                                                              <input
                                                                value={getBlockLoadDraft(row.id, row.load_text)}
                                                                onChange={(e) => {
                                                                  const value = e.currentTarget.value
                                                                  setBlockLoadTextDraftById((prev) => ({
                                                                    ...prev,
                                                                    [row.id]: value,
                                                                  }))
                                                                }}
                                                                onKeyDown={(e) => {
                                                                  if (e.key !== 'Enter') return
                                                                  e.preventDefault()
                                                                  e.stopPropagation()
                                                                  if (props.readOnly) return
                                                                  if (!props.updateBlockExerciseAction) return
                                                                  const fd = new FormData()
                                                                  fd.set('block_exercise_id', row.id)
                                                                  fd.set('load_text', getBlockLoadDraft(row.id, row.load_text))
                                                                  fd.set('client', '1')
                                                                  enqueueMutation(async () => {
                                                                    await props.updateBlockExerciseAction?.(fd)
                                                                    requestRefresh()
                                                                  })
                                                                }}
                                                                onBlur={() => {
                                                                  if (props.readOnly) return
                                                                  if (!props.updateBlockExerciseAction) return
                                                                  const fd = new FormData()
                                                                  fd.set('block_exercise_id', row.id)
                                                                  fd.set('load_text', getBlockLoadDraft(row.id, row.load_text))
                                                                  fd.set('client', '1')
                                                                  enqueueMutation(async () => {
                                                                    await props.updateBlockExerciseAction?.(fd)
                                                                    requestRefresh()
                                                                  })
                                                                }}
                                                                placeholder="rep, poids…"
                                                                disabled={props.readOnly || !props.updateBlockExerciseAction}
                                                                style={{
                                                                  height: 40,
                                                                  borderRadius: 12,
                                                                  border: '1px solid #e5e7eb',
                                                                  background: '#ffffff',
                                                                  padding: '0 12px',
                                                                  fontSize: 14,
                                                                  width: '100%',
                                                                  boxSizing: 'border-box',
                                                                }}
                                                              />
                                                            )}
                                                          </div>
                                                        ))}
                                                      </div>
                                                    ) : null}

                                                    {!blockLockedById[selectedBlock.id] && props.addBlockExerciseAction ? (
                                                      <BlockExerciseSearch sessionBlockId={selectedBlockId} />
                                                    ) : null}
                                                  </div>

                                                  {!blockLockedById[selectedBlock.id] ? (
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                      <button
                                                        type="button"
                                                        disabled={props.readOnly}
                                                        onPointerDown={(e) => {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                        }}
                                                        onClick={(e) => {
                                                          e.preventDefault()
                                                          e.stopPropagation()
                                                          saveCrosstrainingBlock(selectedBlock)
                                                        }}
                                                        style={{
                                                          height: 40,
                                                          borderRadius: 12,
                                                          border: '1px solid var(--brand)',
                                                          background: 'var(--brand)',
                                                          color: '#ffffff',
                                                          padding: '0 14px',
                                                          fontWeight: 900,
                                                          cursor: props.readOnly ? 'default' : 'pointer',
                                                        }}
                                                      >
                                                        {blockSavedFlashById[selectedBlock.id] ? 'Enregistré' : 'Enregistrer'}
                                                      </button>
                                                    </div>
                                                  ) : null}
                                                </div>
                                              ) : null}

                                              {!hideExercises ? (
                                                sessionExercises.length > 0 ? (
                                                  <div style={{ display: 'grid', gap: 8 }}>
                                                    {sessionExercises.map((pe) => (
                                                      <StaticItem key={pe.id}>
                                                        {({ setActivatorNodeRef, attributes, listeners }) => (
                                                          <div
                                                            id={`pe-${pe.id}`}
                                                            className="exercise-card"
                                                            style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#ffffff' }}
                                                          >
                                                            <div style={{ display: 'grid', gap: 6 }}>
                                                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                                                                <strong
                                                                  ref={setActivatorNodeRef}
                                                                  className="exercise-title"
                                                                  style={{ minWidth: 0, overflowWrap: 'anywhere', fontSize: 16, color: 'var(--brand)' }}
                                                                  {...attributes}
                                                                  {...listeners}
                                                                >
                                                                  {pe.exercise_library?.name ?? pe.name ?? 'Exercice'}
                                                                </strong>
                                                              </div>

                                                              {pe.sets != null ||
                                                              pe.reps != null ||
                                                              !!String(pe.rest_time ?? '').trim() ||
                                                              !!String(pe.tempo ?? '').trim() ||
                                                              !!String(pe.load ?? '').trim() ||
                                                              !!String(pe.notes ?? '').trim() ? (
                                                                <>
                                                                  {pe.sets != null || pe.reps != null || !!String(pe.rest_time ?? '').trim() ? (
                                                                    <div className="exercise-params-row-3">
                                                                      {pe.sets != null ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Séries</div>
                                                                          <div className="field-plain">{formatMaybeNumber(pe.sets)}</div>
                                                                        </div>
                                                                      ) : null}

                                                                      {pe.reps != null ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Rép.</div>
                                                                          <div className="field-plain">{formatMaybeNumber(pe.reps)}</div>
                                                                        </div>
                                                                      ) : null}

                                                                      {!!String(pe.rest_time ?? '').trim() ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Repos</div>
                                                                          <div className="field-plain">{formatRestClosed(pe.rest_time)}</div>
                                                                        </div>
                                                                      ) : null}
                                                                    </div>
                                                                  ) : null}

                                                                  {((!!String(pe.tempo ?? '').trim() ? 1 : 0) +
                                                                    (!!String(pe.load ?? '').trim() ? 1 : 0) +
                                                                    (!!String(pe.notes ?? '').trim() ? 1 : 0)) > 0 ? (
                                                                    <div className="exercise-params-row-2-notes">
                                                                      {!!String(pe.tempo ?? '').trim() ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Tempo</div>
                                                                          <div className="field-plain">{String(pe.tempo ?? '').trim()}</div>
                                                                        </div>
                                                                      ) : null}

                                                                      {!!String(pe.load ?? '').trim() ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Charge</div>
                                                                          <div className="field-plain">{formatLoadClosed(pe.load)}</div>
                                                                        </div>
                                                                      ) : null}

                                                                      {!!String(pe.notes ?? '').trim() ? (
                                                                        <div style={{ display: 'grid', gap: 2, minWidth: 0, gridColumn: '1 / span 2' }}>
                                                                          <div style={{ fontSize: 12, color: '#6b7280' }}>Notes</div>
                                                                          <div className="field-plain" style={{ minHeight: 52 }}>
                                                                            {String(pe.notes ?? '').trim()}
                                                                          </div>
                                                                        </div>
                                                                      ) : null}
                                                                    </div>
                                                                  ) : null}
                                                                </>
                                                              ) : null}
                                                            </div>
                                                          </div>
                                                        )}
                                                      </StaticItem>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div style={{ display: 'grid', gap: 8 }}>
                                                    <div style={{ color: '#6b7280' }}>Aucun exercice pour cet entraînement.</div>
                                                    {!props.readOnly ? (
                                                      <div style={{ display: 'grid', gap: 8 }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                          <button
                                                            type="button"
                                                            className="add-exercise-btn"
                                                            disabled={props.readOnly}
                                                            onPointerDown={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                            }}
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              setOpenWeekId(w.id)
                                                              setOpenSessionId(s.id)
                                                              setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                              setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                            }}
                                                            title="Ajouter un exercice"
                                                            style={{
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              gap: 10,
                                                              padding: '10px 12px',
                                                              borderRadius: 12,
                                                              border: '1px solid var(--brand)',
                                                              background: 'rgba(52, 28, 68, 0.06)',
                                                              color: 'var(--brand)',
                                                              fontWeight: 900,
                                                              cursor: props.readOnly ? 'default' : 'pointer',
                                                            }}
                                                          >
                                                            <IconPlus />
                                                            <span>Exercice</span>
                                                          </button>

                                                          <button
                                                            type="button"
                                                            className="add-exercise-btn"
                                                            disabled={props.readOnly || !props.addBlockAction}
                                                            onPointerDown={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                            }}
                                                            onClick={(e) => {
                                                              e.preventDefault()
                                                              e.stopPropagation()
                                                              if (!props.addBlockAction) return
                                                              setOpenWeekId(w.id)
                                                              setOpenSessionId(s.id)
                                                              setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                              setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: true }))
                                                            }}
                                                            title={props.addBlockAction ? 'Ajouter un bloc' : 'Bloc indisponible'}
                                                            style={{
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              justifyContent: 'center',
                                                              gap: 10,
                                                              padding: '10px 12px',
                                                              borderRadius: 12,
                                                              border: '1px solid var(--brand)',
                                                              background: '#ffffff',
                                                              color: 'var(--brand)',
                                                              fontWeight: 900,
                                                              cursor: props.readOnly || !props.addBlockAction ? 'not-allowed' : 'pointer',
                                                              opacity: props.addBlockAction ? 1 : 0.5,
                                                            }}
                                                          >
                                                            <IconPlus />
                                                            <span>Bloc</span>
                                                          </button>
                                                        </div>

                                                        {addOpenForSession ? (
                                                          <div className="add-exercise-panel" id={`add-${s.id}`} style={{ background: '#ffffff', borderRadius: 12 }}>
                                                            <ExerciseSearchClient
                                                              mode="add"
                                                              sessionId={s.id}
                                                              openWeek={w.id}
                                                              openSession={s.id}
                                                              uniqueMuscles={props.uniqueMuscles}
                                                              autoFocus
                                                              onDone={() => {
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                              }}
                                                              onOptimisticAdd={(exercise) => {
                                                                setAddOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                                optimisticAddExercise(s.id, exercise)
                                                              }}
                                                              onReconcileOptimisticId={(tmpId, insertedId) =>
                                                                reconcileOptimisticExerciseId(s.id, tmpId, insertedId)
                                                              }
                                                              addAction={props.addExerciseToSessionAction}
                                                              replaceAction={props.replaceProgramExerciseAction}
                                                            />
                                                          </div>
                                                        ) : null}

                                                        {addBlockOpenForSession && props.addBlockAction ? (
                                                          <div className="add-exercise-panel" style={{ background: '#ffffff', borderRadius: 12 }}>
                                                            <form
                                                              action={props.addBlockAction as unknown as (formData: FormData) => void}
                                                              onSubmit={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                if (props.readOnly) return
                                                                if (!props.addBlockAction) return

                                                                const fd = new FormData(e.currentTarget)
                                                                const sessionId = String(fd.get('session_id') ?? '').trim()
                                                                const rawType = String(fd.get('type') ?? '').trim().toLowerCase()
                                                                const type = rawType || 'strength'
                                                                const rawTitle = String(fd.get('title') ?? '').trim()
                                                                const title = rawTitle ? rawTitle : null
                                                                const tmpId = `tmp-block-${crypto.randomUUID()}`
                                                                if (sessionId) {
                                                                  optimisticAddBlock(sessionId, { tmpId, type, title })
                                                                }
                                                                enqueueMutation(async () => {
                                                                  const res = (await props.addBlockAction?.(fd)) as unknown as
                                                                    | { newBlockId?: string | null }
                                                                    | void
                                                                  const newBlockId = res && typeof res === 'object' ? res.newBlockId ?? null : null
                                                                  if (sessionId && newBlockId && tmpId) {
                                                                    reconcileOptimisticBlockId(sessionId, tmpId, newBlockId)
                                                                  }
                                                                  requestRefresh()
                                                                })
                                                                setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))
                                                              }}
                                                              style={{ display: 'grid', gap: 8 }}
                                                            >
                                                              <input type="hidden" name="session_id" value={s.id} />
                                                              <input type="hidden" name="client" value="1" />

                                                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                                <label style={{ display: 'grid', gap: 4 }}>
                                                                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Type</span>
                                                                  <select
                                                                    name="type"
                                                                    defaultValue="strength"
                                                                    disabled={props.readOnly}
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid #e5e7eb',
                                                                      background: '#ffffff',
                                                                      padding: '0 12px',
                                                                      fontSize: 14,
                                                                    }}
                                                                  >
                                                                    <option value="strength">Muscu</option>
                                                                    <option value="warmup">Warm-up</option>
                                                                    <option value="crosstraining">CrossFit</option>
                                                                    <option value="cardio">Cardio</option>
                                                                    <option value="mobility">Mobilité</option>
                                                                  </select>
                                                                </label>

                                                                <label style={{ display: 'grid', gap: 4 }}>
                                                                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)' }}>Titre</span>
                                                                  <input
                                                                    name="title"
                                                                    placeholder="Nom du bloc"
                                                                    disabled={props.readOnly}
                                                                    style={{
                                                                      height: 40,
                                                                      borderRadius: 12,
                                                                      border: '1px solid #e5e7eb',
                                                                      background: '#ffffff',
                                                                      padding: '0 12px',
                                                                      fontSize: 14,
                                                                    }}
                                                                  />
                                                                </label>
                                                              </div>

                                                              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                                <button
                                                                  type="button"
                                                                  onClick={() => setAddBlockOpenBySessionId((prev) => ({ ...prev, [s.id]: false }))}
                                                                  style={{
                                                                    height: 40,
                                                                    borderRadius: 12,
                                                                    border: '1px solid #e5e7eb',
                                                                    background: '#ffffff',
                                                                    padding: '0 12px',
                                                                    fontWeight: 800,
                                                                    cursor: 'pointer',
                                                                  }}
                                                                >
                                                                  Annuler
                                                                </button>

                                                                <button
                                                                  type="submit"
                                                                  style={{
                                                                    height: 40,
                                                                    borderRadius: 12,
                                                                    border: '1px solid var(--brand)',
                                                                    background: 'var(--brand)',
                                                                    color: '#ffffff',
                                                                    padding: '0 14px',
                                                                    fontWeight: 900,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: 10,
                                                                  }}
                                                                >
                                                                  <IconPlus />
                                                                  Créer
                                                                </button>
                                                              </div>
                                                            </form>
                                                          </div>
                                                        ) : null}
                                                      </div>
                                                    ) : null}
                                                  </div>
                                                )
                                              ) : null}
                                            </div>
                                            </details>
                                        </li>
                                      )}
                                  </StaticItem>
                                  )
                                })}
                            </ul>
                          ) : (
                            <div style={{ color: '#6b7280' }}>Aucun entraînement pour cette semaine.</div>
                          )}

                        {!props.readOnly ? (
                          <form
                            action={props.addSessionAction}
                            style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}
                            onSubmit={(e) => {
                              e.preventDefault()
                              if (props.readOnly) return

                              const fd = new FormData(e.currentTarget)
                              const weekId = String(fd.get('week_id') ?? '')
                              if (!weekId) return

                              optimisticAddSession(weekId)

                              setOpenWeekId(weekId)
                              setReplaceExerciseId(null)

                              fd.set('client', '1')

                              enqueueMutation(async () => {
                                await props.addSessionAction(fd)
                                requestRefresh()
                              })
                            }}
                          >
                            <input type="hidden" name="week_id" value={w.id} />
                            <input type="hidden" name="title" value="" />
                            <input type="hidden" name="client" value="1" />
                            <button
                              type="button"
                              style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: '1px solid var(--brand)',
                                background: 'rgba(52, 28, 68, 0.06)',
                                color: 'var(--brand)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                fontWeight: 800,
                              }}
                              title="Ajouter un training"
                              onPointerDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                e.currentTarget.form?.requestSubmit()
                              }}
                            >
                              <IconPlus />
                              <span style={{ fontSize: 12 }}>Ajouter un training</span>
                            </button>
                          </form>
                        ) : null}
                        </div>
                      </details>
                    )}
                  </StaticItem>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: '#6b7280', marginTop: 12 }}>Aucune semaine pour ce programme.</p>
      )}

      {!props.readOnly ? (
        <form
          action={props.addWeekAction}
          style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault()
            if (props.readOnly) return

            optimisticAddWeek()

            const fd = new FormData(e.currentTarget)
            fd.set('client', '1')

            enqueueMutation(async () => {
              await props.addWeekAction(fd)
              requestRefresh()
            })
          }}
        >
          <input type="hidden" name="title" value="" />
          <input type="hidden" name="client" value="1" />
          <button
            type="button"
            style={{
              width: '100%',
              padding: '12px 12px',
              borderRadius: 12,
              border: '1px solid var(--brand)',
              background: 'rgba(52, 28, 68, 0.06)',
              color: 'var(--brand)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontWeight: 900,
            }}
            title="Ajouter une semaine"
            onPointerDown={(e) => {
              e.preventDefault()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }}
          >
            <IconPlus />
            <span style={{ fontSize: 12 }}>Ajouter une semaine</span>
          </button>
        </form>
      ) : null}

      <div style={{ height: 90 }} />
    </section>
  )
}
