'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { BlockTimerDialog } from '@/src/components/admin/BlockTimerDialog'
import { CreateUnitDialog } from '@/src/components/admin/CreateUnitDialog'
import {
  PrescriptionListSelect,
  PrescriptionValueControl,
} from '@/src/components/admin/PrescriptionValueControl'
import { daFieldClass, daSelectClass } from '@/src/components/ui'
import {
  unitIsTextLocked,
  type ExercisePrescription,
  type UnitRow,
  type UnitValueMode,
} from '@/src/lib/blocks/constants'
import {
  listOptionsForUnit,
  prescriptionUiKind,
  valueControlMode,
} from '@/src/lib/catalog/prescriptionUi'
import { BLOCK_EXERCISE_RX_KEYS, unitShortLabel } from '@/src/lib/catalog/rxPresets'
import {
  parseTimerConfig,
  serializeTimerConfig,
  summarizeTimerConfig,
  type BlockTimerConfig,
} from '@/src/lib/blocks/timerConfig'

export type BlockExerciseCandidate = {
  id: string
  name: string
  exercise_type_id: string | null
  exercise_type_label: string | null
  sport_id: string | null
  sport_label: string | null
  muscle_group: string | null
}

type Sport = { id: string; label: string }
type Unit = UnitRow
type Slot = { key: string; exerciseId: string; prescriptions: ExercisePrescription[] }

type Props = {
  candidates: BlockExerciseCandidate[]
  sports: Sport[]
  units: Unit[]
  /** Masquer « Duplicable » (modal séance). */
  showDuplicate?: boolean
  /**
   * Modal séance : nom + sport + résultat attendu + ≥1 exo obligatoires
   * (équivalent publish d’un bloc catalogue).
   */
  requireComplete?: boolean
  initial: {
    name?: string
    notes?: string
    timer_note?: string
    sport_id?: string
    expected_result_unit_id?: string
    allow_duplicate?: boolean
    exercise_ids?: string[]
    exercise_prescriptions?: ExercisePrescription[][]
    hidden_type_ids?: string[]
  }
}

function newSlotKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const DEFAULT_RX_KEYS = BLOCK_EXERCISE_RX_KEYS


function unitByKey(units: Unit[], key: string) {
  return units.find((u) => u.key === key) ?? null
}

function defaultPrescriptions(units: Unit[]): ExercisePrescription[] {
  const out: ExercisePrescription[] = []
  for (const key of DEFAULT_RX_KEYS) {
    const u = unitByKey(units, key)
    if (u) out.push({ unit_id: u.id, value: '', input_mode: null })
  }
  return out
}

/** Garantit reps / charge / cal en tête, le reste en extras. */
function ensureDefaultPrescriptions(
  existing: ExercisePrescription[] | undefined,
  units: Unit[],
): ExercisePrescription[] {
  const list = Array.isArray(existing) ? existing : []
  const byId = new Map(list.filter((p) => p.unit_id).map((p) => [p.unit_id, p]))
  const defaults = DEFAULT_RX_KEYS.map((key) => {
    const u = unitByKey(units, key)
    if (!u) return null
    return byId.get(u.id) ?? { unit_id: u.id, value: '', input_mode: null }
  }).filter((p): p is ExercisePrescription => Boolean(p))
  const defaultIds = new Set(defaults.map((d) => d.unit_id))
  const extras = list.filter((p) => p.unit_id && !defaultIds.has(p.unit_id))
  return [...defaults, ...extras]
}

function isDefaultUnitId(units: Unit[], unitId: string) {
  return DEFAULT_RX_KEYS.some((key) => unitByKey(units, key)?.id === unitId)
}

