'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
} from 'react'
import { flushSync } from 'react-dom'

import {
  PrescriptionListSelect,
  PrescriptionValueControl,
} from '@/src/components/admin/PrescriptionValueControl'
import {
  CompositionInsertMarker,
  useCompositionDndEnabled,
  useCompositionLongPressReorder,
} from '@/src/components/admin/useCompositionLongPressReorder'
import { CreateBlockDialog } from '@/src/components/admin/CreateBlockDialog'
import { CreateUnitDialog } from '@/src/components/admin/CreateUnitDialog'
import {
  CatalogLibraryPreviewModal,
  prefetchCatalogPreview,
  prefetchCatalogPreviewBatch,
  type CatalogPreviewTarget,
} from '@/src/components/admin/SessionLibraryPreviewModal'
import {
  Button,
  IconEdit,
  IconGrip,
  IconPlus,
  IconRest,
  IconTrash,
  daFieldClass,
  daSelectClass,
} from '@/src/components/ui'
import type { BlockExerciseCandidate } from '@/src/components/admin/BlockFicheEditor'
import {
  formatSecondsToMmSs,
  parseMmSsToSeconds,
} from '@/src/components/program-editor-v2/utils/prescriptionHelpers'
import type { UnitRow } from '@/src/lib/blocks/constants'
import {
  defaultInputModeForUnitKey,
  listOptionsForUnit,
  prescriptionUiKind,
  valueControlMode,
} from '@/src/lib/catalog/prescriptionUi'
import {
  formatBlockTimerSummary,
  formatFilledPrescriptions,
  type SessionBlockDetail,
} from '@/src/lib/sessions/blockDetail'
import { unitShortLabel } from '@/src/lib/catalog/rxPresets'
import {
  DEFAULT_SESSION_REST_SECONDS,
  SESSION_EXERCISE_RX_KEYS,
  groupSessionPrescriptions,
  nextSessionRxGroup,
  normalizeSessionCompositionSlots,
  restPrescriptionsPayload,
  type SessionPrescription,
  type SessionSlot,
} from '@/src/lib/sessions/constants'

export type SessionBlockCandidate = {
  id: string
  name: string
  status: string
  sport_id: string | null
  sport_label: string | null
}

export type SessionExerciseCandidate = {
  id: string
  name: string
  exercise_type_id: string | null
  exercise_type_label: string | null
  sport_id: string | null
  sport_label: string | null
  muscle_group?: string | null
}

export type SessionUnit = {
  id: string
  key: string
  label: string
  short_label?: string | null
  value_mode?: string | null
  list_options?: string[] | null
}

type InheritedChip = { id: string; label: string; hidden: boolean }

type Props = {
  blocks: SessionBlockCandidate[]
  exercises: SessionExerciseCandidate[]
  units: SessionUnit[]
  /** Catalogue complet pour la modal « Créer un bloc » (= /admin/blocks/new). */
  blockCatalog: {
    candidates: BlockExerciseCandidate[]
    sports: { id: string; label: string }[]
    units: UnitRow[]
  }
  /** Détails des blocs déjà présents dans la composition (édition séance). */
  initialBlockDetails?: SessionBlockDetail[]
  /** Séance déjà publiée → nouveaux blocs créés publiés. */
  sessionPublished?: boolean
  returnToForNewBlock: string
  /** Builder programme : masque nom / notes / feedback / héritage (gérés ailleurs). */
  compositionOnly?: boolean
  /** Preview catalogue : composition visible, pas d’édition. */
  readOnly?: boolean
  /**
   * Builder tablette : recherche exos/blocs + « Créer un bloc » en bas de séance
   * (comme /admin/sessions/new), sans palette latérale.
   */
  inlineCatalog?: boolean
  /** Séance programme ouverte — create/edit bloc = copie programme figée. */
  programSessionId?: string | null
  /** Hub séances coach : modal bloc → /api/coach/blocks + CTAs Ma biblio / Brouillon. */
  coachMode?: boolean
  /** Notifie le parent quand la composition locale diffère de l’initial. */
  onDirtyChange?: (dirty: boolean) => void
  /** Incrémenter après un save réussi pour rebaser le dirty. */
  resetDirtyToken?: number
  /**
   * Change quand la composition serveur/live change (drop, refresh).
   * Re-sync les slots locaux — sans ça le DnD n’apparaît qu’après remount.
   */
  slotsSyncKey?: string | number
  /** API pour drop catalogue → édition locale (une seule logique save = fermeture). */
  /** Après mutation locale (création bloc…) — sync compteur / compact live. */
  onSlotsChange?: (slots: SessionSlot[]) => void
  /** Détail copie programme (créé/édité) pour labels / Rx live. */
  onBlockDetailUpserted?: (detail: SessionBlockDetail) => void
  /** Après Publier admin d’un bloc — refresh palette builder. */
  onCatalogBlockPublished?: (block: {
    id: string
    name: string
    sport_id: string | null
    status: string
  }) => void
  onRegisterApi?: (
    api: {
      appendBlock: (id: string) => void
      appendExercise: (id: string) => void
      insertBlockAt: (id: string, index: number) => void
      insertExerciseAt: (id: string, index: number) => void
      /** Attendre les forks catalogue→copie avant flush (évite doublons). */
      awaitPendingForks: () => Promise<void>
      markClean: () => void
      /** Source de vérité flush — pas le FormData DOM. */
      getSlots: () => SessionSlot[]
      /** Après save DB : nouveaux orphan ids (évite « bloc introuvable » / RLS). */
      applyServerSlots: (slots: SessionSlot[]) => void
    } | null,
  ) => void
  initial?: {
    name?: string
    notes?: string
    allow_duplicate?: boolean
    objective_ressenti?: boolean
    objective_note?: boolean
    objective_difficulty?: boolean
    slots?: SessionSlot[]
    hidden_type_ids?: string[]
    hidden_sport_ids?: string[]
  }
}

