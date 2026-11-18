'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { setProgramCatalogStatusAction } from '@/src/app/admin/programs/catalogActions'
import { updateTrainlyProgramInfosQuietAction } from '@/src/app/admin/programs/programCreateActions'
import {
  forkKridProgramToDraftAction,
  moveCoachProgramToDraftAction,
  publishCoachProgramAsTemplateAction,
} from '@/src/app/programs/actions'
import {
  addTrainlyLibrarySessionAction,
  appendLibraryBlockToProgramAction,
  appendLibraryExerciseToProgramAction,
  deleteTrainlyProgramSessionAction,
  moveTrainlyProgramSessionAction,
  reorderTrainlyProgramSessionInDayAction,
  type BoardMutationPatch,
  type CompositionAppendPatch,
  type QuietMutationResult,
} from '@/src/app/admin/programs/programSessionActions'
import {
  deleteTrainlyProgramWeekQuietAction,
  duplicateTrainlyProgramWeekQuietAction,
  renameTrainlyProgramWeekQuietAction,
  reorderTrainlyProgramWeeksQuietAction,
  syncTrainlyProgramWeekCountQuietAction,
  type WeekBoardPatch,
  type WeekQuietResult,
} from '@/src/app/admin/programs/programWeekActions'
import { AdminProgramWeekPills } from '@/src/components/admin/AdminProgramWeekPills'
import {
  convertTrainlyProgramToCalendarQuietAction,
  convertTrainlyProgramToSlotsQuietAction,
  removeTrainlyProgramSlotDayQuietAction,
} from '@/src/app/admin/programs/programModeActions'
import {
  ProgramBuilderPalette,
  type CatalogFilterOption,
  type PaletteBlockItem,
  type PaletteExerciseItem,
  type PaletteSessionItem,
} from '@/src/components/admin/ProgramBuilderPalette'
import {
  ProgramBuilderDayBoard,
  useBuilderPhoneLayout,
  type BuilderCompositionApi,
  type BuilderSession,
  type CompositionEditorCatalog,
} from '@/src/components/admin/ProgramBuilderDayBoard'
import {
  decodeDaySessionOrder,
  renumberDayOrders,
} from '@/src/lib/programs/builderDayOrder'
import {
  countDaysDeletedOnCalendarConvert,
  countSundaySessionsToDeleteOnSlotsConvert,
} from '@/src/lib/programs/flattenWeekSessionsToSlots'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { durationLabelFromWeekCount } from '@/src/lib/formatProgramDuration'
import { ProgramSessionMetaPopup } from '@/src/components/admin/ProgramSessionMetaPopup'
import { useSidebarCollapsed } from '@/src/components/shell/useSidebarCollapsed'
import {
  Button,
  ConfirmSubmitButton,
  IconBack,
  IconCaret,
  IconDuplicate,
  IconEdit,
  IconPlus,
  IconTrash,
  PendingFormButton,
  daFieldClass,
  daSelectClass,
} from '@/src/components/ui'

export type AdminProgramWeek = {
  id: string
  title: string | null
  week_order: number
}

export type AdminProgramBuilderData = {
  id: string
  title: string | null
  description: string | null
  goal: string | null
  level: string | null
  duration: string | null
  image_url: string | null
  is_calendar: boolean
  catalog_status: string | null
  /** Photocopie envoyée à un client (hors hubs). */
  is_client_instance?: boolean
  allow_duplicate: boolean
  weeks: AdminProgramWeek[]
  sessions: BuilderSession[]
}

function statusLabel(status: string | null) {
  if (status === 'published') return 'Publié'
  if (status === 'review') return 'Review'
  return 'Brouillon'
}

function weekHref(basePath: string, programId: string, weekId: string) {
  return `${basePath}/${programId}?week=${encodeURIComponent(weekId)}`
}

function chipBtnClass(disabled?: boolean) {
  return `inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-bold transition ${
    disabled
      ? 'bg-[var(--accent)] text-[color:var(--muted)] opacity-40'
      : 'bg-[var(--accent)] text-[color:var(--fg)] hover:ring-1 hover:ring-[var(--border)]'
  }`
}

/** Évite d’afficher du HTML brut (ex. page Cloudflare 502) dans un alert. */
function formatUserError(raw: unknown, fallback = 'Une erreur est survenue'): string {
  const text = String(raw ?? '').trim()
  if (!text) return fallback
  const lower = text.toLowerCase()
  if (
    lower.includes('<html') ||
    lower.includes('<!doctype') ||
    lower.includes('bad gateway') ||
    lower.includes('502') ||
    lower.includes('cloudflare')
  ) {
    return 'Serveur temporairement indisponible — réessaie dans un instant.'
  }
  if (text.length > 280 || /<[^>]+>/.test(text)) {
    return fallback
  }
  return text
}

function alertError(raw: unknown, fallback?: string) {
  window.alert(formatUserError(raw, fallback))
}

