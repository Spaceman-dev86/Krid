'use client'

import { useMemo, useState, useTransition } from 'react'

import {
  saveDiyDraftAction,
  startDiySessionAction,
} from '../../app/c/[slug]/seance-actions'
import type { DiyExerciseInput } from '../../lib/client-portal/diySessions'

export type LibraryPickRow = {
  id: string
  name: string
  muscle_group: string | null
  coach_id: string | null
}

type DraftItem = DiyExerciseInput & { key: string }

type Props = {
  slug: string
  primaryColor: string
  library: LibraryPickRow[]
  draftId?: string | null
  initialTitle?: string
  initialExercises?: DiyExerciseInput[]
  error?: string | null
}

function newKey() {
  return `k-${Math.random().toString(36).slice(2, 10)}`
}

export function ClientDiySessionEditor({
  slug,
  primaryColor,
  library,
  draftId,
  initialTitle = '',
  initialExercises = [],
  error,
}: Props) {
  const [title, setTitle] = useState(initialTitle)
  const [items, setItems] = useState<DraftItem[]>(() =>
    initialExercises.map((e) => ({ ...e, key: newKey() }))
  )
  const [query, setQuery] = useState('')
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return library.slice(0, 40)
    return library.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 40)
  }, [library, query])

  function addExercise(row: LibraryPickRow) {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        exerciseId: row.id,
        name: row.name,
        sets: '3',
        reps: '10',
        restTime: '90',
        load: null,
        notes: null,
      },
    ])
  }

  function updateItem(key: string, patch: Partial<DiyExerciseInput>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  function payloadJson() {
    return JSON.stringify(
      items.map(({ key: _k, ...rest }) => rest)
    )
  }

  function submit(action: 'draft' | 'start') {
    const fd = new FormData()
    fd.set('slug', slug)
    fd.set('title', title || 'Séance libre')
    fd.set('exercises_json', payloadJson())
    if (draftId) fd.set('draft_id', draftId)
    startTransition(() => {
      if (action === 'draft') void saveDiyDraftAction(fd)
      else void startDiySessionAction(fd)
    })
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <label className="grid gap-1">
        <span className="text-xs font-bold uppercase tracking-wide text-black/45">Titre</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Séance libre"
          className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as string]: primaryColor }}
        />
      </label>

      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#1a1220]">Exercices ({items.length})</h2>
        {!items.length ? (
          <p className="mt-2 text-sm text-black/45">Ajoute des exercices depuis la bibliothèque.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {items.map((it, idx) => (
              <li key={it.key} className="grid gap-2 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[#1a1220]">
                    {idx + 1}. {it.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(it.key)}
                    className="text-xs font-bold text-black/40 hover:text-red-600"
                  >
                    Retirer
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    value={it.sets ?? ''}
                    onChange={(e) => updateItem(it.key, { sets: e.target.value })}
                    placeholder="Séries"
                    className="rounded-lg border border-black/10 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={it.reps ?? ''}
                    onChange={(e) => updateItem(it.key, { reps: e.target.value })}
                    placeholder="Reps"
                    className="rounded-lg border border-black/10 px-2 py-1.5 text-xs"
                  />
                  <input
                    value={it.restTime ?? ''}
                    onChange={(e) => updateItem(it.key, { restTime: e.target.value })}
                    placeholder="Repos"
                    className="rounded-lg border border-black/10 px-2 py-1.5 text-xs"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-[#1a1220]">Bibliothèque</h2>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un exo…"
          className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:ring-2"
          style={{ ['--tw-ring-color' as string]: primaryColor }}
        />
        <ul className="mt-3 max-h-64 divide-y divide-black/5 overflow-y-auto">
          {filtered.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-[10px] text-black/40">
                  {row.coach_id ? 'Coach' : 'Trainly'}
                  {row.muscle_group ? ` · ${row.muscle_group}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => addExercise(row)}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                + Ajouter
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !items.length}
          onClick={() => submit('draft')}
          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold disabled:opacity-40"
        >
          Enregistrer brouillon
        </button>
        <button
          type="button"
          disabled={pending || !items.length}
          onClick={() => submit('start')}
          className="rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: primaryColor }}
        >
          Démarrer
        </button>
      </div>
    </div>
  )
}
