'use client'

import { useMemo, useState } from 'react'

import { daFieldClass } from '@/src/components/ui'

export type ReplacementCandidate = {
  id: string
  name: string
}

type Props = {
  candidates: ReplacementCandidate[]
  initialSelectedIds?: string[]
  excludeId?: string | null
}

/** Picker multi remplacements (ponts entre exercices). */
export function ExerciseReplacementsPicker({
  candidates,
  initialSelectedIds = [],
  excludeId = null,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialSelectedIds.filter((id) => id !== excludeId),
  )
  const [q, setQ] = useState('')

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return candidates
      .filter((c) => c.id !== excludeId)
      .filter((c) => !selectedIds.includes(c.id))
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .slice(0, 40)
  }, [candidates, excludeId, q, selectedIds])

  function add(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setQ('')
  }

  function remove(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-[color:var(--muted)]">
        Exercices de remplacement (ponts)
      </span>

      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="replacement_ids" value={id} />
      ))}

      {selectedIds.length ? (
        <ul className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const name = byId.get(id)?.name ?? id.slice(0, 8)
            return (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[color:var(--fg)] ring-1 ring-[var(--border)]"
              >
                <span className="max-w-[12rem] truncate">{name}</span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-[color:var(--muted)] hover:text-[color:var(--fg)]"
                  aria-label={`Retirer ${name}`}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--muted)]">Aucun pont pour l’instant.</p>
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un exercice à lier…"
        className={daFieldClass}
      />

      {q.trim() ? (
        <ul className="max-h-48 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[color:var(--muted)]">Aucun résultat</li>
          ) : (
            filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => add(c.id)}
                  className="w-full px-3 py-2 text-left text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                >
                  {c.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
