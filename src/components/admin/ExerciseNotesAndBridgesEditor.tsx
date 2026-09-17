'use client'

import { useMemo, useRef, useState } from 'react'

import { Button, daFieldClass, daSelectClass } from '@/src/components/ui'

export type FicheNote = { title: string; body: string }
export type FicheBridge = {
  title: string
  note: string
  exerciseId: string
}

export type ReplacementCandidate = {
  id: string
  name: string
  exercise_type_id?: string | null
  sport_id?: string | null
}

type FilterOption = { id: string; label: string }

type Props = {
  candidates: ReplacementCandidate[]
  types?: FilterOption[]
  sports?: FilterOption[]
  initialNotes?: FicheNote[]
  initialBridges?: FicheBridge[]
  excludeId?: string | null
}

function isEmptyNote(n: FicheNote) {
  return !n.title.trim() && !n.body.trim()
}

function isEmptyBridge(b: FicheBridge) {
  return !b.title.trim() && !b.note.trim() && !b.exerciseId
}

type BridgePickerProps = {
  bridgeIndex: number
  exerciseId: string
  candidates: ReplacementCandidate[]
  types: FilterOption[]
  sports: FilterOption[]
  onSelect: (exerciseId: string) => void
  onClear: () => void
}

function BridgeExercisePicker({
  bridgeIndex,
  exerciseId,
  candidates,
  types,
  sports,
  onSelect,
  onClear,
}: BridgePickerProps) {
  const [filterTypeId, setFilterTypeId] = useState('')
  const [filterSportId, setFilterSportId] = useState('')
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const typeLabel = useMemo(() => new Map(types.map((t) => [t.id, t.label])), [types])
  const sportLabel = useMemo(() => new Map(sports.map((s) => [s.id, s.label])), [sports])

  const selected = candidates.find((c) => c.id === exerciseId) ?? null

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return candidates
      .filter((c) => {
        if (filterTypeId && c.exercise_type_id !== filterTypeId) return false
        if (filterSportId && c.sport_id !== filterSportId) return false
        if (needle && !c.name.toLowerCase().includes(needle)) return false
        return true
      })
      .slice(0, 40)
  }, [candidates, filterTypeId, filterSportId, q])

  const showList =
    searchOpen && !selected && (q.trim().length > 0 || Boolean(filterTypeId) || Boolean(filterSportId))

  return (
    <div ref={wrapRef} className="relative grid gap-2">
      <input type="hidden" name="bridge_exercise_ids" value={exerciseId} />

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--fg)]">{selected.name}</p>
            <p className="truncate text-[10px] text-[color:var(--muted)]">
              {[
                selected.sport_id ? sportLabel.get(selected.sport_id) : null,
                selected.exercise_type_id ? typeLabel.get(selected.exercise_type_id) : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Exercice de remplacement'}
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onClear}>
            Changer
          </Button>
        </div>
      ) : (
        <>
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
                {types.map((t) => (
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
            aria-label={`Recherche exercice pont ${bridgeIndex + 1}`}
          />

          {showList ? (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
              {hits.length ? (
                hits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--accent)]"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(c.id)
                        setQ('')
                        setSearchOpen(false)
                      }}
                    >
                      <span className="truncate text-sm font-semibold text-[color:var(--fg)]">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                        {[
                          c.sport_id ? sportLabel.get(c.sport_id) : null,
                          c.exercise_type_id ? typeLabel.get(c.exercise_type_id) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-2 text-[12px] text-[color:var(--muted)]">Aucun exercice</li>
              )}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}

/** Bas de fiche : 2 boutons — Note · Pont d’exercice. */
export function ExerciseNotesAndBridgesEditor({
  candidates,
  types = [],
  sports = [],
  initialNotes = [],
  initialBridges = [],
  excludeId = null,
}: Props) {
  const [notes, setNotes] = useState<FicheNote[]>(initialNotes)
  const [bridges, setBridges] = useState<FicheBridge[]>(initialBridges)

  const baseOptions = useMemo(
    () => candidates.filter((c) => c.id !== excludeId),
    [candidates, excludeId],
  )

  function addNote() {
    setBridges((prev) => prev.filter((b) => !isEmptyBridge(b)))
    setNotes((prev) => [...prev, { title: '', body: '' }])
  }

  function addBridge() {
    setNotes((prev) => prev.filter((n) => !isEmptyNote(n)))
    setBridges((prev) => [...prev, { title: '', note: '', exerciseId: '' }])
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={addNote}>
          + Note
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          title="Exercice de remplacement"
          onClick={addBridge}
        >
          + Pont d’exercice
        </Button>
      </div>

      {notes.map((n, i) => (
        <div
          key={`note-${i}`}
          className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Note
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setNotes((p) => p.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </div>
          <input
            name="note_titles"
            value={n.title}
            onChange={(e) =>
              setNotes((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
            }
            placeholder="Titre"
            className={daFieldClass}
          />
          <textarea
            name="note_bodies"
            value={n.body}
            onChange={(e) =>
              setNotes((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))
            }
            rows={2}
            placeholder="Texte de la note…"
            className={daFieldClass}
          />
        </div>
      ))}

      {bridges.map((b, i) => (
        <div
          key={`bridge-${i}`}
          className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
              Pont d’exercice
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setBridges((p) => p.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </div>
          <input
            name="bridge_titles"
            value={b.title}
            onChange={(e) =>
              setBridges((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
            }
            placeholder="Titre du pont"
            className={daFieldClass}
          />
          <textarea
            name="bridge_notes"
            value={b.note}
            onChange={(e) =>
              setBridges((p) => p.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
            }
            rows={2}
            placeholder="Note optionnelle…"
            className={daFieldClass}
          />
          <BridgeExercisePicker
            bridgeIndex={i}
            exerciseId={b.exerciseId}
            candidates={baseOptions}
            types={types}
            sports={sports}
            onSelect={(id) =>
              setBridges((p) => p.map((x, j) => (j === i ? { ...x, exerciseId: id } : x)))
            }
            onClear={() =>
              setBridges((p) => p.map((x, j) => (j === i ? { ...x, exerciseId: '' } : x)))
            }
          />
        </div>
      ))}
    </div>
  )
}