export function AdminProgramBuilderShell({
  program,
  catalogSessions,
  catalogBlocks,
  catalogExercises,
  catalogSports = [],
  catalogTypes = [],
  compositionEditor = null,
  initialWeekId = null,
  initialDay = null,
  softFlash = null,
  variant = 'admin',
  basePath = '/admin/programs',
  backHref,
  readOnly = false,
}: {
  program: AdminProgramBuilderData
  catalogSessions: PaletteSessionItem[]
  catalogBlocks: PaletteBlockItem[]
  catalogExercises: PaletteExerciseItem[]
  catalogSports?: CatalogFilterOption[]
  catalogTypes?: CatalogFilterOption[]
  compositionEditor?: CompositionEditorCatalog | null
  initialWeekId?: string | null
  /** Restaure le jour ouvert après redirect (meta / composition). */
  initialDay?: number | null
  /** Message discret dans la barre du haut (ex. composition enregistrée). */
  softFlash?: string | null
  /** admin = catalogue Trainly · coach = programme coach (pas de Publier Trainly). */
  variant?: 'admin' | 'coach'
  basePath?: string
  backHref?: string
  /** Preview catalogue Krid : board lecture seule + CTA → Brouillon. */
  readOnly?: boolean
}) {
  const isCoachVariant = variant === 'coach'
  const listHref = backHref ?? (isCoachVariant ? '/programs/brouillon' : '/admin/programs')
  const [weeksLive, setWeeksLive] = useState<AdminProgramWeek[] | null>(null)
  const weeks = useMemo(() => {
    const base = weeksLive ?? program.weeks
    return [...base].sort((a, b) => a.week_order - b.week_order)
  }, [weeksLive, program.weeks])
  const [openWeekId, setOpenWeekId] = useState<string | null>(() => {
    if (initialWeekId && program.weeks.some((w) => w.id === initialWeekId)) return initialWeekId
    return program.weeks[0]?.id ?? null
  })
  const [infosOpen, setInfosOpen] = useState(false)
  const [infosSaving, setInfosSaving] = useState(false)
  const [infosError, setInfosError] = useState<string | null>(null)
  const [infosCoverPreview, setInfosCoverPreview] = useState<string | null>(null)
  const [infosLive, setInfosLive] = useState<{
    title: string
    description: string | null
    goal: string | null
    level: string | null
    image_url: string | null
  } | null>(null)
  /** null = suit weeks.length ; string = édition locale avant Appliquer. */

  useEffect(() => {
    return () => {
      if (infosCoverPreview?.startsWith('blob:')) URL.revokeObjectURL(infosCoverPreview)
    }
  }, [infosCoverPreview])
  const [weekRename, setWeekRename] = useState<{
    weekId: string
    title: string
  } | null>(null)
  const [weekRenameDraft, setWeekRenameDraft] = useState('')
  const [focusedDay, setFocusedDay] = useState(() =>
    initialDay != null && initialDay >= 0 ? initialDay : 0,
  )
  const [catalogOpen, setCatalogOpen] = useState(
    () => !readOnly && initialDay != null && initialDay >= 0,
  )
  const [expandedOpenSessionId, setExpandedOpenSessionId] = useState<string | null>(null)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  const [weekMenuOpen, setWeekMenuOpen] = useState(false)
  const weekMenuRef = useRef<HTMLDivElement>(null)
  const isPhoneLayout = useBuilderPhoneLayout()
  const { collapse: collapseSidebar } = useSidebarCollapsed(
    isCoachVariant ? 'trainly.coach.sidebar.collapsed' : 'trainly.admin.sidebar.collapsed',
  )

  useEffect(() => {
    if (isPhoneLayout) collapseSidebar()
  }, [isPhoneLayout, collapseSidebar])

  useEffect(() => {
    if (!catalogOpen) setExpandedOpenSessionId(null)
  }, [catalogOpen])

  useEffect(() => {
    if (!headerMenuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setHeaderMenuOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      const el = headerMenuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setHeaderMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [headerMenuOpen])

  useEffect(() => {
    if (!weekMenuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setWeekMenuOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      const el = weekMenuRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setWeekMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [weekMenuOpen])

  useEffect(() => {
    if (!isPhoneLayout) setWeekMenuOpen(false)
  }, [isPhoneLayout])
  const [pending, setPending] = useState(false)
  const [createDay, setCreateDay] = useState<number | null>(null)
  const [localSoftFlash, setLocalSoftFlash] = useState<string | null>(null)
  const compositionApiRef = useRef<BuilderCompositionApi | null>(null)
  /** Invalide close/open/switch concurrents (clic semaines + click-outside). */
  const dayNavGenRef = useRef(0)
  const registerCompositionApi = useCallback((api: BuilderCompositionApi | null) => {
    compositionApiRef.current = api
  }, [])
  const router = useRouter()
  /** Patches meta séance (sans refresh RSC). */
  const [sessionMetaPatch, setSessionMetaPatch] = useState<
    Record<
      string,
      {
        title?: string | null
        notes?: string | null
        objective_ressenti?: boolean
        objective_note?: boolean
        objective_difficulty?: boolean
      }
    >
  >({})
  /** Composition live (drop / flush) — évite d’attendre le RSC 3–14s. */
  const [compositionLive, setCompositionLive] = useState<
    Record<
      string,
      {
        items: BuilderSession['items']
        compositionSlots: NonNullable<BuilderSession['compositionSlots']>
        item_count: number
        composition_version?: number
      }
    >
  >({})
  const [pendingLabel, setPendingLabel] = useState('Sauvegarde…')
  /** Séances créées par drop (pas encore dans program.sessions SSR). */
  const [liveExtraSessions, setLiveExtraSessions] = useState<BuilderSession[]>([])
  const [sessionOrderPatch, setSessionOrderPatch] = useState<Record<string, number>>({})
  const [removedSessionIds, setRemovedSessionIds] = useState<string[]>([])
  /** Versions quiet — survivent au wipe compositionLive (évite stale expected_version). */
  const [versionPatch, setVersionPatch] = useState<Record<string, number>>({})
  const [weekDeleteConfirm, setWeekDeleteConfirm] = useState<{
    weekId: string
    title: string
  } | null>(null)
  /** Overlay mode après convert (jusqu’au catch-up SSR). */
  const [isCalendarLive, setIsCalendarLive] = useState<boolean | null>(null)
  const [joursConvertOpen, setJoursConvertOpen] = useState(false)
  const [calendarConvertOpen, setCalendarConvertOpen] = useState(false)
  const [calendarStartDay, setCalendarStartDay] = useState(0)
  const isCalendar = isCalendarLive ?? program.is_calendar
  /** Catalogue palette live après Publier admin (avant catch-up SSR). */
  const [blocksLive, setBlocksLive] = useState<PaletteBlockItem[]>([])
  const [sessionsLive, setSessionsLive] = useState<PaletteSessionItem[]>([])

  useEffect(() => {
    if (isCalendarLive == null) return
    if (program.is_calendar === isCalendarLive) setIsCalendarLive(null)
  }, [program.is_calendar, isCalendarLive])

  useEffect(() => {
    const ssrIds = new Set(catalogBlocks.map((b) => b.id))
    setBlocksLive((prev) => prev.filter((b) => !ssrIds.has(b.id)))
  }, [catalogBlocks])

  useEffect(() => {
    const ssrIds = new Set(catalogSessions.map((s) => s.id))
    setSessionsLive((prev) => prev.filter((s) => !ssrIds.has(s.id)))
  }, [catalogSessions])

  const paletteBlocks = useMemo(() => {
    const byId = new Map(catalogBlocks.map((b) => [b.id, b] as const))
    for (const b of blocksLive) byId.set(b.id, b)
    return [...byId.values()]
  }, [catalogBlocks, blocksLive])

  const paletteSessions = useMemo(() => {
    const byId = new Map(catalogSessions.map((s) => [s.id, s] as const))
    for (const s of sessionsLive) byId.set(s.id, s)
    return [...byId.values()]
  }, [catalogSessions, sessionsLive])

  function upsertCatalogBlock(block: PaletteBlockItem) {
    setBlocksLive((prev) => {
      const next = prev.filter((b) => b.id !== block.id)
      return [...next, block]
    })
  }

  function upsertCatalogSession(session: PaletteSessionItem) {
    setSessionsLive((prev) => {
      const next = prev.filter((s) => s.id !== session.id)
      return [...next, session]
    })
  }

  useEffect(() => {
    // Quand le SSR rattrape, on drop les overlays déjà présents côté programme.
    // Ne pas wipe liveExtraSessions entier (duplicate semaine injecte les séances ici).
    setLiveExtraSessions((prev) =>
      prev.filter((s) => !program.sessions.some((p) => p.id === s.id)),
    )
    // session_order : ne clear que les ids dont le SSR a le même ordre (évite flash reorder).
    setSessionOrderPatch((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [id, order] of Object.entries(prev)) {
        const ssr = program.sessions.find((s) => s.id === id)?.session_order
        if (ssr === order) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    // compositionLive : drop seulement si version live définie ET SSR ≥.
    // Ne pas supprimer si session absente du SSR mais encore dans liveExtraSessions.
    const extraIds = new Set(liveExtraSessions.map((s) => s.id))
    setCompositionLive((prev) => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(prev)) {
        const ssr = program.sessions.find((s) => s.id === id)
        if (!ssr) {
          if (extraIds.has(id)) continue
          delete next[id]
          changed = true
          continue
        }
        const liveVer = prev[id]?.composition_version
        const ssrVer = ssr.composition_version ?? 0
        if (liveVer == null) continue
        if (ssrVer >= liveVer) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    setRemovedSessionIds((prev) => {
      if (!prev.length) return prev
      const stillGone = prev.filter((id) => !program.sessions.some((s) => s.id === id))
      return stillGone.length === prev.length ? prev : stillGone
    })
    // sessionMetaPatch : drop si SSR deep-equal.
    setSessionMetaPatch((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [id, patch] of Object.entries(prev)) {
        const ssr = program.sessions.find((s) => s.id === id)
        if (!ssr) {
          delete next[id]
          changed = true
          continue
        }
        const same =
          (patch.title === undefined || patch.title === ssr.title) &&
          (patch.notes === undefined || patch.notes === ssr.notes) &&
          (patch.objective_ressenti === undefined ||
            patch.objective_ressenti === (ssr.objective_ressenti !== false)) &&
          (patch.objective_note === undefined ||
            patch.objective_note === (ssr.objective_note !== false)) &&
          (patch.objective_difficulty === undefined ||
            patch.objective_difficulty === (ssr.objective_difficulty !== false))
        if (same) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
    // versionPatch : ne clear que si SSR a rattrapé (≥).
    setVersionPatch((prev) => {
      const next: Record<string, number> = {}
      for (const [id, v] of Object.entries(prev)) {
        const ssr = program.sessions.find((s) => s.id === id)?.composition_version ?? 0
        if (v > ssr) next[id] = v
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync overlays on SSR catch-up only
  }, [program.sessions])

  useEffect(() => {
    // Drop overlay seulement si le SSR a rattrapé ids + ordre (week_order).
    // Sinon un DnD (mêmes ids, nouvel ordre) était immédiatement écrasé par l’ancien SSR.
    if (!weeksLive) return
    const liveSorted = [...weeksLive].sort((a, b) => a.week_order - b.week_order)
    const ssrSorted = [...program.weeks].sort((a, b) => a.week_order - b.week_order)
    if (liveSorted.length !== ssrSorted.length) return
    for (let i = 0; i < liveSorted.length; i++) {
      if (liveSorted[i]!.id !== ssrSorted[i]!.id) return
      if (liveSorted[i]!.week_order !== ssrSorted[i]!.week_order) return
    }
    setWeeksLive(null)
  }, [program.weeks, weeksLive])

  function applyWeekBoardPatch(board: WeekBoardPatch) {
    setWeeksLive(board.weeks)
    if (board.openWeekId) {
      setOpenWeekId(board.openWeekId)
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('week', board.openWeekId)
        url.searchParams.delete('day')
        window.history.replaceState(null, '', `${url.pathname}${url.search}`)
      }
    }
    setCatalogOpen(false)
    setFocusedDay(0)
    const keepWeekIds = new Set(board.weeks.map((w) => w.id))
    const weekIdBySession = new Map<string, string>()
    for (const s of program.sessions) weekIdBySession.set(s.id, s.week_id)
    for (const s of liveExtraSessions) weekIdBySession.set(s.id, s.week_id)
    for (const s of board.weekSessions ?? []) weekIdBySession.set(s.id, s.week_id)

    const dropDeadOverlays = <T,>(
      prev: Record<string, T>,
    ): Record<string, T> | null => {
      let changed = false
      const next = { ...prev }
      for (const id of Object.keys(prev)) {
        const weekId = weekIdBySession.get(id)
        if (weekId && !keepWeekIds.has(weekId)) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : null
    }

    // Purge overlays des semaines disparues (delete / sync réduction).
    setLiveExtraSessions((prev) => {
      let next = prev.filter((s) => keepWeekIds.has(s.week_id))
      if (board.weekSessions?.length) {
        const byId = new Map(next.map((s) => [s.id, s]))
        for (const s of board.weekSessions) {
          byId.set(s.id, {
            id: s.id,
            week_id: s.week_id,
            title: s.title,
            session_order: s.session_order,
            notes: s.notes,
            objective_ressenti: s.objective_ressenti,
            objective_note: s.objective_note,
            objective_difficulty: s.objective_difficulty,
            composition_version: s.composition_version,
            item_count: s.item_count,
            items: s.items,
            compositionSlots: s.compositionSlots,
          })
        }
        next = [...byId.values()]
      }
      return next
    })
    setCompositionLive((prev) => dropDeadOverlays(prev) ?? prev)
    setSessionMetaPatch((prev) => dropDeadOverlays(prev) ?? prev)
    setVersionPatch((prev) => dropDeadOverlays(prev) ?? prev)
    setSessionOrderPatch((prev) => {
      const pruned = dropDeadOverlays(prev)
      const next = { ...(pruned ?? prev) }
      let changed = pruned != null
      for (const o of board.sessionOrders ?? []) {
        if (next[o.id] !== o.session_order) {
          next[o.id] = o.session_order
          changed = true
        }
      }
      for (const s of board.weekSessions ?? []) {
        if (next[s.id] !== s.session_order) {
          next[s.id] = s.session_order
          changed = true
        }
      }
      return changed ? next : prev
    })
    setRemovedSessionIds((prev) => {
      if (!prev.length) return prev
      if (!board.weekSessions?.length) return prev
      const weekSessionIds = new Set(board.weekSessions.map((s) => s.id))
      return prev.filter((id) => !weekSessionIds.has(id))
    })
  }

  async function runWeekQuiet(
    label: string,
    fn: () => Promise<WeekQuietResult>,
  ) {
    if (pending) return
    setPendingLabel(label)
    setPending(true)
    try {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) return // alert déjà dans DayBoard.flush
      const res = await fn()
      if (!res.ok) {
        alertError(res.error)
        return
      }
      applyWeekBoardPatch(res.board)
      if (res.flash) setLocalSoftFlash(res.flash)
      // SSR catch-up (semaines / ordres) — overlays restent jusqu’à match.
      if (res.refresh) router.refresh()
    } finally {
      setPending(false)
    }
  }

  /** Ajoute une semaine vide en fin de programme et l’ouvre. */
  function addEmptyWeek() {
    if (pending || weeks.length >= 52) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    if (openWeek) fd.set('week_id', openWeek.id)
    fd.set('week_count', String(weeks.length + 1))
    void runWeekQuiet('Ajout semaine…', async () => {
      const res = await syncTrainlyProgramWeekCountQuietAction(fd)
      if (!res.ok) return res
      const last = res.board.weeks[res.board.weeks.length - 1]
      return {
        ...res,
        flash: 'Semaine ajoutée',
        board: {
          ...res.board,
          openWeekId: last?.id ?? res.board.openWeekId,
        },
      }
    })
  }

  /** DnD pills — optimistic weeksLive ; à la fin, ouvre la semaine déplacée. */
  async function reorderWeeks(orderedWeekIds: string[], draggedWeekId: string) {
    if (pending || orderedWeekIds.length < 2) return
    const byId = new Map(weeks.map((w) => [w.id, w]))
    if (orderedWeekIds.some((id) => !byId.has(id))) return
    if (!byId.has(draggedWeekId)) return
    const prev = weeks
    const optimistic = orderedWeekIds.map((id, i) => ({
      ...byId.get(id)!,
      week_order: i,
    }))
    setWeeksLive(optimistic)
    setPendingLabel('Réordonnancement…')
    setPending(true)
    try {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) {
        setWeeksLive(prev)
        return
      }
      const fd = new FormData()
      fd.set('program_id', program.id)
      fd.set('week_id', draggedWeekId)
      fd.set('ordered_week_ids', JSON.stringify(orderedWeekIds))
      const res = await reorderTrainlyProgramWeeksQuietAction(fd)
      if (!res.ok) {
        alertError(res.error)
        setWeeksLive(prev)
        return
      }
      setWeeksLive(res.board.weeks)
      // Semaine déplacée = sélectionnée (même si elle ne l’était pas avant).
      if (draggedWeekId !== openWeekId) {
        setOpenWeekId(draggedWeekId)
      }
    } finally {
      setPending(false)
    }
  }

  // openWeekId = client SoT après mount. Ne jamais réappliquer initialWeekId
  // (sinon bounce S2→S1 dès que weeksLive/SSR change).
  useEffect(() => {
    if (openWeekId && weeks.some((w) => w.id === openWeekId)) return
    setOpenWeekId(weeks[0]?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks])

  useEffect(() => {
    setCreateDay(null)
  }, [weeks.length])

  const weekSwitchSkip = useRef(true)
  useEffect(() => {
    if (weekSwitchSkip.current) {
      weekSwitchSkip.current = false
      return
    }
    setFocusedDay(0)
    setCatalogOpen(false)
    setCreateDay(null)
    if (typeof window !== 'undefined' && openWeekId) {
      const url = new URL(window.location.href)
      url.searchParams.set('week', openWeekId)
      url.searchParams.delete('day')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    }
  }, [openWeekId])

  useEffect(() => {
    if (!localSoftFlash) return
    const t = window.setTimeout(() => setLocalSoftFlash(null), 2200)
    return () => window.clearTimeout(t)
  }, [localSoftFlash])

  // Soft flash SSR (?ok=) → local + strip URL (évite flash permanent au refresh).
  useEffect(() => {
    if (!softFlash) return
    setLocalSoftFlash(softFlash)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (!url.searchParams.has('ok')) return
    url.searchParams.delete('ok')
    const qs = url.searchParams.toString()
    window.history.replaceState(null, '', qs ? `${url.pathname}?${qs}` : url.pathname)
  }, [softFlash])

  useEffect(() => {
    if (!catalogOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      if (infosOpen) {
        setInfosOpen(false)
        return
      }
      // Ne pas refermer le jour si une modale (infos séance) est ouverte.
      if (document.querySelector('[role="dialog"]')) return
      void closeDayView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogOpen, infosOpen])

  function syncDayInUrl(day: number | null) {
    if (typeof window === 'undefined' || !openWeekId) return
    const url = new URL(window.location.href)
    url.searchParams.set('week', openWeekId)
    if (day != null && day >= 0) url.searchParams.set('day', String(day))
    else url.searchParams.delete('day')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  async function flushCompositionsIfNeeded(): Promise<
    { ok: true; saved: boolean } | { ok: false }
  > {
    const flush = compositionApiRef.current?.flush
    if (!flush) return { ok: true, saved: false }
    const res = await flush()
    if (!res.ok) return { ok: false }
    return { ok: true, saved: res.saved }
  }

  async function closeDayView() {
    if (pending) return
    const gen = ++dayNavGenRef.current
    const needsSave = compositionApiRef.current?.hasDirty() ?? false
    if (needsSave) {
      setPendingLabel('Sauvegarde…')
      setPending(true)
    }
    try {
      const res = await flushCompositionsIfNeeded()
      if (!res.ok) return
      // Une nav plus récente (switch semaine / openDay) a pris le relais.
      if (dayNavGenRef.current !== gen) return
      setCatalogOpen(false)
      syncDayInUrl(null)
      if (res.saved) setLocalSoftFlash('Séance enregistrée')
    } finally {
      if (needsSave && dayNavGenRef.current === gen) setPending(false)
    }
  }

  function contentItemCount(items: BuilderSession['items']) {
    return items.filter((it) => it.kind !== 'rest').length
  }

  function applyAppendPatch(append: CompositionAppendPatch) {
    setCompositionLive((prev) => {
      const fromProgram = program.sessions.find((s) => s.id === append.sessionId)
      const fromExtra = liveExtraSessions.find((s) => s.id === append.sessionId)
      const base = prev[append.sessionId] ?? {
        items: fromProgram?.items ?? fromExtra?.items ?? [],
        compositionSlots: fromProgram?.compositionSlots ?? fromExtra?.compositionSlots ?? [],
        item_count: fromProgram?.item_count ?? fromExtra?.item_count ?? 0,
        composition_version:
          fromProgram?.composition_version ?? fromExtra?.composition_version ?? 0,
      }
      const items = [...base.items, append.item]
      const compositionSlots = [...(base.compositionSlots ?? []), append.slot]
      return {
        ...prev,
        [append.sessionId]: {
          items,
          compositionSlots,
          item_count: contentItemCount(items),
          composition_version:
            append.composition_version ?? base.composition_version,
        },
      }
    })
    if (append.composition_version != null) {
      setVersionPatch((prev) => ({
        ...prev,
        [append.sessionId]: append.composition_version!,
      }))
    }

    if (append.createdSession) {
      const created = append.createdSession
      setLiveExtraSessions((prev) => {
        if (
          prev.some((s) => s.id === created.id) ||
          program.sessions.some((s) => s.id === created.id)
        ) {
          return prev
        }
        return [
          ...prev,
          {
            id: created.id,
            week_id: created.week_id,
            title: created.title,
            session_order: created.session_order,
            item_count: 1,
            items: [append.item],
            compositionSlots: [append.slot],
            composition_version: append.composition_version ?? 0,
          },
        ]
      })
    }
  }

  function applyBoardPatch(board: BoardMutationPatch) {
    if (board.deletedSessionIds?.length) {
      const gone = new Set(board.deletedSessionIds)
      setRemovedSessionIds((prev) => [...new Set([...prev, ...board.deletedSessionIds!])])
      setLiveExtraSessions((prev) => prev.filter((s) => !gone.has(s.id)))
      setCompositionLive((prev) => {
        const next = { ...prev }
        for (const id of gone) delete next[id]
        return next
      })
    }
    if (board.sessionOrders?.length) {
      setSessionOrderPatch((prev) => {
        const next = { ...prev }
        for (const o of board.sessionOrders!) next[o.id] = o.session_order
        return next
      })
    }
    if (board.upsertSession) {
      const created = board.upsertSession
      setRemovedSessionIds((prev) => prev.filter((id) => id !== created.id))
      setLiveExtraSessions((prev) => {
        const nextSession = {
          id: created.id,
          week_id: created.week_id,
          title: created.title,
          session_order: created.session_order,
          notes: created.notes ?? null,
          objective_ressenti: created.objective_ressenti !== false,
          objective_note: created.objective_note !== false,
          objective_difficulty: created.objective_difficulty !== false,
          item_count: created.item_count,
          composition_version: created.composition_version,
          items: created.items,
          compositionSlots: created.compositionSlots,
        }
        if (prev.some((s) => s.id === created.id) || program.sessions.some((s) => s.id === created.id)) {
          return prev.map((s) => (s.id === created.id ? { ...s, ...nextSession } : s))
        }
        return [...prev, nextSession]
      })
      if (
        created.notes != null ||
        created.objective_ressenti != null ||
        created.objective_note != null ||
        created.objective_difficulty != null
      ) {
        setSessionMetaPatch((prev) => ({
          ...prev,
          [created.id]: {
            title: created.title,
            notes: created.notes ?? null,
            objective_ressenti: created.objective_ressenti !== false,
            objective_note: created.objective_note !== false,
            objective_difficulty: created.objective_difficulty !== false,
          },
        }))
      }
      setCompositionLive((prev) => ({
        ...prev,
        [created.id]: {
          items: created.items,
          compositionSlots: created.compositionSlots,
          item_count: created.item_count,
          composition_version: created.composition_version,
        },
      }))
      if (created.composition_version != null) {
        setVersionPatch((prev) => ({ ...prev, [created.id]: created.composition_version! }))
      }
    }
  }

  async function openDay(day: number): Promise<boolean> {
    if (pending) return false
    const gen = ++dayNavGenRef.current
    if (catalogOpen && day !== focusedDay) {
      setPendingLabel('Sauvegarde…')
      setPending(true)
      try {
        const res = await flushCompositionsIfNeeded()
        if (!res.ok) return false
      } finally {
        if (dayNavGenRef.current === gen) setPending(false)
      }
    }
    if (dayNavGenRef.current !== gen) return false
    collapseSidebar()
    setFocusedDay(day)
    setCatalogOpen(true)
    syncDayInUrl(day)
    return true
  }

  async function switchWeek(weekId: string) {
    if (weekId === openWeekId) return
    if (pending) return
    const gen = ++dayNavGenRef.current
    setWeekMenuOpen(false)
    if (catalogOpen) {
      setPendingLabel('Sauvegarde…')
      setPending(true)
      try {
        const res = await flushCompositionsIfNeeded()
        if (!res.ok) return
      } finally {
        if (dayNavGenRef.current === gen) setPending(false)
      }
    }
    if (dayNavGenRef.current !== gen) return
    setOpenWeekId(weekId)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('week', weekId)
      url.searchParams.delete('day')
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
    }
  }

  const openIndex = weeks.findIndex((w) => w.id === openWeekId)
  const openWeek = (openIndex >= 0 ? weeks[openIndex] : weeks[0]) ?? null
  const prevWeek = openIndex > 0 ? weeks[openIndex - 1] : null
  const nextWeek = openIndex >= 0 && openIndex < weeks.length - 1 ? weeks[openIndex + 1] : null
  const isPublished = program.catalog_status === 'published'
  const returnTo = openWeek
    ? weekHref(basePath, program.id, openWeek.id)
    : `${basePath}/${program.id}`
  const displayTitle = infosLive?.title ?? program.title
  const displayDescription = infosLive?.description ?? program.description
  const displayGoal = infosLive?.goal ?? program.goal
  const displayLevel = infosLive?.level ?? program.level
  const displayDuration =
    durationLabelFromWeekCount(weeks.length) ?? program.duration
  const displayImageUrl =
    infosCoverPreview ?? infosLive?.image_url ?? program.image_url
  const canDeleteWeek = weeks.length > 1

  const weekSessions = useMemo(() => {
    const removed = new Set(removedSessionIds)
    const byId = new Map<string, BuilderSession>()
    for (const s of program.sessions) {
      if (s.week_id !== openWeek?.id) continue
      if (removed.has(s.id)) continue
      byId.set(s.id, s)
    }
    for (const s of liveExtraSessions) {
      if (s.week_id !== openWeek?.id) continue
      if (removed.has(s.id)) continue
      if (!byId.has(s.id)) byId.set(s.id, s)
    }
    return [...byId.values()]
      .slice()
      .map((s) => {
        const meta = sessionMetaPatch[s.id]
        const live = compositionLive[s.id]
        const order = sessionOrderPatch[s.id]
        const version = versionPatch[s.id]
        return {
          ...s,
          ...(order != null ? { session_order: order } : {}),
          ...(meta ?? {}),
          ...(live ?? {}),
          ...(version != null ? { composition_version: version } : {}),
        }
      })
      .sort((a, b) => a.session_order - b.session_order)
  }, [
    program.sessions,
    openWeek?.id,
    sessionMetaPatch,
    compositionLive,
    liveExtraSessions,
    sessionOrderPatch,
    removedSessionIds,
    versionPatch,
  ])

  const targetLabel = isCalendar
    ? (['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const)[
        Math.min(Math.max(focusedDay, 0), 6)
      ]
    : `Jour ${focusedDay + 1}`

  const visibleSessionsForConvert = useMemo(() => {
    const removed = new Set(removedSessionIds)
    const byId = new Map<string, { week_id: string; id: string; session_order: number }>()
    for (const s of program.sessions) {
      if (removed.has(s.id)) continue
      byId.set(s.id, {
        id: s.id,
        week_id: s.week_id,
        session_order: sessionOrderPatch[s.id] ?? s.session_order,
      })
    }
    for (const s of liveExtraSessions) {
      if (removed.has(s.id)) continue
      byId.set(s.id, {
        id: s.id,
        week_id: s.week_id,
        session_order: sessionOrderPatch[s.id] ?? s.session_order,
      })
    }
    return [...byId.values()]
  }, [program.sessions, liveExtraSessions, removedSessionIds, sessionOrderPatch])

  const joursConvertDeleteCount = useMemo(() => {
    if (!isCalendar) return 0
    return countSundaySessionsToDeleteOnSlotsConvert(visibleSessionsForConvert)
  }, [isCalendar, visibleSessionsForConvert])

  const calendarConvertDeleteDayCount = useMemo(() => {
    if (isCalendar) return 0
    return countDaysDeletedOnCalendarConvert(visibleSessionsForConvert, calendarStartDay)
  }, [isCalendar, visibleSessionsForConvert, calendarStartDay])

  async function removeSlotDay(day: number): Promise<boolean> {
    if (pending || isCalendar || !openWeekId) return false
    setPendingLabel('Retrait…')
    setPending(true)
    try {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) return false
      const fd = new FormData()
      fd.set('program_id', program.id)
      fd.set('week_id', openWeekId)
      fd.set('day', String(day))
      const res = await removeTrainlyProgramSlotDayQuietAction(fd)
      if (!res.ok) {
        alertError(res.error)
        return false
      }
      applyBoardPatch(res.board)
      if (focusedDay > day) {
        const next = focusedDay - 1
        setFocusedDay(next)
        syncDayInUrl(next)
      } else if (focusedDay === day) {
        const next = Math.max(0, day)
        setFocusedDay(next)
        syncDayInUrl(next)
      }
      if (res.flash) setLocalSoftFlash(res.flash)
      return true
    } finally {
      setPending(false)
    }
  }

  async function runConvertToJours() {
    if (pending || !isCalendar) return
    setPendingLabel('Conversion…')
    setPending(true)
    try {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) return
      const fd = new FormData()
      fd.set('program_id', program.id)
      if (openWeekId) fd.set('week_id', openWeekId)
      const res = await convertTrainlyProgramToSlotsQuietAction(fd)
      if (!res.ok) {
        alertError(res.error)
        return
      }
      setIsCalendarLive(false)
      setJoursConvertOpen(false)
      setFocusedDay(0)
      setCatalogOpen(false)
      applyWeekBoardPatch(res.board)
      if (res.board.deletedSessionIds?.length) {
        setRemovedSessionIds((prev) => [
          ...new Set([...prev, ...res.board.deletedSessionIds!]),
        ])
      }
      if (res.flash) setLocalSoftFlash(res.flash)
      // Pas de router.refresh — overlays jusqu’au catch-up SSR.
    } finally {
      setPending(false)
    }
  }

  async function runConvertToCalendar() {
    if (pending || isCalendar) return
    setPendingLabel('Conversion…')
    setPending(true)
    try {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) return
      const fd = new FormData()
      fd.set('program_id', program.id)
      if (openWeekId) fd.set('week_id', openWeekId)
      fd.set('start_day', String(calendarStartDay))
      const res = await convertTrainlyProgramToCalendarQuietAction(fd)
      if (!res.ok) {
        alertError(res.error)
        return
      }
      setIsCalendarLive(true)
      setCalendarConvertOpen(false)
      setCatalogOpen(false)
      applyWeekBoardPatch(res.board)
      if (res.board.deletedSessionIds?.length) {
        setRemovedSessionIds((prev) => [
          ...new Set([...prev, ...res.board.deletedSessionIds!]),
        ])
      }
      setFocusedDay(calendarStartDay)
      if (res.flash) setLocalSoftFlash(res.flash)
    } finally {
      setPending(false)
    }
  }

  function runAction(fn: () => Promise<void>) {
    if (pending) return
    setPending(true)
    void fn().finally(() => setPending(false))
  }

  /** Flush compositions dirty puis mutation quiet — garde le jour ouvert. */
  function runActionAfterFlush(fn: () => Promise<QuietMutationResult>, flash?: string) {
    if (pending) return
    setPendingLabel('Sauvegarde…')
    setPending(true)
    void (async () => {
      const flushed = await flushCompositionsIfNeeded()
      if (!flushed.ok) return // alert déjà dans DayBoard.flush
      const res = await fn()
      if (!res.ok) {
        alertError(res.error)
        return
      }
      if (flash) setLocalSoftFlash(flash)
      if (res.append) applyAppendPatch(res.append)
      if (res.board) applyBoardPatch(res.board)
      // Ouvrir le jour seulement pour un append (édition) — pas move/delete en vue compacte.
      if (res.append && res.day != null && res.day >= 0) {
        setFocusedDay(res.day)
        setCatalogOpen(true)
        syncDayInUrl(res.day)
      } else if (res.board && catalogOpen && res.day != null && res.day >= 0) {
        setFocusedDay(res.day)
        syncDayInUrl(res.day)
      }
      if (res.append || res.board) return
      router.refresh()
    })().finally(() => setPending(false))
  }

  function addLibrarySession(libraryId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('library_session_id', libraryId)
    fd.set('target_order', String(day))
    fd.set('day', String(day))
    if (intoSessionId) fd.set('into_session_id', intoSessionId)
    runActionAfterFlush(() => addTrainlyLibrarySessionAction(fd), 'Séance catalogue ajoutée')
  }

  /** Séance cible pour drop/catalogue quand le jour est ouvert. */
  function resolveIntoSessionId(day: number, intoSessionId?: string): string | undefined {
    if (intoSessionId) return intoSessionId
    if (!catalogOpen) return undefined
    const onDay = weekSessions.filter(
      (s) => decodeDaySessionOrder(s.session_order).day === day,
    )
    if (onDay.length === 1) return onDay[0]!.id
    // Multi-séances : dernière séance activée (clic / drop) dans le jour.
    if (
      expandedOpenSessionId &&
      onDay.some((s) => s.id === expandedOpenSessionId)
    ) {
      return expandedOpenSessionId
    }
    return onDay[0]?.id
  }

  function addLibraryBlock(blockId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const targetId = resolveIntoSessionId(day, intoSessionId)
    if (
      targetId &&
      compositionApiRef.current?.appendToOpenSession(targetId, 'block', blockId)
    ) {
      setLocalSoftFlash('Bloc ajouté')
      return
    }
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('block_id', blockId)
    fd.set('target_order', String(day))
    fd.set('day', String(day))
    if (targetId) fd.set('session_id', targetId)
    runActionAfterFlush(() => appendLibraryBlockToProgramAction(fd), 'Bloc ajouté')
  }

  function addLibraryExercise(exerciseId: string, day = focusedDay, intoSessionId?: string) {
    if (!openWeek) return
    const targetId = resolveIntoSessionId(day, intoSessionId)
    if (
      targetId &&
      compositionApiRef.current?.appendToOpenSession(targetId, 'exercise', exerciseId)
    ) {
      setLocalSoftFlash('Exercice ajouté')
      return
    }
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('exercise_id', exerciseId)
    fd.set('target_order', String(day))
    fd.set('day', String(day))
    if (targetId) fd.set('session_id', targetId)
    runActionAfterFlush(() => appendLibraryExerciseToProgramAction(fd), 'Exercice ajouté')
  }

  function moveSession(sessionId: string, day: number) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('session_id', sessionId)
    fd.set('target_order', String(day))
    fd.set('day', String(day))
    runActionAfterFlush(() => moveTrainlyProgramSessionAction(fd), 'Séance déplacée')
  }

  function deleteSession(sessionId: string, day: number) {
    if (!openWeek) return
    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('session_id', sessionId)
    fd.set('day', String(day))
    runActionAfterFlush(() => deleteTrainlyProgramSessionAction(fd), 'Séance retirée')
  }

  function reorderSessionInDay(sessionId: string, day: number, direction: -1 | 1) {
    if (!openWeek || pending) return
    const onDay = weekSessions
      .filter((s) => decodeDaySessionOrder(s.session_order).day === day)
      .slice()
      .sort((a, b) => a.session_order - b.session_order)
    const idx = onDay.findIndex((s) => s.id === sessionId)
    const swapIdx = idx + direction
    if (idx < 0 || swapIdx < 0 || swapIdx >= onDay.length) return

    const reordered = onDay.slice()
    const tmp = reordered[idx]!
    reordered[idx] = reordered[swapIdx]!
    reordered[swapIdx] = tmp
    const orders = renumberDayOrders(
      day,
      reordered.map((s) => ({ id: s.id })),
    )

    // Optimistic — visible tout de suite (sans flush composition / overlay).
    setSessionOrderPatch((prev) => {
      const next = { ...prev }
      for (const o of orders) next[o.id] = o.session_order
      return next
    })

    const fd = new FormData()
    fd.set('program_id', program.id)
    fd.set('week_id', openWeek.id)
    fd.set('session_id', sessionId)
    fd.set('day', String(day))
    fd.set('direction', String(direction))
    void (async () => {
      const res = await reorderTrainlyProgramSessionInDayAction(fd)
      if (!res.ok) {
        // Rollback : drop les orders optimistes de ce jour.
        setSessionOrderPatch((prev) => {
          const next = { ...prev }
          for (const o of orders) delete next[o.id]
          return next
        })
        alertError(res.error)
        return
      }
      if (res.board?.sessionOrders?.length) {
        applyBoardPatch(res.board)
      }
    })()
  }

  /** Skip le preventDefault du onSubmit après flush (laisse passer l’action Next). */
  const bypassFlushSubmitRef = useRef(false)

  /** Submit form structurel (semaine / publish) après flush composition. */
  function onStructuralSubmit(e: FormEvent<HTMLFormElement>) {
    if (bypassFlushSubmitRef.current) {
      bypassFlushSubmitRef.current = false
      return
    }
    e.preventDefault()
    const form = e.currentTarget
    if (pending) return
    setPendingLabel('Sauvegarde…')
    setPending(true)
    void (async () => {
      const res = await flushCompositionsIfNeeded()
      if (!res.ok) {
        setPending(false)
        return
      }
      bypassFlushSubmitRef.current = true
      setPendingLabel('Publication…')
      form.requestSubmit()
      // Succès → navigation Next. Filet si l’action reste sur place.
      window.setTimeout(() => setPending(false), 4000)
    })().catch(() => setPending(false))
  }

  return (
    <div className="bg-da-canvas flex min-h-screen flex-col min-[1100px]:h-dvh min-[1100px]:max-h-dvh min-[1100px]:overflow-hidden">
      {/* Pas de data-builder-chrome : clic top bar / Infos ferme le mode jour. */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-2 px-3 md:px-4">
          <Link
            href={listHref}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
            aria-label="Retour"
          >
            <IconBack size={16} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-[color:var(--fg)]">
                {displayTitle?.trim() || 'Programme sans titre'}
              </h1>
              <span className="shrink-0 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                {readOnly ? 'Catalogue Krid' : statusLabel(program.catalog_status)}
              </span>
              {localSoftFlash ? (
                <span className="hidden truncate text-[10px] font-medium text-[var(--success)] sm:inline">
                  · {localSoftFlash}
                </span>
              ) : null}
            </div>
            <p className="truncate text-[10px] text-[color:var(--muted)]">
              {[displayLevel, displayDuration, isCalendar ? 'Calendrier' : 'Journées']
                .filter(Boolean)
                .join(' · ')}
              {localSoftFlash ? (
                <span className="text-[var(--success)] sm:hidden">
                  {' '}
                  · {localSoftFlash}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* Desktop / tablette : actions visibles */}
            {readOnly ? null : isCalendar ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!hidden !h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none min-[768px]:!inline-flex"
                disabled={pending}
                onClick={() => setJoursConvertOpen(true)}
              >
                Passer en journées
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!hidden !h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none min-[768px]:!inline-flex"
                disabled={pending}
                onClick={() => {
                  setCalendarStartDay(0)
                  setCalendarConvertOpen(true)
                }}
              >
                Passer en calendrier
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
              onClick={() => setInfosOpen((v) => !v)}
            >
              {infosOpen ? 'Masquer' : 'Infos'}
            </Button>
            {!isCoachVariant && !readOnly ? (
              <Button
                href={`${basePath}/${program.id}/preview`}
                size="sm"
                variant="secondary"
                className="!hidden !h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none min-[768px]:!inline-flex"
              >
                Rendu
              </Button>
            ) : null}
            {readOnly ? (
              <form action={forkKridProgramToDraftAction}>
                <input type="hidden" name="id" value={program.id} />
                <PendingFormButton
                  size="sm"
                  className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                  pendingLabel="Copie…"
                >
                  → Brouillon
                </PendingFormButton>
              </form>
            ) : isCoachVariant ? (
              program.is_client_instance ? null : isPublished ? (
                <form action={moveCoachProgramToDraftAction}>
                  <input type="hidden" name="id" value={program.id} />
                  <input type="hidden" name="from_builder" value="1" />
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                  >
                    → Brouillon
                  </Button>
                </form>
              ) : (
                <form action={publishCoachProgramAsTemplateAction}>
                  <input type="hidden" name="id" value={program.id} />
                  <ConfirmSubmitButton
                    size="sm"
                    className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                    confirmMessage="Enregistrer ce programme en template ?"
                    pendingLabel="Publication…"
                  >
                    → Template
                  </ConfirmSubmitButton>
                </form>
              )
            ) : isPublished ? (
              <form action={setProgramCatalogStatusAction} onSubmit={onStructuralSubmit}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="status" value="draft" />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                >
                  Dépublier
                </Button>
              </form>
            ) : (
              <form action={setProgramCatalogStatusAction} onSubmit={onStructuralSubmit}>
                <input type="hidden" name="id" value={program.id} />
                <input type="hidden" name="status" value="published" />
                <input type="hidden" name="return_to" value={returnTo} />
                <ConfirmSubmitButton
                  size="sm"
                  className="!h-7 !rounded-full !px-2.5 !py-0 !text-[11px] !leading-none"
                  confirmMessage="Publier ce programme dans le catalogue Krid ?"
                >
                  Publier
                </ConfirmSubmitButton>
              </form>
            )}
            {/* Téléphone : Passer en calendrier / Rendu dans ⋯ */}
            {!readOnly ? (
            <div ref={headerMenuRef} className="relative min-[768px]:hidden">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent)] text-[14px] font-bold leading-none text-[color:var(--fg)]"
                aria-label="Plus d’actions"
                aria-expanded={headerMenuOpen}
                onClick={() => setHeaderMenuOpen((v) => !v)}
              >
                ⋯
              </button>
              {headerMenuOpen ? (
                <div
                  data-builder-chrome=""
                  className="absolute right-0 top-full z-40 mt-1 min-w-[11rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-da-md"
                >
                  <button
                    type="button"
                    disabled={pending}
                    className="flex w-full px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
                    onClick={() => {
                      setHeaderMenuOpen(false)
                      if (isCalendar) setJoursConvertOpen(true)
                      else {
                        setCalendarStartDay(0)
                        setCalendarConvertOpen(true)
                      }
                    }}
                  >
                    {isCalendar ? 'Passer en journées' : 'Passer en calendrier'}
                  </button>
                  {!isCoachVariant ? (
                    <Link
                      href={`${basePath}/${program.id}/preview`}
                      className="flex w-full px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)]"
                      onClick={() => setHeaderMenuOpen(false)}
                    >
                      Rendu
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}
          </div>
        </div>
        {infosOpen ? (
          <div
            data-builder-chrome=""
            className="border-t border-[var(--border)] bg-[var(--surface)]"
          >
            {readOnly ? (
              <div className="mx-auto grid max-w-6xl gap-2 px-3 py-2.5 md:px-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm font-semibold text-[color:var(--fg)]">
                  {displayTitle?.trim() || 'Programme sans titre'}
                </p>
                {displayDescription?.trim() ? (
                  <p className="sm:col-span-2 text-sm text-[color:var(--muted)]">
                    {displayDescription.trim()}
                  </p>
                ) : null}
                {displayGoal?.trim() ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    <span className="font-semibold text-[color:var(--fg)]">Objectif · </span>
                    {displayGoal.trim()}
                  </p>
                ) : null}
                {displayLevel?.trim() ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    <span className="font-semibold text-[color:var(--fg)]">Niveau · </span>
                    {displayLevel.trim()}
                  </p>
                ) : null}
              </div>
            ) : (
            <form
              key={
                infosLive
                  ? `live-${infosLive.title}-${infosLive.level}-${infosLive.image_url ?? ''}`
                  : `ssr-${program.id}`
              }
              className={`mx-auto grid max-w-6xl px-3 md:px-4 ${
                isCoachVariant ? 'gap-2 py-2.5' : 'gap-3 py-4'
              }`}
              onSubmit={(e) => {
                e.preventDefault()
                if (infosSaving) return
                const fd = new FormData(e.currentTarget)
                fd.set('program_id', program.id)
                setInfosSaving(true)
                setInfosError(null)
                void (async () => {
                  try {
                    const res = await updateTrainlyProgramInfosQuietAction(fd)
                    if (!res.ok) {
                      setInfosError(res.error)
                      return
                    }
                    setInfosLive(res.patch)
                    if (infosCoverPreview?.startsWith('blob:')) {
                      URL.revokeObjectURL(infosCoverPreview)
                    }
                    setInfosCoverPreview(null)
                    setInfosOpen(false)
                    setLocalSoftFlash(res.flash)
                  } finally {
                    setInfosSaving(false)
                  }
                })()
              }}
            >
              {isCoachVariant ? (
                <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                  <label className="grid gap-0.5 sm:col-span-2">
                    <span className="text-[11px] font-semibold leading-none text-[color:var(--muted)]">
                      Nom *
                    </span>
                    <input
                      name="title"
                      required
                      defaultValue={displayTitle?.trim() || ''}
                      className={daFieldClass}
                    />
                  </label>
                  <label className="grid gap-0.5 sm:col-span-2">
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Description
                    </span>
                    <input
                      name="description"
                      defaultValue={displayDescription?.trim() || ''}
                      className={daFieldClass}
                      placeholder="Contexte, matériel, fréquence…"
                    />
                  </label>
                  <label className="grid gap-0.5">
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Objectif
                    </span>
                    <input
                      name="goal"
                      defaultValue={displayGoal?.trim() || ''}
                      className={daFieldClass}
                      placeholder="Hypertrophie, reprise…"
                    />
                  </label>
                  <label className="grid gap-0.5">
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Niveau *
                    </span>
                    <select
                      name="level"
                      required
                      defaultValue={displayLevel?.trim() || ''}
                      className={daSelectClass}
                    >
                      <option value="" disabled>
                        Choisir…
                      </option>
                      <option value="débutant">Débutant</option>
                      <option value="intermédiaire">Intermédiaire</option>
                      <option value="avancé">Avancé</option>
                    </select>
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-[13rem_1fr] md:items-stretch">
                  <label className="grid h-full grid-rows-[auto_1fr] gap-0.5">
                    <span className="text-[11px] font-semibold leading-none text-[color:var(--muted)]">
                      Photo
                    </span>
                    <span
                      className={`relative flex min-h-[11.5rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-dashed transition md:min-h-0 ${
                        displayImageUrl
                          ? 'border-[var(--border)] bg-[var(--page-bg)]'
                          : 'border-[var(--border)] bg-[var(--accent)]/35 hover:border-[var(--brand)] hover:bg-[var(--accent)]/55'
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const file = e.dataTransfer.files?.[0] ?? null
                        if (!file || !file.type.startsWith('image/')) return
                        if (infosCoverPreview?.startsWith('blob:')) {
                          URL.revokeObjectURL(infosCoverPreview)
                        }
                        setInfosCoverPreview(URL.createObjectURL(file))
                        const input = e.currentTarget.parentElement?.querySelector(
                          'input[type="file"]',
                        ) as HTMLInputElement | null
                        if (input) {
                          const dt = new DataTransfer()
                          dt.items.add(file)
                          input.files = dt.files
                        }
                      }}
                    >
                      {displayImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={displayImageUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <span
                        className={`relative z-[1] px-3 text-center text-[12px] font-semibold ${
                          displayImageUrl
                            ? 'rounded-full bg-[var(--surface)]/90 px-2.5 py-1 text-[color:var(--fg)] shadow-da-sm'
                            : 'text-[color:var(--muted)]'
                        }`}
                      >
                        {displayImageUrl ? 'Changer la photo' : 'Clique ou glisse une image'}
                      </span>
                      {!displayImageUrl ? (
                        <span className="relative z-[1] mt-1 text-[10px] text-[color:var(--muted)]">
                          JPG, PNG, WebP · max 5 Mo
                        </span>
                      ) : null}
                    </span>
                    <input
                      type="file"
                      name="coverImage"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null
                        if (infosCoverPreview?.startsWith('blob:')) {
                          URL.revokeObjectURL(infosCoverPreview)
                        }
                        if (!file) {
                          setInfosCoverPreview(null)
                          return
                        }
                        setInfosCoverPreview(URL.createObjectURL(file))
                      }}
                    />
                  </label>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <label className="grid gap-0.5 sm:col-span-2">
                      <span className="text-[11px] font-semibold leading-none text-[color:var(--muted)]">
                        Nom *
                      </span>
                      <input
                        name="title"
                        required
                        defaultValue={displayTitle?.trim() || ''}
                        className={daFieldClass}
                      />
                    </label>
                    <label className="grid gap-0.5 sm:col-span-2">
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Description
                      </span>
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={displayDescription?.trim() || ''}
                        className={daFieldClass}
                        placeholder="Contexte, matériel, fréquence…"
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Objectif
                      </span>
                      <input
                        name="goal"
                        defaultValue={displayGoal?.trim() || ''}
                        className={daFieldClass}
                        placeholder="Hypertrophie, reprise…"
                      />
                    </label>
                    <label className="grid gap-0.5">
                      <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                        Niveau *
                      </span>
                      <select
                        name="level"
                        required
                        defaultValue={displayLevel?.trim() || ''}
                        className={daSelectClass}
                      >
                        <option value="" disabled>
                          Choisir…
                        </option>
                        <option value="débutant">Débutant</option>
                        <option value="intermédiaire">Intermédiaire</option>
                        <option value="avancé">Avancé</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
              {infosError ? (
                <p className="text-[12px] font-semibold text-[var(--danger)]">{infosError}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="!h-7 !rounded-full !px-3 !text-[11px]"
                  disabled={infosSaving}
                  onClick={() => {
                    if (infosCoverPreview?.startsWith('blob:')) {
                      URL.revokeObjectURL(infosCoverPreview)
                    }
                    setInfosCoverPreview(null)
                    setInfosOpen(false)
                    setInfosError(null)
                  }}
                >
                  Fermer
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="!h-7 !gap-1.5 !rounded-full !px-3 !text-[11px]"
                  disabled={infosSaving}
                >
                  {infosSaving ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
                  {infosSaving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </form>
            )}
          </div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 flex-col gap-2 px-3 py-2.5 max-[767px]:px-2 max-[767px]:py-2 md:px-6 md:py-3">
        <section className="relative flex min-h-[480px] min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-da-sm max-[767px]:min-h-[360px] max-[767px]:p-2 min-[1100px]:min-h-0 min-[1100px]:overflow-y-hidden">
          {/* Pas de data-builder-chrome : clic sur le bandeau semaines ferme le mode jour. */}
          <div className="mb-2 flex shrink-0 min-w-0 items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {prevWeek ? (
                <Link
                  href={weekHref(basePath, program.id, prevWeek.id)}
                  className={chipBtnClass()}
                  title="Semaine précédente"
                  onClick={(e) => {
                    e.preventDefault()
                    void switchWeek(prevWeek.id)
                  }}
                >
                  <IconCaret dir="left" className="text-[color:var(--fg)]" />
                </Link>
              ) : (
                <span className={chipBtnClass(true)} aria-hidden>
                  <IconCaret dir="left" />
                </span>
              )}
              <AdminProgramWeekPills
                weeks={weeks}
                openWeekId={openWeek?.id ?? null}
                disabled={pending}
                onSelectWeek={(id) => void switchWeek(id)}
                onReorder={(ids, draggedId) => void reorderWeeks(ids, draggedId)}
              />
              {/* Ordi / tablette : + juste après les pastilles */}
              <button
                type="button"
                className={`${chipBtnClass(pending || weeks.length >= 52)} max-[767px]:hidden`}
                disabled={pending || weeks.length >= 52}
                title="Ajouter une semaine vide"
                aria-label="Ajouter une semaine vide"
                onClick={() => addEmptyWeek()}
              >
                {pending && pendingLabel.startsWith('Ajout semaine') ? (
                  <FluidSpinner size={12} />
                ) : (
                  <IconPlus size={12} />
                )}
              </button>
              {nextWeek ? (
                <Link
                  href={weekHref(basePath, program.id, nextWeek.id)}
                  className={chipBtnClass()}
                  title="Semaine suivante"
                  onClick={(e) => {
                    e.preventDefault()
                    void switchWeek(nextWeek.id)
                  }}
                >
                  <IconCaret dir="right" className="text-[color:var(--fg)]" />
                </Link>
              ) : (
                <span className={chipBtnClass(true)} aria-hidden>
                  <IconCaret dir="right" />
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {openWeek && !readOnly ? (
                <>
                  {/* Téléphone ≤767px : menu ⋯ */}
                  <div ref={weekMenuRef} className="relative min-[768px]:hidden">
                    <button
                      type="button"
                      className={chipBtnClass(pending)}
                      disabled={pending}
                      aria-label="Actions semaine"
                      aria-expanded={weekMenuOpen}
                      title="Actions semaine"
                      onClick={() => setWeekMenuOpen((v) => !v)}
                    >
                      ⋯
                    </button>
                    {weekMenuOpen ? (
                      <div
                        data-builder-chrome=""
                        className="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-da-md"
                      >
                        <button
                          type="button"
                          disabled={pending || weeks.length >= 52}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
                          onClick={() => {
                            setWeekMenuOpen(false)
                            addEmptyWeek()
                          }}
                        >
                          {pending && pendingLabel.startsWith('Ajout semaine') ? (
                            <FluidSpinner size={12} />
                          ) : (
                            <IconPlus size={12} />
                          )}
                          Ajouter une semaine
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
                          onClick={() => {
                            setWeekMenuOpen(false)
                            const title =
                              openWeek.title?.trim() || `Semaine ${openIndex + 1}`
                            setWeekRename({ weekId: openWeek.id, title })
                            setWeekRenameDraft(title)
                          }}
                        >
                          <IconEdit size={12} />
                          Éditer
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
                          onClick={() => {
                            setWeekMenuOpen(false)
                            const fd = new FormData()
                            fd.set('program_id', program.id)
                            fd.set('week_id', openWeek.id)
                            void runWeekQuiet('Duplication…', () =>
                              duplicateTrainlyProgramWeekQuietAction(fd),
                            )
                          }}
                        >
                          {pending && pendingLabel.startsWith('Duplication') ? (
                            <FluidSpinner size={12} />
                          ) : (
                            <IconDuplicate size={12} />
                          )}
                          Dupliquer
                        </button>
                        <button
                          type="button"
                          disabled={pending || !canDeleteWeek}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-[color:var(--fg)] hover:bg-[var(--accent)] disabled:opacity-40"
                          title={
                            canDeleteWeek
                              ? 'Supprimer la semaine'
                              : 'Impossible de supprimer la dernière semaine'
                          }
                          onClick={() => {
                            if (!canDeleteWeek) return
                            setWeekMenuOpen(false)
                            setWeekDeleteConfirm({
                              weekId: openWeek.id,
                              title:
                                openWeek.title?.trim() ||
                                `Semaine ${openIndex + 1}`,
                            })
                          }}
                        >
                          {pending && pendingLabel.startsWith('Suppression') ? (
                            <FluidSpinner size={12} />
                          ) : (
                            <IconTrash size={12} />
                          )}
                          Supprimer
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {/* Tablette / ordi : icônes visibles (+ = dans le rail des pastilles) */}
                  <div className="hidden items-center gap-0.5 min-[768px]:flex">
                    <button
                      type="button"
                      className={chipBtnClass(pending)}
                      disabled={pending}
                      title="Renommer la semaine"
                      aria-label="Renommer la semaine"
                      onClick={() => {
                        const title =
                          openWeek.title?.trim() || `Semaine ${openIndex + 1}`
                        setWeekRename({ weekId: openWeek.id, title })
                        setWeekRenameDraft(title)
                      }}
                    >
                      <IconEdit size={12} />
                    </button>
                    <button
                      type="button"
                      className={chipBtnClass(pending)}
                      disabled={pending}
                      title="Dupliquer"
                      aria-label="Dupliquer la semaine"
                      onClick={() => {
                        const fd = new FormData()
                        fd.set('program_id', program.id)
                        fd.set('week_id', openWeek.id)
                        void runWeekQuiet('Duplication…', () =>
                          duplicateTrainlyProgramWeekQuietAction(fd),
                        )
                      }}
                    >
                      {pending && pendingLabel.startsWith('Duplication') ? (
                        <FluidSpinner size={12} />
                      ) : (
                        <IconDuplicate size={12} />
                      )}
                    </button>
                    {canDeleteWeek ? (
                      <button
                        type="button"
                        className={chipBtnClass(pending)}
                        disabled={pending}
                        title="Supprimer la semaine"
                        aria-label="Supprimer la semaine"
                        onClick={() => {
                          setWeekDeleteConfirm({
                            weekId: openWeek.id,
                            title:
                              openWeek.title?.trim() ||
                              `Semaine ${openIndex + 1}`,
                          })
                        }}
                      >
                        {pending && pendingLabel.startsWith('Suppression') ? (
                          <FluidSpinner size={12} />
                        ) : (
                          <IconTrash size={12} />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className={chipBtnClass(true)}
                        title="Impossible de supprimer la dernière semaine"
                      >
                        <IconTrash size={12} />
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {pending ? (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--page-bg)]/55 backdrop-blur-[1px]"
              aria-busy
              aria-live="polite"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 shadow-da-sm">
                <FluidSpinner size={14} />
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                  {pendingLabel}
                </span>
              </div>
            </div>
          ) : null}

          {openWeek ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
            <ProgramBuilderDayBoard
              isCalendar={isCalendar}
              weekSessions={weekSessions}
              programId={program.id}
              weekId={openWeek.id}
              focusedDay={focusedDay}
              expanded={catalogOpen}
              readOnly={readOnly}
              compositionEditor={compositionEditor}
              onFocusDay={(day) => void openDay(day)}
              onCollapse={() => void closeDayView()}
              onExpandedOpenSessionIdChange={setExpandedOpenSessionId}
              registerCompositionApi={readOnly ? undefined : registerCompositionApi}
              onCompositionAutosaved={
                readOnly ? undefined : () => setLocalSoftFlash('Séance enregistrée')
              }
              onCompositionSnapshot={
                readOnly
                  ? undefined
                  : (sessionId, payload) => {
                      // Preview local ne doit pas effacer composition_version (catch-up SSR).
                      setCompositionLive((prev) => ({
                        ...prev,
                        [sessionId]: {
                          ...prev[sessionId],
                          ...payload,
                          composition_version:
                            payload.composition_version ??
                            prev[sessionId]?.composition_version,
                        },
                      }))
                      if (payload.composition_version != null) {
                        setVersionPatch((prev) => ({
                          ...prev,
                          [sessionId]: payload.composition_version!,
                        }))
                      }
                    }
              }
              pending={pending}
              onDropLibrarySession={
                readOnly ? () => {} : (id, day, into) => addLibrarySession(id, day, into)
              }
              onDropLibraryBlock={
                readOnly ? () => {} : (id, day, into) => addLibraryBlock(id, day, into)
              }
              onDropLibraryExercise={
                readOnly ? () => {} : (id, day, into) => addLibraryExercise(id, day, into)
              }
              onMoveProgramSession={readOnly ? () => {} : moveSession}
              onCreateSession={
                readOnly
                  ? () => {}
                  : (day) => {
                      void (async () => {
                        if (!catalogOpen || focusedDay !== day) {
                          const ok = await openDay(day)
                          if (!ok) return
                        }
                        setCreateDay(day)
                      })()
                    }
              }
              onSessionMetaSaved={
                readOnly
                  ? undefined
                  : (sessionId, patch, flash) => {
                      setSessionMetaPatch((prev) => ({ ...prev, [sessionId]: patch }))
                      if (flash) setLocalSoftFlash(flash)
                    }
              }
              onDeleteSession={
                readOnly ? undefined : (sessionId, day) => deleteSession(sessionId, day)
              }
              onReorderSessionInDay={readOnly ? undefined : reorderSessionInDay}
              onRemoveSlotDay={readOnly ? undefined : (day) => removeSlotDay(day)}
              onCatalogBlockPublished={readOnly ? undefined : upsertCatalogBlock}
              onCatalogSessionPublished={readOnly ? undefined : upsertCatalogSession}
              catalogOverlay={
                catalogOpen && !readOnly ? (
                  <ProgramBuilderPalette
                    sessions={paletteSessions}
                    blocks={paletteBlocks}
                    exercises={catalogExercises}
                    sports={catalogSports}
                    types={catalogTypes}
                    selectedTargetLabel={targetLabel}
                    addDisabled={pending}
                    onClose={() => {
                      void closeDayView()
                    }}
                    className="flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/95 shadow-da-md backdrop-blur-sm"
                    onAddSession={(id) => addLibrarySession(id)}
                    onAddBlock={(id) => addLibraryBlock(id)}
                    onAddExercise={(id) => addLibraryExercise(id)}
                  />
                ) : null
              }
            />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-[color:var(--muted)]">Aucune semaine.</p>
          )}
        </section>
      </div>

      {weekRename && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="da-vv-overlay z-[9999]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="week-rename-title"
              data-builder-chrome=""
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-black/50" aria-hidden />
              <div className="da-vv-dialog absolute left-1/2 top-1/2 z-10 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <h2
                    id="week-rename-title"
                    className="text-sm font-bold text-[color:var(--fg)]"
                  >
                    Renommer la semaine
                  </h2>
                </div>
                <form
                  className="px-4 py-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!weekRename || pending) return
                    const fd = new FormData()
                    fd.set('program_id', program.id)
                    fd.set('week_id', weekRename.weekId)
                    fd.set('title', weekRenameDraft.trim())
                    setWeekRename(null)
                    void runWeekQuiet('Renommage…', () =>
                      renameTrainlyProgramWeekQuietAction(fd),
                    )
                  }}
                >
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Nom
                    </span>
                    <input
                      autoFocus
                      value={weekRenameDraft}
                      onChange={(e) => setWeekRenameDraft(e.target.value)}
                      aria-label="Nom de la semaine"
                      className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-semibold text-[color:var(--fg)]"
                    />
                  </label>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setWeekRename(null)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending && pendingLabel.startsWith('Renommage') ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FluidSpinner size={12} />
                          Enregistrement…
                        </span>
                      ) : (
                        'Enregistrer'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}

      {weekDeleteConfirm && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="da-vv-overlay z-[9999]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="week-delete-title"
              data-builder-chrome=""
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-black/50" aria-hidden />
              <div className="da-vv-dialog absolute left-1/2 top-1/2 z-10 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <h2
                    id="week-delete-title"
                    className="text-sm font-bold text-[color:var(--fg)]"
                  >
                    Supprimer la semaine ?
                  </h2>
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm text-[color:var(--muted)]">
                    « {weekDeleteConfirm.title} » et toutes ses séances seront
                    définitivement supprimées.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setWeekDeleteConfirm(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const { weekId } = weekDeleteConfirm
                        setWeekDeleteConfirm(null)
                        const fd = new FormData()
                        fd.set('program_id', program.id)
                        fd.set('week_id', weekId)
                        void runWeekQuiet('Suppression…', () =>
                          deleteTrainlyProgramWeekQuietAction(fd),
                        )
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {joursConvertOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="da-vv-overlay z-[9999]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="jours-convert-title"
              data-builder-chrome=""
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-black/50" aria-hidden />
              <div className="da-vv-dialog absolute left-1/2 top-1/2 z-10 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <h2
                    id="jours-convert-title"
                    className="text-sm font-bold text-[color:var(--fg)]"
                  >
                    Passer en mode journées ?
                  </h2>
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm text-[color:var(--muted)]">
                    Les jours remplis (lun.–sam.) deviennent des journées. Le
                    dimanche sera supprimé
                    {joursConvertDeleteCount > 0
                      ? ` (${joursConvertDeleteCount} séance${
                          joursConvertDeleteCount > 1 ? 's' : ''
                        })`
                      : ''}
                    .
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => setJoursConvertOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void runConvertToJours()}
                    >
                      {pending && pendingLabel.startsWith('Conversion') ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FluidSpinner size={12} />
                          Conversion…
                        </span>
                      ) : (
                        'Confirmer'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {calendarConvertOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="da-vv-overlay z-[9999]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calendar-convert-title"
              data-builder-chrome=""
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-black/50" aria-hidden />
              <div className="da-vv-dialog absolute left-1/2 top-1/2 z-10 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
                <div className="border-b border-[var(--border)] px-4 py-3">
                  <h2
                    id="calendar-convert-title"
                    className="text-sm font-bold text-[color:var(--fg)]"
                  >
                    Passer en mode calendrier ?
                  </h2>
                </div>
                <div className="px-4 py-4">
                  <p className="text-sm text-[color:var(--muted)]">
                    Les journées seront placées à partir du jour choisi, jusqu’à
                    dimanche.
                  </p>
                  <label className="mt-3 grid gap-1.5">
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      Jour 1 commence le…
                    </span>
                    <select
                      value={calendarStartDay}
                      onChange={(e) => setCalendarStartDay(Number(e.target.value))}
                      className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm font-semibold text-[color:var(--fg)]"
                    >
                      {(
                        [
                          'Lundi',
                          'Mardi',
                          'Mercredi',
                          'Jeudi',
                          'Vendredi',
                          'Samedi',
                          'Dimanche',
                        ] as const
                      ).map((label, i) => (
                        <option key={label} value={i}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {calendarConvertDeleteDayCount > 0 ? (
                    <p className="mt-2 text-sm font-semibold text-[color:var(--fg)]">
                      {calendarConvertDeleteDayCount} journée
                      {calendarConvertDeleteDayCount > 1 ? 's' : ''} en trop{' '}
                      {calendarConvertDeleteDayCount > 1
                        ? 'seront supprimées'
                        : 'sera supprimée'}
                    </p>
                  ) : null}
                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => setCalendarConvertOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void runConvertToCalendar()}
                    >
                      {pending && pendingLabel.startsWith('Conversion') ? (
                        <span className="inline-flex items-center gap-1.5">
                          <FluidSpinner size={12} />
                          Conversion…
                        </span>
                      ) : (
                        'Confirmer'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {createDay != null && openWeek ? (
        <ProgramSessionMetaPopup
          mode="create"
          programId={program.id}
          weekId={openWeek.id}
          day={createDay}
          dayLabel={
            isCalendar
              ? (['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'] as const)[
                  createDay
                ] ?? 'jour'
              : `journée ${createDay + 1}`
          }
          pending={pending}
          catalogSessions={paletteSessions}
          onPickLibrarySession={(libraryId) => {
            const day = createDay
            setCreateDay(null)
            addLibrarySession(libraryId, day)
          }}
          onClose={() => setCreateDay(null)}
          onCreated={(board, day, flash) => {
            applyBoardPatch(board)
            setFocusedDay(day)
            setCatalogOpen(true)
            syncDayInUrl(day)
            setLocalSoftFlash(flash ?? 'Séance créée')
          }}
          onCatalogPublished={upsertCatalogSession}
        />
      ) : null}
    </div>
  )
}
