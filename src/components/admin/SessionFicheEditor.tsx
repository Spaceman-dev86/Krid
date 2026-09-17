'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import {
  PrescriptionListSelect,
  PrescriptionValueControl,
} from '@/src/components/admin/PrescriptionValueControl'
import { CreateBlockDialog } from '@/src/components/admin/CreateBlockDialog'
import { CreateUnitDialog } from '@/src/components/admin/CreateUnitDialog'
import { Button, IconEdit, IconRest, daFieldClass, daSelectClass } from '@/src/components/ui'
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
  initial = {},
}: Props) {
  const [slots, setSlots] = useState<SessionSlot[]>(() => initial.slots ?? [])
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
  const wrapRef = useRef<HTMLDivElement>(null)
  const fetchingBlocks = useRef<Set<string>>(new Set())

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

  async function ensureBlockDetail(blockId: string): Promise<SessionBlockDetail | null> {
    if (!blockId) return null
    if (blockDetails[blockId]) return blockDetails[blockId]
    if (fetchingBlocks.current.has(blockId)) return null
    fetchingBlocks.current.add(blockId)
    try {
      const res = await fetch(`/api/admin/blocks/${blockId}`)
      const json = (await res.json().catch(() => ({}))) as {
        block?: SessionBlockDetail
      }
      if (res.ok && json.block) {
        upsertBlockDetail(json.block)
        return json.block
      }
      return null
    } catch {
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
      if (slot.kind === 'block' && slot.blockId && !blockDetails[slot.blockId]) {
        void ensureBlockDetail(slot.blockId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate missing details only
  }, [slots, blockDetails])

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
      return publishedBlocks
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
  }, [picker, publishedBlocks, exercises, filterSportId, filterTypeId, q])

  const showList =
    searchOpen && (q.trim().length > 0 || Boolean(filterSportId) || Boolean(filterTypeId))

  function addBlock(id: string) {
    setSlots((prev) => [...prev, { key: newKey(), kind: 'block', blockId: id, prescriptions: [] }])
    setQ('')
    setSearchOpen(false)
    void ensureBlockDetail(id)
  }

  function addExercise(id: string) {
    const key = newKey()
    setSlots((prev) => [
      ...prev,
      { key, kind: 'exercise', exerciseId: id, prescriptions: defaultRx(unitsState) },
    ])
    setEditingExerciseKey(key)
    setQ('')
    setSearchOpen(false)
  }

  function openCreateBlock() {
    setEditingBlockId(null)
    setBlockDialogOpen(true)
  }

  async function openEditBlock(blockId: string) {
    setEditingBlockId(blockId)
    const detail = blockDetails[blockId] ?? (await ensureBlockDetail(blockId))
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
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[var(--brand)]"
          aria-label="Ajouter un temps de repos"
          title="Ajouter un temps de repos"
          onClick={() => insertRestAt(at)}
        >
          <IconRest size={11} />
        </button>
        <span className="h-px flex-1 bg-[var(--border)]/60" aria-hidden />
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
        publishImmediately={sessionPublished && !editingBlockId}
        onClose={() => {
          setBlockDialogOpen(false)
          setEditingBlockId(null)
        }}
        onSaved={(detail) => {
          upsertBlockDetail(detail)
          setSlots((prev) => {
            if (prev.some((s) => s.blockId === detail.id)) return prev
            return [
              ...prev,
              { key: newKey(), kind: 'block', blockId: detail.id, prescriptions: [] },
            ]
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
        </section>
      )}
        </>
      ) : null}

      <section className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm ${compositionOnly ? '' : ''}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Composition ({slots.length})
          </p>
          <button
            type="button"
            onClick={openCreateBlock}
            className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
          >
            + Créer un bloc
          </button>
        </div>

        <ul className="space-y-1">
          {slots.flatMap((slot, index) => {
            const after = canShowRestInsertAfter(index) ? (
              <RestInsertButton key={`${slot.key}-rest-ins`} at={index + 1} />
            ) : null

            if (slot.kind === 'rest') {
              const sec = slot.restSeconds ?? DEFAULT_SESSION_REST_SECONDS
              const mmss = formatSecondsToMmSs(sec)
              return [
                <li key={slot.key} className="flex list-none justify-center py-1">
                  <input type="hidden" name="item_kind" value="rest" />
                  <input type="hidden" name="item_block_id" value="" />
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
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        className="px-0.5 text-xs leading-none text-[color:var(--muted)]"
                        onClick={() => move(slot.key, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-0.5 text-xs leading-none text-[color:var(--muted)]"
                        onClick={() => move(slot.key, 1)}
                        disabled={index === slots.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="px-1.5 text-xs font-bold leading-none text-[var(--danger)]"
                        onClick={() => setSlots((p) => normalizeSessionCompositionSlots(p.filter((s) => s.key !== slot.key)))}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </li>,
                after,
              ]
            }

            if (slot.kind === 'block') {
              const b = slot.blockId ? blockById.get(slot.blockId) : null
              const detail = slot.blockId ? blockDetails[slot.blockId] : null
              const title = detail?.name ?? b?.name ?? 'Bloc'
              const timerSummary = formatBlockTimerSummary(detail?.timer_note)
              const metaBits = [
                timerSummary,
                detail?.expected_result_label
                  ? `Résultat · ${detail.expected_result_label}`
                  : null,
              ].filter(Boolean) as string[]

              return [
                <li
                  key={slot.key}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5"
                >
                  <input type="hidden" name="item_kind" value="block" />
                  <input type="hidden" name="item_block_id" value={slot.blockId ?? ''} />
                  <input type="hidden" name="item_exercise_id" value="" />
                  <input type="hidden" name="item_prescriptions" value="[]" />
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--muted)]">
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
                    <div className="flex shrink-0 items-center gap-1">
                      {slot.blockId ? (
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                          aria-label="Éditer le bloc"
                          title="Éditer le bloc"
                          onClick={() => openEditBlock(slot.blockId!)}
                        >
                          <IconEdit size={14} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-[color:var(--muted)]"
                        onClick={() => move(slot.key, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="text-xs text-[color:var(--muted)]"
                        onClick={() => move(slot.key, 1)}
                        disabled={index === slots.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-xs font-bold text-[var(--danger)]"
                        onClick={() => setSlots((p) => normalizeSessionCompositionSlots(p.filter((s) => s.key !== slot.key)))}
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {detail?.exercises?.length ? (
                    <ul className="mt-2 space-y-1.5 border-t border-[var(--border)]/70 pt-2">
                      {detail.exercises.map((ex) => {
                        const rxLine = formatFilledPrescriptions(
                          ex.prescriptions,
                          blockUnitById,
                        )
                        return (
                          <li key={`${slot.key}-${ex.exercise_id}`} className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[var(--brand)]">
                              {ex.name}
                            </div>
                            {rxLine ? (
                              <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">
                                {rxLine}
                              </div>
                            ) : (
                              <div className="mt-0.5 text-[11px] text-[color:var(--muted)]/70">
                                Aucune prescription
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : detail ? (
                    <p className="mt-2 border-t border-[var(--border)]/70 pt-2 text-[11px] text-[color:var(--muted)]">
                      Aucun exercice dans ce bloc
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] text-[color:var(--muted)]">Chargement…</p>
                  )}
                </li>,
                after,
              ]
            }

            const e = slot.exerciseId ? exoById.get(slot.exerciseId) : null
            const isEditingExo = editingExerciseKey === slot.key
            const rxGroups = groupSessionPrescriptions(slot.prescriptions)
            const collapsedLines = rxGroups
              .map(({ group, rows }) => {
                const line = formatFilledPrescriptions(rows, unitById)
                if (!line) return null
                return rxGroups.length > 1 ? `S${group + 1} · ${line}` : line
              })
              .filter(Boolean) as string[]

            return [
              <li
                key={slot.key}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2"
              >
                <input type="hidden" name="item_kind" value="exercise" />
                <input type="hidden" name="item_block_id" value="" />
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
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() =>
                      setEditingExerciseKey((cur) => (cur === slot.key ? null : slot.key))
                    }
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--muted)]">
                        Exo
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-[color:var(--fg)]">
                        {e?.name ?? 'Exercice'}
                      </span>
                    </div>
                    {!isEditingExo ? (
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
                  </button>
                  <div className="flex shrink-0 gap-1 pt-0.5">
                    <button
                      type="button"
                      className="text-xs text-[color:var(--muted)]"
                      onClick={() => move(slot.key, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-[color:var(--muted)]"
                      onClick={() => move(slot.key, 1)}
                      disabled={index === slots.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="text-xs font-bold text-[var(--danger)]"
                      onClick={() => {
                        setSlots((p) => normalizeSessionCompositionSlots(p.filter((s) => s.key !== slot.key)))
                        setEditingExerciseKey((cur) => (cur === slot.key ? null : cur))
                      }}
                    >
                      ×
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
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                              {rxGroups.length > 1 ? `Séries ${group + 1}` : 'Prescription'}
                            </span>
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
                            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-x-2.5 sm:gap-y-1">
                              {defaultEntries.map(({ unitId, idx, short }) => {
                                const row = slot.prescriptions[idx]
                                const u = unitById.get(unitId)
                                const kind = prescriptionUiKind(u?.key, u?.value_mode)
                                const listOpts = listOptionsForUnit(u)
                                return (
                                  <div
                                    key={`${slot.key}-g${group}-${unitId}`}
                                    className="flex min-w-0 items-center gap-0"
                                  >
                                    <span className="mr-1 shrink-0 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                                      {short}
                                    </span>
                                    <div className="min-w-0 flex-1">
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
                                    className="inline-flex h-9 w-7 shrink-0 items-center justify-center text-sm font-semibold text-red-500"
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
                                  + Séries
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
              after,
            ]
          })}
          {!slots.length ? (
            <li className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-6 text-center text-[12px] text-[color:var(--muted)]">
              {compositionOnly
                ? 'Glisser un bloc / exo depuis le catalogue'
                : 'Ajoute des blocs publiés ou des exercices ci-dessous'}
            </li>
          ) : null}
        </ul>

        {!compositionOnly ? (
        <div ref={wrapRef} className="relative mt-3 grid gap-2">
          <div className="flex flex-wrap gap-1">
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
              Blocs publiés
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
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
            {picker === 'exercise' ? (
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-[color:var(--muted)]">Type</span>
                <select
                  value={filterTypeId}
                  onChange={(e) => {
                    setFilterTypeId(e.target.value)
                    setSearchOpen(true)
                  }}
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
            ) : (
              <div />
            )}
          </div>

          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
            placeholder={picker === 'block' ? 'Rechercher un bloc…' : 'Rechercher un exercice…'}
            className={`${daFieldClass} w-full`}
            autoComplete="off"
          />

          {showList ? (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
              {picker === 'block'
                ? (hits as SessionBlockCandidate[]).map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--accent)]"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addBlock(b.id)}
                      >
                        <span className="truncate text-sm font-semibold">{b.name}</span>
                        <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                          {b.sport_label}
                        </span>
                      </button>
                    </li>
                  ))
                : (hits as SessionExerciseCandidate[]).map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--accent)]"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => addExercise(e.id)}
                      >
                        <span className="truncate text-sm font-semibold">{e.name}</span>
                        <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                          {[e.sport_label, e.exercise_type_label].filter(Boolean).join(' · ')}
                        </span>
                      </button>
                    </li>
                  ))}
              {!hits.length ? (
                <li className="px-3 py-2 text-[12px] text-[color:var(--muted)]">Aucun résultat</li>
              ) : null}
            </ul>
          ) : null}
        </div>
        ) : null}
      </section>

      {!compositionOnly ? (
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

      {hiddenTypeIds.map((id) => (
        <input key={`ht-${id}`} type="hidden" name="hidden_type_ids" value={id} />
      ))}
      {hiddenSportIds.map((id) => (
        <input key={`hs-${id}`} type="hidden" name="hidden_sport_ids" value={id} />
      ))}
    </div>
  )
}