function newKey() {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultRx(units: SessionUnit[], group = 0): SessionPrescription[] {
  const byKey = new Map(units.map((u) => [u.key, u]))
  const out: SessionPrescription[] = []
  for (const key of SESSION_EXERCISE_RX_KEYS) {
    const u = byKey.get(key)
    if (!u) continue
    out.push({
      unit_id: u.id,
      value: '',
      input_mode: defaultInputModeForUnitKey(key, u.value_mode),
      group,
    })
  }
  return out
}

function isDefaultUnitId(units: SessionUnit[], unitId: string) {
  const u = units.find((x) => x.id === unitId)
  return Boolean(u && (SESSION_EXERCISE_RX_KEYS as readonly string[]).includes(u.key))
}

function ensureDefaultRx(
  prescriptions: SessionPrescription[],
  units: SessionUnit[],
): SessionPrescription[] {
  if (!prescriptions.length) return defaultRx(units)
  const byKey = new Map(units.map((u) => [u.key, u]))
  const byId = new Map(units.map((u) => [u.id, u]))
  const present = new Set(
    prescriptions.map((p) => byId.get(p.unit_id)?.key).filter(Boolean) as string[],
  )
  const missing: SessionPrescription[] = []
  for (const key of SESSION_EXERCISE_RX_KEYS) {
    if (present.has(key)) continue
    const u = byKey.get(key)
    if (!u) continue
    missing.push({
      unit_id: u.id,
      value: '',
      input_mode: defaultInputModeForUnitKey(key, u.value_mode),
      group: 0,
    })
  }
  return missing.length ? [...missing, ...prescriptions] : prescriptions
}

function detailToCandidate(d: SessionBlockDetail): SessionBlockCandidate {
  return {
    id: d.id,
    name: d.name,
    status: d.status,
    sport_id: d.sport_id,
    sport_label: null,
  }
}

export function SessionFicheEditor({
  blocks,
  exercises,
  units,
  blockCatalog,
  initialBlockDetails = [],
  sessionPublished = false,
  returnToForNewBlock: _returnToForNewBlock,
  compositionOnly = false,
  readOnly = false,
  inlineCatalog = false,
  programSessionId = null,
  coachMode = false,
  onDirtyChange,
  resetDirtyToken = 0,
  slotsSyncKey,
  onSlotsChange,
  onBlockDetailUpserted,
  onCatalogBlockPublished,
  onRegisterApi,
  initial = {},
}: Props) {
  const [slots, setSlotsState] = useState<SessionSlot[]>(() => initial.slots ?? [])
  const initialSlotsSnap = useRef(JSON.stringify(initial.slots ?? []))
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  const onSlotsChangeRef = useRef(onSlotsChange)
  onSlotsChangeRef.current = onSlotsChange
  const onBlockDetailUpsertedRef = useRef(onBlockDetailUpserted)
  onBlockDetailUpsertedRef.current = onBlockDetailUpserted
  const onCatalogBlockPublishedRef = useRef(onCatalogBlockPublished)
  onCatalogBlockPublishedRef.current = onCatalogBlockPublished
  const initialSlotsRef = useRef(initial.slots ?? [])
  initialSlotsRef.current = initial.slots ?? []

  function notifyDirty(next: SessionSlot[]) {
    onDirtyChangeRef.current?.(JSON.stringify(next) !== initialSlotsSnap.current)
  }

  const slotsRef = useRef(slots)
  slotsRef.current = slots

  /**
   * Calcul sync depuis slotsRef (pas l’updater React async) —
   * getSlots / dirty / flush restent fiables même hors flushSync.
   */
  function setSlots(updater: SessionSlot[] | ((prev: SessionSlot[]) => SessionSlot[])) {
    const prev = slotsRef.current
    const next = typeof updater === 'function' ? updater(prev) : updater
    slotsRef.current = next
    setSlotsState(next)
    notifyDirty(next)
    queueMicrotask(() => onSlotsChangeRef.current?.(next))
  }

  function rebaseSlots(next: SessionSlot[]) {
    const normalized = normalizeSessionCompositionSlots(next)
    setSlotsState(normalized)
    slotsRef.current = normalized
    initialSlotsSnap.current = JSON.stringify(normalized)
    onDirtyChangeRef.current?.(false)
  }

  function applyServerSlots(serverSlots: SessionSlot[]) {
    rebaseSlots(
      serverSlots.map((s, i) => ({
        key: s.key || `srv-${i}-${s.kind}`,
        kind: s.kind,
        blockId: s.blockId,
        orphanSessionBlockId: s.orphanSessionBlockId,
        exerciseId: s.exerciseId,
        restSeconds: s.restSeconds,
        prescriptions: s.prescriptions ?? [],
      })),
    )
    queueMicrotask(() => onSlotsChangeRef.current?.(slotsRef.current))
  }

  /** Après save : garder les slots locaux, juste rebaser le dirty. */
  useEffect(() => {
    initialSlotsSnap.current = JSON.stringify(slotsRef.current)
    onDirtyChangeRef.current?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebase dirty only on token bump
  }, [resetDirtyToken])

  /** Drop / patch live : réinjecter la composition parent (jamais si dirty local). */
  useEffect(() => {
    if (slotsSyncKey == null) return
    const dirty = JSON.stringify(slotsRef.current) !== initialSlotsSnap.current
    if (dirty) return
    rebaseSlots(initialSlotsRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent composition
  }, [slotsSyncKey])
  const [extraBlocks, setExtraBlocks] = useState<SessionBlockCandidate[]>([])
  const [blockDetails, setBlockDetails] = useState<Record<string, SessionBlockDetail>>(() => {
    const map: Record<string, SessionBlockDetail> = {}
    for (const d of initialBlockDetails) map[d.id] = d
    return map
  })
  const [unitsState, setUnitsState] = useState<SessionUnit[]>(() => units)
  const [createUnitOpen, setCreateUnitOpen] = useState(false)
  const [createUnitTarget, setCreateUnitTarget] = useState<{
    slotKey: string
    idx: number
  } | null>(null)
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingExerciseKey, setEditingExerciseKey] = useState<string | null>(null)
  const [hiddenTypeIds, setHiddenTypeIds] = useState<string[]>(initial.hidden_type_ids ?? [])
  const [hiddenSportIds, setHiddenSportIds] = useState<string[]>(initial.hidden_sport_ids ?? [])
  const [filterSportId, setFilterSportId] = useState('')
  const [filterTypeId, setFilterTypeId] = useState('')
  const [q, setQ] = useState('')
  const [picker, setPicker] = useState<'block' | 'exercise'>('exercise')
  const [searchOpen, setSearchOpen] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<CatalogPreviewTarget>(null)
  /** Index d’insert catalogue pendant drag (hit-test Y) — null = pas de drag actif. */
  const [catalogInsertIndex, setCatalogInsertIndex] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const compositionListRef = useRef<HTMLUListElement>(null)
  const compositionDndEnabled = useCompositionDndEnabled()
  const canDragCompositionKey = useCallback(
    (key: string) => {
      const slot = slots.find((s) => s.key === key)
      return Boolean(slot && slot.kind !== 'rest')
    },
    [slots],
  )
  const {
    getItemProps: getCompositionReorderProps,
    getHandleProps: getCompositionHandleProps,
    showInsertMarkerAt: showCompositionInsertAt,
    shouldSuppressClick: shouldSuppressCompositionClick,
    showHandles: showCompositionHandles,
  } = useCompositionLongPressReorder({
    enabled: compositionDndEnabled,
    items: slots,
    onReorder: (next) => setSlots(normalizeSessionCompositionSlots(next)),
    canDragKey: canDragCompositionKey,
    listRef: compositionListRef,
  })
  const searchInputRef = useRef<HTMLInputElement>(null)
  const reopenSearchAfterPreviewRef = useRef(false)
  const fetchingBlocks = useRef<Set<string>>(new Set())

  function openCatalogPreview(target: NonNullable<CatalogPreviewTarget>) {
    reopenSearchAfterPreviewRef.current = true
    setSearchOpen(true)
    // Ferme le clavier soft avant d’afficher l’aperçu.
    searchInputRef.current?.blur()
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setPreviewTarget(target)
  }

  function closeCatalogPreview() {
    setPreviewTarget(null)
    if (!reopenSearchAfterPreviewRef.current) return
    reopenSearchAfterPreviewRef.current = false
    setSearchOpen(true)
    window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }

  const allBlocks = useMemo(() => {
    const map = new Map<string, SessionBlockCandidate>()
    for (const b of blocks) map.set(b.id, b)
    for (const b of extraBlocks) {
      if (!map.has(b.id)) map.set(b.id, b)
    }
    for (const d of Object.values(blockDetails)) {
      const existing = map.get(d.id)
      map.set(d.id, {
        id: d.id,
        name: d.name,
        status: d.status,
        sport_id: d.sport_id,
        sport_label: existing?.sport_label ?? null,
      })
    }
    return [...map.values()]
  }, [blocks, extraBlocks, blockDetails])

  const publishedBlocks = useMemo(
    () => allBlocks.filter((b) => b.status === 'published'),
    [allBlocks],
  )
  /** Picker catalogue : uniquement la librairie publiée (pas les copies programme / brouillons). */
  const catalogPublishedBlocks = useMemo(
    () => blocks.filter((b) => b.status === 'published'),
    [blocks],
  )
  const blockById = useMemo(() => new Map(allBlocks.map((b) => [b.id, b])), [allBlocks])
  const exoById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const defaultUnitIds = useMemo(() => {
    const byKey = new Map(unitsState.map((u) => [u.key, u.id]))
    return SESSION_EXERCISE_RX_KEYS.map((k) => byKey.get(k)).filter(Boolean) as string[]
  }, [unitsState])

  const unitById = useMemo(() => new Map(unitsState.map((u) => [u.id, u])), [unitsState])
  const blockUnitById = useMemo(
    () => new Map(blockCatalog.units.map((u) => [u.id, u])),
    [blockCatalog.units],
  )

  function upsertBlockDetail(detail: SessionBlockDetail) {
    setBlockDetails((prev) => ({ ...prev, [detail.id]: detail }))
    setExtraBlocks((prev) => {
      const c = detailToCandidate(detail)
      if (prev.some((b) => b.id === detail.id)) {
        return prev.map((b) => (b.id === detail.id ? { ...b, ...c } : b))
      }
      if (blocks.some((b) => b.id === detail.id)) return prev
      return [...prev, c]
    })
  }

  async function ensureBlockDetail(
    blockId: string,
    opts?: { programCopy?: boolean },
  ): Promise<SessionBlockDetail | null> {
    if (!blockId) return null
    if (blockDetails[blockId]) return blockDetails[blockId]
    if (fetchingBlocks.current.has(blockId)) return null
    fetchingBlocks.current.add(blockId)
    try {
      const url = opts?.programCopy
        ? `/api/admin/program-session-blocks/${blockId}`
        : coachMode
          ? `/api/coach/blocks/${blockId}`
          : `/api/admin/blocks/${blockId}`
      const res = await fetch(url)
      const json = (await res.json().catch(() => ({}))) as {
        block?: SessionBlockDetail
      }
      if (res.ok && json.block) {
        upsertBlockDetail(json.block)
        // Compact mode lit compositionLive — notifier le board (pas les stubs d’erreur).
        onBlockDetailUpsertedRef.current?.(json.block)
        return json.block
      }
      // Stub pour stopper le « Chargement… » infini (id périmé après flush).
      upsertBlockDetail({
        id: blockId,
        name: 'Bloc',
        status: 'draft',
        sport_id: null,
        notes: null,
        timer_note: null,
        expected_result_label: null,
        expected_result_unit_id: null,
        allow_duplicate: false,
        exercise_ids: [],
        exercise_prescriptions: [],
        hidden_type_ids: [],
        exercises: [],
      })
      return null
    } catch {
      upsertBlockDetail({
        id: blockId,
        name: 'Bloc',
        status: 'draft',
        sport_id: null,
        notes: null,
        timer_note: null,
        expected_result_label: null,
        expected_result_unit_id: null,
        allow_duplicate: false,
        exercise_ids: [],
        exercise_prescriptions: [],
        hidden_type_ids: [],
        exercises: [],
      })
      return null
    } finally {
      fetchingBlocks.current.delete(blockId)
    }
  }

  useEffect(() => {
    setUnitsState((prev) => {
      const map = new Map(prev.map((u) => [u.id, u]))
      for (const u of units) map.set(u.id, u)
      return [...map.values()]
    })
  }, [units])

  useEffect(() => {
    for (const slot of slots) {
      if (slot.kind !== 'block') continue
      if (slot.orphanSessionBlockId && !blockDetails[slot.orphanSessionBlockId]) {
        void ensureBlockDetail(slot.orphanSessionBlockId, { programCopy: true })
        continue
      }
      // Pendant fork (pas encore d’orphan) : aperçu catalogue pour affichage immédiat.
      if (slot.blockId && !slot.orphanSessionBlockId && !blockDetails[slot.blockId]) {
        void ensureBlockDetail(slot.blockId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate missing details only
  }, [slots, blockDetails, programSessionId])

  // Une seule passe à l’arrivée des units — les nouveaux exos passent déjà par defaultRx().
  useEffect(() => {
    if (!unitsState.length) return
    let nextSnap: SessionSlot[] | null = null
    setSlotsState((prev) => {
      let changed = false
      const next = prev.map((s) => {
        if (s.kind !== 'exercise') return s
        const ensured = ensureDefaultRx(s.prescriptions ?? [], unitsState)
        if (
          ensured.length === (s.prescriptions?.length ?? 0) &&
          ensured.every((p, i) => {
            const o = s.prescriptions[i]
            return o && o.unit_id === p.unit_id && o.value === p.value && o.group === p.group
          })
        ) {
          return s
        }
        changed = true
        return { ...s, prescriptions: ensured }
      })
      if (!changed) return prev
      nextSnap = next
      return next
    })
    if (nextSnap) {
      // Hydrate defaults ≠ edit utilisateur — rebaser le dirty (hors updater).
      initialSlotsSnap.current = JSON.stringify(nextSnap)
      onDirtyChangeRef.current?.(false)
    }
  }, [unitsState])

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return
      const data = ev.data as {
        type?: string
        blockId?: string
        name?: string
        status?: string
      } | null
      if (!data || data.type !== 'trainly:session-attach-block' || !data.blockId) return
      const blockId = data.blockId
      setExtraBlocks((prev) => {
        if (prev.some((b) => b.id === blockId) || blocks.some((b) => b.id === blockId)) return prev
        return [
          ...prev,
          {
            id: blockId,
            name: data.name || 'Bloc',
            status: data.status || 'draft',
            sport_id: null,
            sport_label: null,
          },
        ]
      })
      setSlots((prev) => {
        if (prev.some((s) => s.blockId === blockId)) return prev
        return [...prev, { key: newKey(), kind: 'block', blockId, prescriptions: [] }]
      })
      void ensureBlockDetail(blockId)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [blocks])

  const inheritedTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of slots) {
      if (s.kind !== 'exercise' || !s.exerciseId) continue
      const e = exoById.get(s.exerciseId)
      if (e?.exercise_type_id && e.exercise_type_label) {
        map.set(e.exercise_type_id, e.exercise_type_label)
      }
    }
    return [...map.entries()].map(([id, label]) => ({
      id,
      label,
      hidden: hiddenTypeIds.includes(id),
    })) as InheritedChip[]
  }, [slots, exoById, hiddenTypeIds])

  const inheritedSports = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of slots) {
      if (s.kind === 'exercise' && s.exerciseId) {
        const e = exoById.get(s.exerciseId)
        if (e?.sport_id && e.sport_label) map.set(e.sport_id, e.sport_label)
      }
      if (s.kind === 'block' && s.blockId) {
        const b = blockById.get(s.blockId)
        if (b?.sport_id && b.sport_label) map.set(b.sport_id, b.sport_label)
      }
    }
    return [...map.entries()].map(([id, label]) => ({
      id,
      label,
      hidden: hiddenSportIds.includes(id),
    })) as InheritedChip[]
  }, [slots, exoById, blockById, hiddenSportIds])

  const catalogTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of exercises) {
      if (e.exercise_type_id && e.exercise_type_label) map.set(e.exercise_type_id, e.exercise_type_label)
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [exercises])

  const catalogSports = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of exercises) {
      if (e.sport_id && e.sport_label) map.set(e.sport_id, e.sport_label)
    }
    for (const b of publishedBlocks) {
      if (b.sport_id && b.sport_label) map.set(b.sport_id, b.sport_label)
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [exercises, publishedBlocks])

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (picker === 'block') {
      return catalogPublishedBlocks
        .filter((b) => {
          if (filterSportId && b.sport_id !== filterSportId) return false
          if (needle && !b.name.toLowerCase().includes(needle)) return false
          return true
        })
        .slice(0, 20)
    }
    return exercises
      .filter((e) => {
        if (filterSportId && e.sport_id !== filterSportId) return false
        if (filterTypeId && e.exercise_type_id !== filterTypeId) return false
        if (needle && !e.name.toLowerCase().includes(needle)) return false
        return true
      })
      .slice(0, 20)
  }, [picker, catalogPublishedBlocks, exercises, filterSportId, filterTypeId, q])

  const showList =
    searchOpen && (q.trim().length > 0 || Boolean(filterSportId) || Boolean(filterTypeId))
  const searchResultsRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!showList) return
    window.requestAnimationFrame(() => {
      wrapRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' })
      searchResultsRef.current?.scrollTo({ top: 0 })
    })
  }, [showList, q, filterSportId, filterTypeId, picker])

  useEffect(() => {
    if (!showList || !hits.length) return
    prefetchCatalogPreviewBatch(
      picker === 'block' ? 'block' : 'exercise',
      hits.map((h) => h.id),
      12,
    )
  }, [showList, hits, picker])

  const forkingSlots = useRef<Set<string>>(new Set())
  const pendingForksRef = useRef<Map<string, Promise<SessionBlockDetail | null>>>(new Map())
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Fork catalogue → copie programme (éditable sans toucher au modèle). */
  async function ensureProgramCopyForSlot(
    slotKey: string,
    libraryBlockId: string,
  ): Promise<SessionBlockDetail | null> {
    if (!programSessionId || !libraryBlockId) return null
    const existing = pendingForksRef.current.get(slotKey)
    if (existing) return existing
    if (forkingSlots.current.has(slotKey)) return null
    forkingSlots.current.add(slotKey)
    const run = (async (): Promise<SessionBlockDetail | null> => {
      try {
        const res = await fetch('/api/admin/program-session-blocks/from-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_session_id: programSessionId,
            block_library_id: libraryBlockId,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!res.ok || !json.block) {
          if (mountedRef.current) {
            window.alert(json.error || 'Impossible de créer la copie programme')
          }
          return null
        }
        if (!mountedRef.current) {
          // Fork terminé après unmount/flush : ne pas patcher l’UI (DB item sera
          // réordonné/écrasé au prochain save si encore orphelin hors form).
          return json.block
        }
        upsertBlockDetail(json.block)
        // Slots d’abord (orphan + library) puis notify board pour meta + preview compact.
        flushSync(() => {
          setSlots((prev) =>
            prev.map((s) =>
              s.key === slotKey
                ? {
                    ...s,
                    kind: 'block' as const,
                    blockId: libraryBlockId,
                    orphanSessionBlockId: json.block!.id,
                    prescriptions: s.prescriptions ?? [],
                  }
                : s,
            ),
          )
        })
        onBlockDetailUpsertedRef.current?.(json.block)
        return json.block
      } catch {
        if (mountedRef.current) window.alert('Erreur réseau')
        return null
      } finally {
        forkingSlots.current.delete(slotKey)
        pendingForksRef.current.delete(slotKey)
      }
    })()
    pendingForksRef.current.set(slotKey, run)
    return run
  }

  function insertBlockAt(id: string, index: number) {
    const key = newKey()
    // Titre immédiat depuis le picker / catalogue (sans attendre le fork).
    const cand =
      blockCatalog.candidates.find((c) => c.id === id) ||
      blocks.find((b) => b.id === id)
    if (cand) {
      setExtraBlocks((prev) =>
        prev.some((b) => b.id === id)
          ? prev
          : [
              ...prev,
              {
                id: cand.id,
                name: cand.name,
                status: 'published',
                sport_id: cand.sport_id,
                sport_label: cand.sport_label ?? null,
              },
            ],
      )
    }
    const at = Math.max(0, Math.min(index, slotsRef.current.length))
    setSlots((prev) => {
      const next = [...prev]
      next.splice(at, 0, { key, kind: 'block', blockId: id, prescriptions: [] })
      return normalizeSessionCompositionSlots(next)
    })
    setQ('')
    setSearchOpen(false)
    // Aperçu catalogue immédiat + fork programme en parallèle (stabilité : flush attend le fork).
    void ensureBlockDetail(id)
    if (programSessionId) {
      void ensureProgramCopyForSlot(key, id)
    }
  }

  function insertExerciseAt(id: string, index: number) {
    const key = newKey()
    const at = Math.max(0, Math.min(index, slotsRef.current.length))
    setSlots((prev) => {
      const next = [...prev]
      next.splice(at, 0, {
        key,
        kind: 'exercise',
        exerciseId: id,
        prescriptions: defaultRx(unitsState),
      })
      return normalizeSessionCompositionSlots(next)
    })
    setEditingExerciseKey(key)
    setQ('')
    setSearchOpen(false)
  }

  function addBlock(id: string) {
    insertBlockAt(id, slotsRef.current.length)
  }

  function addExercise(id: string) {
    insertExerciseAt(id, slotsRef.current.length)
  }

  const addBlockRef = useRef(addBlock)
  addBlockRef.current = addBlock
  const addExerciseRef = useRef(addExercise)
  addExerciseRef.current = addExercise
  const insertBlockAtRef = useRef(insertBlockAt)
  insertBlockAtRef.current = insertBlockAt
  const insertExerciseAtRef = useRef(insertExerciseAt)
  insertExerciseAtRef.current = insertExerciseAt

  function markClean() {
    initialSlotsSnap.current = JSON.stringify(slotsRef.current)
    onDirtyChangeRef.current?.(false)
  }

  async function awaitPendingForks() {
    const pending = [...pendingForksRef.current.values()]
    if (!pending.length) return
    await Promise.all(pending)
  }

  const applyServerSlotsRef = useRef(applyServerSlots)
  applyServerSlotsRef.current = applyServerSlots

  useEffect(() => {
    if (!onRegisterApi) return
    onRegisterApi({
      appendBlock: (id) => addBlockRef.current(id),
      appendExercise: (id) => addExerciseRef.current(id),
      insertBlockAt: (id, index) => insertBlockAtRef.current(id, index),
      insertExerciseAt: (id, index) => insertExerciseAtRef.current(id, index),
      awaitPendingForks,
      markClean,
      getSlots: () => slotsRef.current,
      applyServerSlots: (slots) => applyServerSlotsRef.current(slots),
    })
    return () => onRegisterApi(null)
  }, [onRegisterApi])

  function openCreateBlock() {
    setEditingBlockId(null)
    setBlockDialogOpen(true)
  }

  async function openEditBlock(slot: SessionSlot) {
    let programCopyId = slot.orphanSessionBlockId
    // Drop catalogue pas encore forké → fork maintenant, puis ouvrir l’éditeur copie.
    if (!programCopyId && slot.blockId && programSessionId) {
      const forked = await ensureProgramCopyForSlot(slot.key, slot.blockId)
      if (!forked) return
      programCopyId = forked.id
      setEditingBlockId(forked.id)
      setBlockDialogOpen(true)
      return
    }
    const id = programCopyId ?? slot.blockId
    if (!id) return
    setEditingBlockId(id)
    const detail =
      blockDetails[id] ??
      (await ensureBlockDetail(id, { programCopy: Boolean(programCopyId) }))
    if (detail) setBlockDialogOpen(true)
  }

  function move(key: string, dir: -1 | 1) {
    setSlots((prev) => {
      const i = prev.findIndex((s) => s.key === key)
      if (i < 0) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return normalizeSessionCompositionSlots(next)
    })
  }

  /**
   * Flèches ▲▼ : tablette + ordi. Téléphone = DnD long-press seulement (sauf repos).
   * Cibles tactiles élargies <1100px.
   */
  function MoveButtons({
    slotKey,
    index,
    phoneHidden = false,
  }: {
    slotKey: string
    index: number
    /** true pour blocs/exos — masqué ≤767px (DnD only). */
    phoneHidden?: boolean
  }) {
    const btn =
      'inline-flex h-3.5 w-6 items-center justify-center text-[9px] leading-none text-[color:var(--muted)] hover:text-[color:var(--fg)] disabled:opacity-30 max-[1099px]:h-6 max-[1099px]:w-10 max-[1099px]:text-[13px]'
    return (
      <div className={`flex flex-col ${phoneHidden ? 'max-[767px]:hidden' : ''}`}>
        <button
          type="button"
          className={btn}
          disabled={index === 0}
          title="Monter"
          aria-label="Monter"
          onClick={() => move(slotKey, -1)}
        >
          ▲
        </button>
        <button
          type="button"
          className={btn}
          disabled={index === slots.length - 1}
          title="Descendre"
          aria-label="Descendre"
          onClick={() => move(slotKey, 1)}
        >
          ▼
        </button>
      </div>
    )
  }

  function RemoveSlotButton({ slotKey }: { slotKey: string }) {
    return (
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--danger)] max-[1099px]:h-11 max-[1099px]:w-11"
        title="Retirer"
        aria-label="Retirer"
        onClick={() =>
          setSlots((p) =>
            normalizeSessionCompositionSlots(p.filter((s) => s.key !== slotKey)),
          )
        }
      >
        <IconTrash size={14} />
      </button>
    )
  }

  function insertRestAt(index: number) {
    setSlots((prev) => {
      const before = prev[index - 1]
      const after = prev[index]
      if (!before || !after) return prev
      if (before.kind === 'rest' || after.kind === 'rest') return prev
      const next = [...prev]
      next.splice(index, 0, {
        key: newKey(),
        kind: 'rest',
        restSeconds: DEFAULT_SESSION_REST_SECONDS,
        prescriptions: [],
      })
      return next
    })
  }

  function setRestSeconds(key: string, seconds: number) {
    setSlots((prev) =>
      prev.map((s) =>
        s.key === key && s.kind === 'rest'
          ? { ...s, restSeconds: Math.max(0, Math.floor(seconds)) }
          : s,
      ),
    )
  }

  function canShowRestInsertAfter(index: number) {
    const cur = slots[index]
    const next = slots[index + 1]
    if (!cur || !next) return false
    if (cur.kind === 'rest' || next.kind === 'rest') return false
    return true
  }

  function RestInsertButton({ at }: { at: number }) {
    return (
      <li className="-my-0.5 flex list-none items-center gap-2 px-1">
        <span className="h-px flex-1 bg-[var(--border)]/60" aria-hidden />
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--brand)] max-[1099px]:h-10 max-[1099px]:w-10"
          aria-label="Ajouter un temps de repos"
          title="Ajouter un temps de repos"
          onClick={() => insertRestAt(at)}
        >
          <IconRest size={16} />
        </button>
        <span className="h-px flex-1 bg-[var(--border)]/60" aria-hidden />
      </li>
    )
  }

  function acceptsCatalogDrop(types: readonly string[]) {
    return (
      types.includes('text/library-block-id') ||
      types.includes('text/library-exercise-id')
    )
  }

  /** Index d’insert via hit-test Y (milieu de chaque [data-slot]). */
  function resolveCatalogInsertIndex(clientY: number, listEl: HTMLElement): number {
    const items = listEl.querySelectorAll<HTMLElement>('[data-slot]')
    if (!items.length) return 0
    for (let i = 0; i < items.length; i += 1) {
      const rect = items[i]!.getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return items.length
  }

  function applyCatalogDropAt(e: ReactDragEvent, at: number) {
    const blockId = e.dataTransfer.getData('text/library-block-id').trim()
    const exerciseId = e.dataTransfer.getData('text/library-exercise-id').trim()
    if (blockId) {
      insertBlockAt(blockId, at)
      return
    }
    if (exerciseId) insertExerciseAt(exerciseId, at)
  }

  function CatalogInsertMarker() {
    return (
      <li
        className="list-none py-1"
        aria-hidden
        data-catalog-insert-marker=""
      >
        <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--brand)] bg-[var(--brand)]/15 px-2 py-1.5">
          <span className="h-px flex-1 bg-[var(--brand)]/60" />
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
            Insérer
          </span>
          <span className="h-px flex-1 bg-[var(--brand)]/60" />
        </div>
      </li>
    )
  }

  function updateSlotPrescriptions(slotKey: string, prescriptions: SessionPrescription[]) {
    setSlots((prev) => prev.map((s) => (s.key === slotKey ? { ...s, prescriptions } : s)))
  }

  function openCreateUnit(slotKey: string, idx: number) {
    setCreateUnitTarget({ slotKey, idx })
    setCreateUnitOpen(true)
  }

  return (
    <div className="grid gap-4">
      <CreateBlockDialog
        open={blockDialogOpen}
        blockId={editingBlockId}
        initial={editingBlockId ? blockDetails[editingBlockId] ?? null : null}
        candidates={blockCatalog.candidates}
        sports={blockCatalog.sports}
        units={blockCatalog.units}
        publishImmediately={sessionPublished && !editingBlockId && !programSessionId && !coachMode}
        programSessionId={programSessionId}
        coachMode={coachMode}
        onClose={() => {
          setBlockDialogOpen(false)
          setEditingBlockId(null)
        }}
        onCatalogPublished={(block) => {
          onCatalogBlockPublishedRef.current?.(block)
        }}
        onSaved={(detail) => {
          upsertBlockDetail(detail)
          onBlockDetailUpsertedRef.current?.(detail)
          const alreadyInComposition = slotsRef.current.some(
            (s) =>
              s.orphanSessionBlockId === detail.id ||
              s.blockId === detail.id,
          )
          if (alreadyInComposition) {
            // Copie programme mise à jour — dirty pour flush à la fermeture.
            initialSlotsSnap.current = '__stale_block__'
            onDirtyChangeRef.current?.(true)
            queueMicrotask(() => onSlotsChangeRef.current?.(slotsRef.current))
            return
          }
          // Library (admin/coach) : blockId. Programme : orphanSessionBlockId.
          const useLibraryId = !programSessionId
          flushSync(() => {
            setSlots((prev) => [
              ...prev,
              {
                key: newKey(),
                kind: 'block',
                ...(useLibraryId
                  ? { blockId: detail.id }
                  : { orphanSessionBlockId: detail.id }),
                prescriptions: [],
              },
            ])
          })
        }}
      />
      <CreateUnitDialog
        open={createUnitOpen}
        onClose={() => {
          setCreateUnitOpen(false)
          setCreateUnitTarget(null)
        }}
        onCreated={(unit) => {
          const next: SessionUnit = {
            id: unit.id,
            key: unit.key,
            label: unit.label,
            short_label: unit.short_label ?? null,
            value_mode: unit.value_mode,
            list_options: unit.list_options ?? null,
          }
          setUnitsState((prev) => (prev.some((u) => u.id === next.id) ? prev : [...prev, next]))
          if (createUnitTarget) {
            const { slotKey, idx } = createUnitTarget
            setSlots((prev) =>
              prev.map((s) => {
                if (s.key !== slotKey) return s
                const prescriptions = s.prescriptions.map((x, j) =>
                  j === idx
                    ? {
                        ...x,
                        unit_id: next.id,
                        input_mode: defaultInputModeForUnitKey(next.key, next.value_mode),
                        value: '',
                      }
                    : x,
                )
                return { ...s, prescriptions }
              }),
            )
          }
        }}
      />
      {!compositionOnly ? (
        <>
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
        <input
          name="name"
          required
          defaultValue={initial.name ?? ''}
          className={daFieldClass}
          placeholder="Nom de la séance"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Notes</span>
        <textarea
          name="notes"
          rows={2}
          defaultValue={initial.notes ?? ''}
          className={daFieldClass}
          placeholder="Consignes coach…"
        />
      </label>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
          Feedback client (fin de séance)
        </p>
        <p className="mt-1 text-[11px] text-[color:var(--muted)]">
          Questions posées après la séance — distinct du résultat attendu d’un bloc (score).
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-[color:var(--fg)]">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="objective_ressenti"
              defaultChecked={initial.objective_ressenti !== false}
              className="accent-[var(--brand)]"
            />
            Ressenti
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="objective_note"
              defaultChecked={initial.objective_note !== false}
              className="accent-[var(--brand)]"
            />
            Note
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              name="objective_difficulty"
              defaultChecked={initial.objective_difficulty !== false}
              className="accent-[var(--brand)]"
            />
            Difficulté (5 smileys)
          </label>
        </div>
      </section>

      {(inheritedTypes.length > 0 || inheritedSports.length > 0) && (
        <section className="grid gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Héritage (masquer si besoin)
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {inheritedSports.length ? (
              <div className="flex flex-wrap gap-1">
                <span className="mr-1 self-center text-[10px] text-[color:var(--muted)]">Sports</span>
                {inheritedSports.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setHiddenSportIds((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                      )
                    }
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                      s.hidden
                        ? 'bg-[var(--accent)] text-[color:var(--muted)] ring-[var(--border)] line-through opacity-70'
                        : 'bg-[var(--brand)] text-[var(--brand-fg)] ring-[var(--border)]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : null}
            {inheritedTypes.length ? (
              <div className="flex flex-wrap gap-1">
                <span className="mr-1 self-center text-[10px] text-[color:var(--muted)]">Types</span>
                {inheritedTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setHiddenTypeIds((prev) =>
                        prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                      )
                    }
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                      t.hidden
                        ? 'bg-[var(--accent)] text-[color:var(--muted)] ring-[var(--border)] line-through opacity-70'
                        : 'bg-[var(--brand)] text-[var(--brand-fg)] ring-[var(--border)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}
        </>
      ) : null}

      <section
        className={
          compositionOnly
            ? 'space-y-2'
            : 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm'
        }
      >
        {!compositionOnly ? (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Composition ({slots.length})
            </p>
            {!readOnly ? (
              <button
                type="button"
                onClick={openCreateBlock}
                className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
              >
                + Créer un bloc
              </button>
            ) : null}
          </div>
        ) : !readOnly ? (
          // Desktop only (CSS) — même nœud SSR/client ; tablette utilise le lien du picker.
          <div className="flex justify-end max-[1099px]:hidden">
            <button
              type="button"
              onClick={openCreateBlock}
              className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
            >
              + Créer un bloc
            </button>
          </div>
        ) : null}

        <div
          data-composition-drop={compositionOnly && !readOnly ? '' : undefined}
          className={`relative${readOnly ? ' [&_button]:hidden [&_[data-no-reorder]]:hidden' : ''}`}
          onDragEnter={
            compositionOnly && !readOnly
              ? (e) => {
                  if (!acceptsCatalogDrop(e.dataTransfer.types as string[])) return
                  e.preventDefault()
                  e.stopPropagation()
                }
              : undefined
          }
          onDragOver={
            compositionOnly && !readOnly
              ? (e) => {
                  if (!acceptsCatalogDrop(e.dataTransfer.types as string[])) return
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'copy'
                  const list = compositionListRef.current
                  if (!list || !slotsRef.current.length) {
                    setCatalogInsertIndex(0)
                    return
                  }
                  setCatalogInsertIndex(resolveCatalogInsertIndex(e.clientY, list))
                }
              : undefined
          }
          onDragLeave={
            compositionOnly && !readOnly
              ? (e) => {
                  const related = e.relatedTarget
                  if (related instanceof Node && e.currentTarget.contains(related)) return
                  setCatalogInsertIndex(null)
                }
              : undefined
          }
          onDrop={
            compositionOnly && !readOnly
              ? (e) => {
                  if (!acceptsCatalogDrop(e.dataTransfer.types as string[])) return
                  e.preventDefault()
                  e.stopPropagation()
                  const at =
                    catalogInsertIndex ??
                    (slotsRef.current.length
                      ? resolveCatalogInsertIndex(
                          e.clientY,
                          compositionListRef.current ?? e.currentTarget,
                        )
                      : 0)
                  setCatalogInsertIndex(null)
                  applyCatalogDropAt(e, at)
                }
              : undefined
          }
        >
        <ul ref={compositionListRef} className="space-y-1">
          {slots.length === 0 && compositionOnly && !readOnly ? (
            <li
              className={`list-none rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-center text-[12px] font-semibold transition ${
                catalogInsertIndex != null
                  ? 'border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]'
                  : 'border-[var(--border)] bg-[var(--page-bg)] text-[color:var(--muted)]'
              }`}
            >
              Insérer blocs / exercices
            </li>
          ) : slots.length === 0 ? (
            <li className="list-none rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-8 text-center text-[12px] text-[color:var(--muted)]">
              {readOnly
                ? 'Séance vide'
                : 'Ajoute des exercices ou des blocs via la recherche ci-dessous'}
            </li>
          ) : null}
          {slots.flatMap((slot, index) => {
            const afterRest = canShowRestInsertAfter(index) ? (
              <RestInsertButton key={`${slot.key}-rest-ins`} at={index + 1} />
            ) : null
            const beforeMarker =
              compositionOnly && catalogInsertIndex === index ? (
                <CatalogInsertMarker key={`ins-${index}`} />
              ) : null
            const compositionMarker = showCompositionInsertAt(index) ? (
              <CompositionInsertMarker key={`comp-ins-${index}`} />
            ) : null

            if (slot.kind === 'rest') {
              const sec = slot.restSeconds ?? DEFAULT_SESSION_REST_SECONDS
              const mmss = formatSecondsToMmSs(sec)
              return [
                compositionMarker,
                beforeMarker,
                <li
                  key={slot.key}
                  data-slot=""
                  className="flex list-none justify-center py-1"
                >
                  <input type="hidden" name="item_kind" value="rest" />
                  <input type="hidden" name="item_block_id" value="" />
                  <input type="hidden" name="item_orphan_session_block_id" value="" />
                  <input type="hidden" name="item_exercise_id" value="" />
                  <input
                    type="hidden"
                    name="item_prescriptions"
                    value={JSON.stringify(restPrescriptionsPayload(sec))}
                  />
                  <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-[var(--border)] bg-[var(--page-bg)] py-1 pl-3 pr-1.5">
                    <IconRest size={14} className="shrink-0 text-[color:var(--muted)]" />
                    <span className="text-xs font-semibold text-[color:var(--muted)]">Repos</span>
                    <div className="w-[5.5rem] [&>div]:!h-8 [&>div]:rounded-full [&>div_input]:px-2 [&>div_input]:text-sm">
                      <PrescriptionValueControl
                        mode="time"
                        value={mmss}
                        timeStepSec={15}
                        onChange={(v) => {
                          const parsed = parseMmSsToSeconds(v)
                          if (parsed != null) setRestSeconds(slot.key, parsed)
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <MoveButtons slotKey={slot.key} index={index} />
                      <RemoveSlotButton slotKey={slot.key} />
                    </div>
                  </div>
                </li>,
                afterRest,
              ]
            }

            if (slot.kind === 'block') {
              const reorder = getCompositionReorderProps(slot.key)
              // Copie programme prioritaire ; catalogue en aperçu pendant le fork.
              const detailKey = slot.orphanSessionBlockId ?? slot.blockId
              const b = slot.blockId ? blockById.get(slot.blockId) : null
              const detail = detailKey ? blockDetails[detailKey] : null
              const forking =
                Boolean(programSessionId) &&
                Boolean(slot.blockId) &&
                !slot.orphanSessionBlockId
              const title = detail?.name ?? b?.name ?? (forking ? 'Bloc…' : 'Bloc')
              const timerSummary = formatBlockTimerSummary(detail?.timer_note)
              const metaBits = [
                forking ? 'Préparation de la copie…' : null,
                timerSummary,
                detail?.expected_result_label
                  ? `Résultat · ${detail.expected_result_label}`
                  : null,
              ].filter(Boolean) as string[]

              return [
                compositionMarker,
                beforeMarker,
                <li
                  key={slot.key}
                  data-slot=""
                  data-composition-reorder={reorder['data-composition-reorder']}
                  className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5 transition ${reorder.className}`}
                >
                  <input type="hidden" name="item_kind" value="block" />
                  <input type="hidden" name="item_block_id" value={slot.blockId ?? ''} />
                  <input
                    type="hidden"
                    name="item_orphan_session_block_id"
                    value={slot.orphanSessionBlockId ?? ''}
                  />
                  <input type="hidden" name="item_exercise_id" value="" />
                  <input type="hidden" name="item_prescriptions" value="[]" />
                  <div className="flex items-start gap-2">
                    {showCompositionHandles ? (
                      <span {...getCompositionHandleProps(slot.key)}>
                        <IconGrip size={16} />
                      </span>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--brand)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand)]">
                          Bloc
                        </span>
                        <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--fg)]">
                          {title}
                        </span>
                      </div>
                      {metaBits.length ? (
                        <p className="mt-1 truncate text-[11px] text-[color:var(--muted)]">
                          {metaBits.join(' · ')}
                        </p>
                      ) : null}
                      {detail?.notes?.trim() ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--muted)]">
                          {detail.notes.trim()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5" data-no-reorder="">
                      {slot.orphanSessionBlockId || slot.blockId ? (
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)] max-[1099px]:h-11 max-[1099px]:w-11"
                          aria-label="Éditer le bloc"
                          title="Éditer la copie dans ce programme"
                          onClick={() => void openEditBlock(slot)}
                        >
                          <IconEdit size={14} />
                        </button>
                      ) : null}
                      <MoveButtons slotKey={slot.key} index={index} phoneHidden />
                      <RemoveSlotButton slotKey={slot.key} />
                    </div>
                  </div>

                  {detail?.exercises?.length ? (
                    <ul className="mt-2 space-y-1 border-t border-[var(--border)]/70 pt-2">
                      {detail.exercises.map((ex, exIdx) => {
                        const rxLine = formatFilledPrescriptions(
                          ex.prescriptions,
                          blockUnitById,
                        )
                        return (
                          <li
                            key={`${slot.key}-${ex.exercise_id || 'x'}-${exIdx}`}
                            className="min-w-0"
                          >
                            <div className="truncate text-[12px] font-semibold text-[color:var(--fg)]">
                              {ex.name}
                            </div>
                            {rxLine ? (
                              <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                                {rxLine}
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  ) : detail ? null : (
                    <p className="mt-2 text-[11px] text-[color:var(--muted)]">Chargement…</p>
                  )}
                </li>,
                afterRest,
              ]
            }

            const e = slot.exerciseId ? exoById.get(slot.exerciseId) : null
            const reorder = getCompositionReorderProps(slot.key)
            // Tablette (inlineCatalog) : un seul exo ouvert, comme builder V2.
            // Desktop compositionOnly : toujours ouvert.
            const isEditingExo = inlineCatalog
              ? editingExerciseKey === slot.key
              : compositionOnly || editingExerciseKey === slot.key
            const canToggleExo = inlineCatalog || !compositionOnly
            const rxGroups = groupSessionPrescriptions(slot.prescriptions)
            const collapsedLines = rxGroups
              .map(({ group, rows }) => {
                const line = formatFilledPrescriptions(rows, unitById)
                if (!line) return null
                return rxGroups.length > 1 ? `S${group + 1} · ${line}` : line
              })
              .filter(Boolean) as string[]

            function toggleExerciseOpen() {
              if (shouldSuppressCompositionClick()) return
              setEditingExerciseKey((cur) => (cur === slot.key ? null : slot.key))
            }

            return [
              compositionMarker,
              beforeMarker,
              <li
                key={slot.key}
                data-slot=""
                data-composition-reorder={reorder['data-composition-reorder']}
                className={`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 transition ${reorder.className}`}
              >
                <input type="hidden" name="item_kind" value="exercise" />
                <input type="hidden" name="item_block_id" value="" />
                <input type="hidden" name="item_orphan_session_block_id" value="" />
                <input type="hidden" name="item_exercise_id" value={slot.exerciseId ?? ''} />
                <input
                  type="hidden"
                  name="item_prescriptions"
                  value={JSON.stringify(
                    slot.prescriptions
                      .filter((p) => p.unit_id)
                      .map((p) => ({
                        ...p,
                        group: typeof p.group === 'number' ? p.group : 0,
                      })),
                  )}
                />
                <div
                  className={`flex items-start gap-2 ${
                    canToggleExo ? 'cursor-pointer rounded-[var(--radius-sm)]' : ''
                  }`}
                  role={canToggleExo ? 'button' : undefined}
                  tabIndex={canToggleExo ? 0 : undefined}
                  onClick={canToggleExo ? toggleExerciseOpen : undefined}
                  onKeyDown={
                    canToggleExo
                      ? (ev) => {
                          if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault()
                            toggleExerciseOpen()
                          }
                        }
                      : undefined
                  }
                >
                  {showCompositionHandles ? (
                    <span
                      {...getCompositionHandleProps(slot.key)}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <IconGrip size={16} />
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                        Exo
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--fg)]">
                        {e?.name ?? 'Exercice'}
                      </span>
                    </div>
                    {canToggleExo && !isEditingExo ? (
                      collapsedLines.length ? (
                        <div className="mt-1 space-y-0.5">
                          {collapsedLines.map((line, i) => (
                            <div
                              key={`${slot.key}-sum-${i}`}
                              className="truncate text-[11px] text-[color:var(--muted)]"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-[color:var(--muted)]/70">
                          Aucune prescription · cliquer pour éditer
                        </div>
                      )
                    ) : null}
                  </div>
                  <div
                    className="flex shrink-0 items-center gap-0.5 pt-0.5"
                    data-no-reorder=""
                    onClick={(ev) => ev.stopPropagation()}
                    onKeyDown={(ev) => ev.stopPropagation()}
                  >
                    <MoveButtons slotKey={slot.key} index={index} phoneHidden />
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--danger)] max-[1099px]:h-11 max-[1099px]:w-11"
                      title="Retirer"
                      aria-label="Retirer"
                      onClick={() => {
                        setSlots((p) =>
                          normalizeSessionCompositionSlots(
                            p.filter((s) => s.key !== slot.key),
                          ),
                        )
                        setEditingExerciseKey((cur) => (cur === slot.key ? null : cur))
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>

                {isEditingExo ? (
                  <div className="mt-2 space-y-2">
                    {rxGroups.map(({ group }, gIdx) => {
                      const defaultEntries = defaultUnitIds
                        .map((unitId) => {
                          const localIdx = slot.prescriptions.findIndex(
                            (p) =>
                              p.unit_id === unitId &&
                              (typeof p.group === 'number' ? p.group : 0) === group,
                          )
                          if (localIdx < 0) return null
                          const u = unitById.get(unitId)
                          return {
                            unitId,
                            idx: localIdx,
                            short: unitShortLabel(u),
                          }
                        })
                        .filter(Boolean) as Array<{ unitId: string; idx: number; short: string }>

                      const extraIndices = slot.prescriptions
                        .map((p, idx) => ({ p, idx }))
                        .filter(
                          ({ p }) =>
                            (typeof p.group === 'number' ? p.group : 0) === group &&
                            (!p.unit_id || !isDefaultUnitId(unitsState, p.unit_id)),
                        )
                        .map(({ idx }) => idx)

                      return (
                        <div
                          key={`${slot.key}-g-${group}`}
                          className={
                            gIdx > 0
                              ? 'border-t border-dashed border-[var(--border)] pt-2'
                              : undefined
                          }
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            {rxGroups.length > 1 ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                                Série {group + 1}
                              </span>
                            ) : (
                              <span />
                            )}
                            {rxGroups.length > 1 ? (
                              <button
                                type="button"
                                className="text-[10px] font-semibold text-[var(--danger)]"
                                onClick={() =>
                                  updateSlotPrescriptions(
                                    slot.key,
                                    slot.prescriptions.filter(
                                      (p) => (typeof p.group === 'number' ? p.group : 0) !== group,
                                    ),
                                  )
                                }
                              >
                                Retirer
                              </button>
                            ) : null}
                          </div>

                          {defaultEntries.length ? (
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {defaultEntries.map(({ unitId, idx, short }) => {
                                const row = slot.prescriptions[idx]
                                const u = unitById.get(unitId)
                                const kind = prescriptionUiKind(u?.key, u?.value_mode)
                                const listOpts = listOptionsForUnit(u)
                                return (
                                  <div
                                    key={`${slot.key}-g${group}-${unitId}`}
                                    className="flex min-w-0 items-center gap-0 max-[767px]:grid max-[767px]:grid-cols-[3.5rem_minmax(0,1fr)] max-[767px]:gap-x-1.5"
                                  >
                                    <span
                                      className="mr-1 shrink-0 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)] max-[767px]:mr-0 max-[767px]:truncate max-[767px]:text-center"
                                      title={short}
                                    >
                                      {short}
                                    </span>
                                    <div className="min-w-0 flex-1 max-[767px]:flex-none">
                                      {kind === 'list' ? (
                                        <PrescriptionListSelect
                                          value={row?.value ?? ''}
                                          options={listOpts}
                                          ariaLabel={short}
                                          onChange={(value) =>
                                            updateSlotPrescriptions(
                                              slot.key,
                                              slot.prescriptions.map((x, j) =>
                                                j === idx
                                                  ? { ...x, value, input_mode: 'number', group }
                                                  : x,
                                              ),
                                            )
                                          }
                                        />
                                      ) : (
                                        <PrescriptionValueControl
                                          mode={valueControlMode(kind)}
                                          value={row?.value ?? ''}
                                          onChange={(value) =>
                                            updateSlotPrescriptions(
                                              slot.key,
                                              slot.prescriptions.map((x, j) =>
                                                j === idx
                                                  ? { ...x, value, input_mode: null, group }
                                                  : x,
                                              ),
                                            )
                                          }
                                          placeholder={
                                            u?.key === 'tempo'
                                              ? '3-1-1 · contrôlé'
                                              : kind === 'time'
                                                ? 'mm:ss'
                                                : '0'
                                          }
                                        />
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : null}

                          <div className="mt-1 space-y-1">
                            {extraIndices.map((idx) => {
                              const row = slot.prescriptions[idx]
                              const u = unitById.get(row.unit_id)
                              const kind = prescriptionUiKind(u?.key, u?.value_mode)
                              const listOpts = listOptionsForUnit(u)
                              return (
                                <div
                                  key={`${slot.key}-g${group}-extra-${idx}`}
                                  className="flex min-w-0 items-center gap-1.5"
                                >
                                  <select
                                    value={row.unit_id}
                                    onChange={(ev) => {
                                      const nextId = ev.target.value
                                      if (nextId === '__create__') {
                                        openCreateUnit(slot.key, idx)
                                        return
                                      }
                                      const nextUnit = unitById.get(nextId)
                                      updateSlotPrescriptions(
                                        slot.key,
                                        slot.prescriptions.map((x, j) =>
                                          j === idx
                                            ? {
                                                ...x,
                                                unit_id: nextId,
                                                input_mode: defaultInputModeForUnitKey(
                                                  nextUnit?.key,
                                                  nextUnit?.value_mode,
                                                ),
                                                value: '',
                                                group,
                                              }
                                            : x,
                                        ),
                                      )
                                    }}
                                    className={`${daSelectClass} h-9 w-[7.5rem] max-w-[42%] shrink-0 !py-0 text-xs`}
                                  >
                                    <option value="">Unité…</option>
                                    <option value="__create__">+ Créer une unité…</option>
                                    {unitsState
                                      .filter(
                                        (x) =>
                                          !isDefaultUnitId(unitsState, x.id) || x.id === row.unit_id,
                                      )
                                      .map((x) => (
                                        <option key={x.id} value={x.id}>
                                          {x.label}
                                        </option>
                                      ))}
                                  </select>
                                  <div className="min-w-0 flex-1">
                                    {!row.unit_id ? (
                                      <PrescriptionValueControl
                                        mode="text"
                                        value={row.value}
                                        onChange={(value) =>
                                          updateSlotPrescriptions(
                                            slot.key,
                                            slot.prescriptions.map((x, j) =>
                                              j === idx ? { ...x, value, group } : x,
                                            ),
                                          )
                                        }
                                        placeholder="Choisir une unité…"
                                      />
                                    ) : kind === 'list' ? (
                                      <PrescriptionListSelect
                                        value={row.value}
                                        options={listOpts}
                                        ariaLabel={u?.label ?? 'Liste'}
                                        onChange={(value) =>
                                          updateSlotPrescriptions(
                                            slot.key,
                                            slot.prescriptions.map((x, j) =>
                                              j === idx
                                                ? { ...x, value, input_mode: 'number', group }
                                                : x,
                                            ),
                                          )
                                        }
                                      />
                                    ) : (
                                      <PrescriptionValueControl
                                        mode={valueControlMode(kind)}
                                        value={row.value}
                                        onChange={(value) =>
                                          updateSlotPrescriptions(
                                            slot.key,
                                            slot.prescriptions.map((x, j) =>
                                              j === idx
                                                ? { ...x, value, input_mode: null, group }
                                                : x,
                                            ),
                                          )
                                        }
                                        placeholder={
                                          u?.key === 'tempo' || u?.key === 'note'
                                            ? 'Note libre…'
                                            : kind === 'time'
                                              ? 'mm:ss'
                                              : '0'
                                        }
                                      />
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-7 shrink-0 items-center justify-center text-base font-semibold text-red-500 max-[1099px]:h-11 max-[1099px]:w-11"
                                    aria-label="Retirer l’unité"
                                    onClick={() =>
                                      updateSlotPrescriptions(
                                        slot.key,
                                        slot.prescriptions.filter((_, j) => j !== idx),
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                              )
                            })}
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                                onClick={() =>
                                  updateSlotPrescriptions(slot.key, [
                                    ...slot.prescriptions,
                                    { unit_id: '', value: '', input_mode: null, group },
                                  ])
                                }
                              >
                                + Unité
                              </button>
                              {gIdx === rxGroups.length - 1 ? (
                                <button
                                  type="button"
                                  className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
                                  onClick={() => {
                                    const g = nextSessionRxGroup(slot.prescriptions)
                                    const prev = Math.max(0, g - 1)
                                    const prevRows = slot.prescriptions.filter(
                                      (p) => (typeof p.group === 'number' ? p.group : 0) === prev,
                                    )
                                    const copied =
                                      prevRows.length > 0
                                        ? prevRows.map((p) => ({ ...p, group: g }))
                                        : defaultRx(unitsState, g)
                                    updateSlotPrescriptions(slot.key, [
                                      ...slot.prescriptions,
                                      ...copied,
                                    ])
                                  }}
                                >
                                  + Série
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </li>,
              afterRest,
            ]
          })}
          {showCompositionInsertAt(slots.length) ? (
            <CompositionInsertMarker key="comp-ins-end" />
          ) : null}
          {compositionOnly && !readOnly && slots.length > 0 ? (
            <li
              className={`list-none rounded-[var(--radius-md)] border border-dashed py-3 text-center text-[12px] font-semibold transition max-[1099px]:hidden ${
                catalogInsertIndex === slots.length
                  ? 'border-[var(--brand)] bg-[var(--brand)]/15 text-[var(--brand)]'
                  : 'border-[var(--border)] text-[color:var(--muted)]'
              }`}
            >
              Insérer blocs / exercices
            </li>
          ) : null}
        </ul>
        </div>

        {/* compositionOnly : picker visible seulement <1100px (CSS) — arbre DOM stable. */}
        {!readOnly ? (
        <div
          ref={wrapRef}
          className={
            compositionOnly
              ? 'relative mt-3 grid gap-2 max-[1099px]:grid min-[1100px]:hidden'
              : 'relative mt-3 grid gap-2'
          }
        >
          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={picker === 'exercise' ? undefined : 'secondary'}
              onClick={() => setPicker('exercise')}
            >
              Exercices
            </Button>
            <Button
              type="button"
              size="sm"
              variant={picker === 'block' ? undefined : 'secondary'}
              onClick={() => setPicker('block')}
            >
              Blocs
            </Button>
            {compositionOnly ? (
              <button
                type="button"
                onClick={openCreateBlock}
                className="ml-auto text-[11px] font-semibold text-[var(--brand)] hover:underline"
              >
                + Créer un bloc
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">Sport</span>
              <select
                value={filterSportId}
                onChange={(e) => {
                  setFilterSportId(e.target.value)
                  setSearchOpen(true)
                }}
                className={daSelectClass}
              >
                <option value="">Tous les sports</option>
                {catalogSports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1">
              <span className="text-[11px] font-semibold text-[color:var(--muted)]">Type</span>
              <select
                value={filterTypeId}
                onChange={(e) => {
                  setFilterTypeId(e.target.value)
                  setSearchOpen(true)
                }}
                disabled={picker !== 'exercise'}
                className={daSelectClass}
              >
                <option value="">Tous les types</option>
                {catalogTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <input
            ref={searchInputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              // Ne pas fermer la liste si un aperçu « i » est ouvert (retour focus après).
              if (reopenSearchAfterPreviewRef.current || previewTarget) return
              window.setTimeout(() => {
                if (reopenSearchAfterPreviewRef.current || previewTarget) return
                setSearchOpen(false)
              }, 150)
            }}
            placeholder={picker === 'block' ? 'Rechercher un bloc…' : 'Rechercher un exercice…'}
            className={`${daFieldClass} w-full`}
            autoComplete="off"
            enterKeyHint="search"
          />

          {showList ? (
            <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--brand)]/50 bg-[var(--surface)] shadow-da-md ring-1 ring-[var(--brand)]/20">
              <p className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--brand)]">
                {hits.length
                  ? `${hits.length} résultat${hits.length > 1 ? 's' : ''}`
                  : 'Aucun résultat'}
              </p>
              <ul
                ref={searchResultsRef}
                className="da-scrollbar max-h-52 overflow-y-auto overscroll-contain"
              >
                {picker === 'block'
                  ? (hits as SessionBlockCandidate[]).map((b) => (
                      <li
                        key={b.id}
                        className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--accent)]"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[color:var(--fg)]"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => addBlock(b.id)}
                        >
                          {b.name}
                          {b.sport_label ? (
                            <span className="ml-2 text-[10px] font-normal text-[color:var(--muted)]">
                              {b.sport_label}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-[color:var(--muted)] hover:bg-[var(--page-bg)] max-[1099px]:h-10 max-[1099px]:w-10 max-[1099px]:text-[15px]"
                          onPointerDown={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            prefetchCatalogPreview('block', b.id)
                            openCatalogPreview({
                              kind: 'block',
                              id: b.id,
                              nameHint: b.name,
                            })
                          }}
                          onPointerEnter={() => prefetchCatalogPreview('block', b.id)}
                          onFocus={() => prefetchCatalogPreview('block', b.id)}
                          title="Aperçu"
                          aria-label="Aperçu bloc"
                        >
                          i
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] max-[1099px]:h-10 max-[1099px]:w-10"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => addBlock(b.id)}
                          title="Ajouter"
                          aria-label="Ajouter le bloc"
                        >
                          <IconPlus size={16} />
                        </button>
                      </li>
                    ))
                  : (hits as SessionExerciseCandidate[]).map((ex) => (
                      <li
                        key={ex.id}
                        className="flex items-center gap-1 px-2 py-1.5 hover:bg-[var(--accent)]"
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-[color:var(--fg)]"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => addExercise(ex.id)}
                        >
                          {ex.name}
                          <span className="ml-2 text-[10px] font-normal text-[color:var(--muted)]">
                            {[ex.sport_label, ex.exercise_type_label].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[11px] font-bold text-[color:var(--muted)] hover:bg-[var(--page-bg)] max-[1099px]:h-10 max-[1099px]:w-10 max-[1099px]:text-[15px]"
                          onPointerDown={(ev) => {
                            ev.preventDefault()
                            ev.stopPropagation()
                            prefetchCatalogPreview('exercise', ex.id)
                            openCatalogPreview({
                              kind: 'exercise',
                              id: ex.id,
                              nameHint: ex.name,
                            })
                          }}
                          onPointerEnter={() => prefetchCatalogPreview('exercise', ex.id)}
                          onFocus={() => prefetchCatalogPreview('exercise', ex.id)}
                          title="Aperçu"
                          aria-label="Aperçu exercice"
                        >
                          i
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] max-[1099px]:h-10 max-[1099px]:w-10"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => addExercise(ex.id)}
                          title="Ajouter"
                          aria-label="Ajouter l’exercice"
                        >
                          <IconPlus size={16} />
                        </button>
                      </li>
                    ))}
                {!hits.length ? (
                  <li className="px-3 py-3 text-[12px] text-[color:var(--muted)]">
                    Affiner la recherche ou les filtres
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <CatalogLibraryPreviewModal
            target={previewTarget}
            onClose={closeCatalogPreview}
            onInsert={
              previewTarget
                ? () => {
                    if (previewTarget.kind === 'block') addBlock(previewTarget.id)
                    else if (previewTarget.kind === 'exercise') addExercise(previewTarget.id)
                    reopenSearchAfterPreviewRef.current = false
                    setPreviewTarget(null)
                  }
                : undefined
            }
          />
        </div>
        ) : null}
      </section>

      {!compositionOnly && !coachMode ? (
        <label className="inline-flex items-center gap-2 text-sm text-[color:var(--fg)]">
          <input
            type="checkbox"
            name="allow_duplicate"
            defaultChecked={initial.allow_duplicate !== false}
            className="accent-[var(--brand)]"
          />
          Duplicable (coach peut récupérer une copie)
        </label>
      ) : null}
      {!compositionOnly && coachMode ? (
        <input type="hidden" name="allow_duplicate" value="on" />
      ) : null}

      {hiddenTypeIds.map((id) => (
        <input key={`ht-${id}`} type="hidden" name="hidden_type_ids" value={id} />
      ))}
      {hiddenSportIds.map((id) => (
        <input key={`hs-${id}`} type="hidden" name="hidden_sport_ids" value={id} />
      ))}
    </div>
  )
}