function ExoRow({
  slot,
  index,
  total,
  name,
  units,
  onRemove,
  onMove,
  onChangePrescriptions,
  onRequestCreateUnit,
}: {
  slot: Slot
  index: number
  total: number
  name: string
  units: Unit[]
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onChangePrescriptions: (next: ExercisePrescription[]) => void
  onRequestCreateUnit: (prescriptionIdx: number) => void
}) {
  function updateRow(idx: number, patch: Partial<ExercisePrescription>) {
    onChangePrescriptions(
      slot.prescriptions.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    )
  }

  const defaultEntries = DEFAULT_RX_KEYS.map((key) => {
    const unit = unitByKey(units, key)
    if (!unit) return null
    const idx = slot.prescriptions.findIndex((p) => p.unit_id === unit.id)
    if (idx < 0) return null
    return { key, unit, idx, row: slot.prescriptions[idx] }
  }).filter(Boolean) as Array<{
    key: (typeof DEFAULT_RX_KEYS)[number]
    unit: Unit
    idx: number
    row: ExercisePrescription
  }>

  const extraIndices = slot.prescriptions
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.unit_id && !isDefaultUnitId(units, p.unit_id))
    .map(({ idx }) => idx)

  // Lignes extras + slots vides (unit_id '')
  const extraOrEmptyIndices = [
    ...extraIndices,
    ...slot.prescriptions
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => !p.unit_id)
      .map(({ idx }) => idx),
  ]

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            className="h-6 w-7 rounded text-[11px] font-bold text-[color:var(--fg)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-30"
            aria-label="Monter"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => onMove(1)}
            className="h-6 w-7 rounded text-[11px] font-bold text-[color:var(--fg)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] disabled:opacity-30"
            aria-label="Descendre"
          >
            ↓
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-[color:var(--fg)]">
              <span className="mr-1.5 text-[color:var(--muted)]">{index + 1}.</span>
              {name}
            </p>
            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 text-[11px] font-semibold text-red-500 hover:underline"
            >
              Retirer
            </button>
          </div>

          {defaultEntries.length ? (
            <div className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-3 sm:gap-x-2.5 sm:gap-y-1">
              {defaultEntries.map(({ key, unit, idx, row }) => {
                const kind = prescriptionUiKind(unit.key, unit.value_mode)
                const listOpts = listOptionsForUnit(unit)
                return (
                  <div key={key} className="flex min-w-0 items-center gap-0">
                    <span className="mr-1 shrink-0 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                      {unitShortLabel(unit)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {kind === 'list' ? (
                        <PrescriptionListSelect
                          value={row.value}
                          options={listOpts}
                          ariaLabel={unitShortLabel(unit)}
                          onChange={(value) => updateRow(idx, { value, input_mode: null })}
                        />
                      ) : (
                        <PrescriptionValueControl
                          mode={valueControlMode(kind)}
                          value={row.value}
                          onChange={(value) => updateRow(idx, { value, input_mode: null })}
                          placeholder={kind === 'time' ? 'mm:ss' : '0'}
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          <div className="mt-1.5 space-y-1">
            {extraOrEmptyIndices.map((idx) => {
              const row = slot.prescriptions[idx]
              const unit = units.find((u) => u.id === row.unit_id)
              const kind = prescriptionUiKind(unit?.key, unit?.value_mode)
              const listOpts = listOptionsForUnit(unit)
              const mode = !row.unit_id
                ? 'text'
                : unitIsTextLocked(unit)
                  ? 'text'
                  : valueControlMode(kind)

              return (
                <div key={idx} className="flex min-w-0 items-center gap-1.5">
                  <select
                    value={row.unit_id}
                    onChange={(e) => {
                      const nextId = e.target.value
                      if (nextId === '__create__') {
                        onRequestCreateUnit(idx)
                        return
                      }
                      updateRow(idx, {
                        unit_id: nextId,
                        input_mode: null,
                        value: '',
                      })
                    }}
                    className={`${daFieldClass} h-9 w-[7.25rem] max-w-[40%] shrink-0 appearance-none box-border !py-0 pr-8 text-xs bg-[length:0.85rem_0.85rem] bg-[right_0.5rem_center] bg-no-repeat bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 24 24%27 stroke=%27%23a3a3a8%27 stroke-width=%272%27%3E%3Cpath stroke-linecap=%27round%27 stroke-linejoin=%27round%27 d=%27M19 9l-7 7-7-7%27/%3E%3C/svg%3E')]`}
                  >
                    <option value="">Unité…</option>
                    <option value="__create__">+ Créer une unité…</option>
                    {units
                      .filter((u) => !isDefaultUnitId(units, u.id) || u.id === row.unit_id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.label}
                        </option>
                      ))}
                  </select>

                  <div className="min-w-0 flex-1 basis-0">
                    {!row.unit_id ? (
                      <PrescriptionValueControl
                        mode="text"
                        value={row.value}
                        onChange={(value) => updateRow(idx, { value, input_mode: null })}
                        placeholder="Choisir une unité…"
                      />
                    ) : kind === 'list' ? (
                      <PrescriptionListSelect
                        value={row.value}
                        options={listOpts}
                        ariaLabel={unit?.label ?? 'Liste'}
                        onChange={(value) => updateRow(idx, { value, input_mode: null })}
                      />
                    ) : (
                      <PrescriptionValueControl
                        mode={mode}
                        value={row.value}
                        onChange={(value) => updateRow(idx, { value, input_mode: null })}
                        placeholder={
                          unit?.key === 'note'
                            ? 'Note libre…'
                            : mode === 'time'
                              ? 'mm:ss'
                              : '0'
                        }
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-9 w-7 shrink-0 items-center justify-center text-sm font-semibold text-red-500 hover:bg-[var(--accent)]"
                    aria-label="Retirer l’unité"
                    onClick={() =>
                      onChangePrescriptions(slot.prescriptions.filter((_, i) => i !== idx))
                    }
                  >
                    ×
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              className="text-[11px] font-semibold text-[var(--brand)] hover:underline"
              onClick={() =>
                onChangePrescriptions([
                  ...slot.prescriptions,
                  { unit_id: '', value: '', input_mode: null },
                ])
              }
            >
              + Unité
            </button>
          </div>
        </div>
      </div>

      <input type="hidden" name="exercise_ids" value={slot.exerciseId} />
      <input
        type="hidden"
        name="exercise_prescriptions"
        value={JSON.stringify(slot.prescriptions.filter((p) => p.unit_id))}
      />
    </li>
  )
}

export function BlockFicheEditor({
  candidates,
  sports,
  units,
  initial,
  showDuplicate = true,
  requireComplete = false,
}: Props) {
  const [slots, setSlots] = useState<Slot[]>(() =>
    (initial.exercise_ids ?? []).map((exerciseId, i) => ({
      key: newSlotKey(),
      exerciseId,
      prescriptions: ensureDefaultPrescriptions(initial.exercise_prescriptions?.[i], units),
    })),
  )
  const [unitsState, setUnitsState] = useState<Unit[]>(() => units)
  const [createUnitOpen, setCreateUnitOpen] = useState(false)
  const [createUnitTarget, setCreateUnitTarget] = useState<{
    slotKey: string
    idx: number
  } | null>(null)
  const [hiddenTypeIds, setHiddenTypeIds] = useState<string[]>(initial.hidden_type_ids ?? [])
  const [sportId, setSportId] = useState(initial.sport_id ?? '')
  const [timerConfig, setTimerConfig] = useState<BlockTimerConfig | null>(() =>
    parseTimerConfig(initial.timer_note),
  )
  const [timerOpen, setTimerOpen] = useState(false)
  const [filterSportId, setFilterSportId] = useState('')
  const [filterTypeId, setFilterTypeId] = useState('')
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUnitsState((prev) => {
      const map = new Map(prev.map((u) => [u.id, u]))
      for (const u of units) map.set(u.id, u)
      return [...map.values()]
    })
  }, [units])

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])

  const catalogTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of candidates) {
      if (c.exercise_type_id && c.exercise_type_label) {
        map.set(c.exercise_type_id, c.exercise_type_label)
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  }, [candidates])

  const selected = slots
    .map((s) => ({ slot: s, exo: byId.get(s.exerciseId) }))
    .filter((x): x is { slot: Slot; exo: BlockExerciseCandidate } => Boolean(x.exo))

  const inheritedTypes = useMemo(() => {
    const map = new Map<string, string>()
    for (const { exo } of selected) {
      if (exo.exercise_type_id && exo.exercise_type_label) {
        map.set(exo.exercise_type_id, exo.exercise_type_label)
      }
    }
    return [...map.entries()].map(([id, label]) => ({
      id,
      label,
      hidden: hiddenTypeIds.includes(id),
    }))
  }, [selected, hiddenTypeIds])

  const activeHidden = hiddenTypeIds.filter((id) => inheritedTypes.some((t) => t.id === id))

  const suggestedSportId = useMemo(() => {
    const ids = selected.map(({ exo }) => exo.sport_id).filter(Boolean) as string[]
    if (!ids.length) return null
    const first = ids[0]
    return ids.every((id) => id === first) ? first : null
  }, [selected])

  const searchHits = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return candidates
      .filter((c) => {
        if (filterSportId && c.sport_id !== filterSportId) return false
        if (filterTypeId && c.exercise_type_id !== filterTypeId) return false
        if (qq && !c.name.toLowerCase().includes(qq)) return false
        return true
      })
      .slice(0, 20)
  }, [candidates, q, filterSportId, filterTypeId])

  const showSearchList =
    searchOpen && (q.trim().length > 0 || Boolean(filterSportId) || Boolean(filterTypeId))

  function addExo(exerciseId: string) {
    setSlots((prev) => {
      const next = [
        ...prev,
        {
          key: newSlotKey(),
          exerciseId,
          prescriptions: defaultPrescriptions(units),
        },
      ]
      if (!sportId) {
        const nextExos = next
          .map((s) => byId.get(s.exerciseId))
          .filter(Boolean) as BlockExerciseCandidate[]
        const ids = nextExos.map((x) => x.sport_id).filter(Boolean) as string[]
        if (ids.length && ids.every((s) => s === ids[0])) {
          setSportId(ids[0])
        }
      }
      return next
    })
    setQ('')
    setSearchOpen(false)
  }

  function moveSlot(key: string, dir: -1 | 1) {
    setSlots((prev) => {
      const i = prev.findIndex((s) => s.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const copy = [...prev]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  return (
    <div className="grid gap-4">
      {/* Header compact */}
      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
        <input name="name" required defaultValue={initial.name ?? ''} className={daFieldClass} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">Sport *</span>
          <select
            name="sport_id"
            required
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className={daSelectClass}
          >
            <option value="" disabled>
              Sélectionner…
            </option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {!sportId && suggestedSportId ? (
            <button
              type="button"
              className="text-left text-[11px] font-semibold text-[var(--brand)] hover:underline"
              onClick={() => setSportId(suggestedSportId)}
            >
              Appliquer le sport des exos
            </button>
          ) : null}
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-[color:var(--muted)]">
            Résultat attendu *
          </span>
          <select
            name="expected_result_unit_id"
            required={requireComplete}
            defaultValue={initial.expected_result_unit_id ?? ''}
            className={daSelectClass}
          >
            <option value="" disabled>
              Unité client…
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[color:var(--muted)]">
            Score que le client saisit en fin de bloc (ex. rounds, temps, reps).
          </span>
        </label>
      </div>

      <div className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">
          Minuteur / intervalle
        </span>
        <input type="hidden" name="timer_note" value={serializeTimerConfig(timerConfig)} />
        <button
          type="button"
          onClick={() => setTimerOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5 text-left hover:bg-[var(--accent)]"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--fg)]">
              {summarizeTimerConfig(timerConfig)}
            </span>
            <span className="mt-0.5 block text-[11px] text-[color:var(--muted)]">
              {timerConfig ? 'Modifier la config' : 'Choisir minuteur, timer ou circuit'}
            </span>
          </span>
          <span className="shrink-0 text-xs font-bold text-[var(--brand)]">Configurer</span>
        </button>
        <BlockTimerDialog
          open={timerOpen}
          initial={timerConfig}
          onClose={() => setTimerOpen(false)}
          onSave={setTimerConfig}
        />
      </div>

      <label className="grid gap-1">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Notes</span>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ''}
          className={daFieldClass}
          placeholder="Consignes, scaling, remarques…"
        />
      </label>

      {/* Exos — centre */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
            Exercices ({slots.length}){requireComplete ? ' *' : ''}
          </p>
          {inheritedTypes.length ? (
            <div className="flex flex-wrap justify-end gap-1">
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
                  title={t.hidden ? 'Réafficher le type' : 'Masquer le type'}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ul className="space-y-2">
          {selected.map(({ slot, exo }, index) => (
            <ExoRow
              key={slot.key}
              slot={slot}
              index={index}
              total={slots.length}
              name={exo.name}
              units={unitsState}
              onRemove={() => setSlots((prev) => prev.filter((s) => s.key !== slot.key))}
              onMove={(dir) => moveSlot(slot.key, dir)}
              onChangePrescriptions={(prescriptions) =>
                setSlots((prev) =>
                  prev.map((s) => (s.key === slot.key ? { ...s, prescriptions } : s)),
                )
              }
              onRequestCreateUnit={(idx) => {
                setCreateUnitTarget({ slotKey: slot.key, idx })
                setCreateUnitOpen(true)
              }}
            />
          ))}
          {!slots.length ? (
            <li className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] py-8 text-center text-[12px] text-[color:var(--muted)]">
              Ajoute des exercices via la recherche ci-dessous
            </li>
          ) : null}
        </ul>

        <div ref={searchWrapRef} className="relative mt-3 grid gap-2">
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
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSearchOpen(false), 150)
            }}
            placeholder="Rechercher un exercice…"
            className={`${daFieldClass} w-full`}
            autoComplete="off"
          />
          {showSearchList ? (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
              {searchHits.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--accent)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addExo(c.id)}
                  >
                    <span className="truncate text-sm font-semibold text-[color:var(--fg)]">
                      {c.name}
                    </span>
                    <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                      {[c.sport_label, c.exercise_type_label].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
              {!searchHits.length ? (
                <li className="px-3 py-2 text-[12px] text-[color:var(--muted)]">Aucun résultat</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      </section>

      {activeHidden.map((id) => (
        <input key={id} type="hidden" name="hidden_type_ids" value={id} />
      ))}

      <CreateUnitDialog
        open={createUnitOpen}
        onClose={() => {
          setCreateUnitOpen(false)
          setCreateUnitTarget(null)
        }}
        onCreated={(unit) => {
          const next: Unit = {
            id: unit.id,
            key: unit.key,
            label: unit.label,
            short_label: unit.short_label ?? null,
            value_mode:
              unit.value_mode === 'time' ||
              unit.value_mode === 'text' ||
              unit.value_mode === 'list' ||
              unit.value_mode === 'number'
                ? unit.value_mode
                : 'number',
            list_options: unit.list_options ?? null,
          }
          setUnitsState((prev) => (prev.some((u) => u.id === next.id) ? prev : [...prev, next]))
          if (createUnitTarget) {
            const { slotKey, idx } = createUnitTarget
            setSlots((prev) =>
              prev.map((s) => {
                if (s.key !== slotKey) return s
                return {
                  ...s,
                  prescriptions: s.prescriptions.map((p, j) =>
                    j === idx ? { ...p, unit_id: next.id, value: '', input_mode: null } : p,
                  ),
                }
              }),
            )
          }
        }}
      />

      {showDuplicate ? (
        <label className="inline-flex items-center gap-2 text-sm text-[color:var(--fg)]">
          <input
            type="checkbox"
            name="allow_duplicate"
            defaultChecked={initial.allow_duplicate !== false}
            className="accent-[var(--brand)]"
          />
          Duplicable
        </label>
      ) : (
        <input type="hidden" name="allow_duplicate" value="1" />
      )}
    </div>
  )
}
