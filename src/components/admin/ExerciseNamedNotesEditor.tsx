'use client'

import { useState } from 'react'

import { Button, daFieldClass } from '@/src/components/ui'

export type NamedNote = {
  title: string
  body: string
}

type Props = {
  initialNotes?: NamedNote[]
}

/** Notes libres : chaque note a un titre choisi par l’admin. */
export function ExerciseNamedNotesEditor({ initialNotes = [] }: Props) {
  const [notes, setNotes] = useState<NamedNote[]>(() => (initialNotes.length ? initialNotes : []))

  function addNote() {
    setNotes((prev) => [...prev, { title: '', body: '' }])
  }

  function update(i: number, patch: Partial<NamedNote>) {
    setNotes((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)))
  }

  function remove(i: number) {
    setNotes((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[color:var(--muted)]">Notes libres</span>
        <Button type="button" variant="secondary" size="sm" onClick={addNote}>
          + Note
        </Button>
      </div>
      <p className="text-[11px] text-[color:var(--muted)]">
        Tu choisis le titre de chaque note (ex. « Problème fréquent », « Tip », …) puis le texte.
      </p>

      {notes.map((n, i) => (
        <div
          key={i}
          className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3"
        >
          <div className="flex gap-2">
            <input
              name="note_titles"
              value={n.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Titre de la note"
              className={`${daFieldClass} min-w-0 flex-1`}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => remove(i)}>
              ×
            </Button>
          </div>
          <textarea
            name="note_bodies"
            value={n.body}
            onChange={(e) => update(i, { body: e.target.value })}
            rows={2}
            placeholder="Contenu…"
            className={daFieldClass}
          />
        </div>
      ))}

      {!notes.length ? (
        <p className="text-xs text-[color:var(--muted)]">Aucune note — clique « + Note » si besoin.</p>
      ) : null}
    </div>
  )
}
