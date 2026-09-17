'use client'

import { useEffect, useState, type FormEvent } from 'react'

import type { RealizedSet, SnapshotExercise } from '../../lib/client-portal/sessionRuns'

type Props = {
  item: SnapshotExercise
  setIndex: number
  initial: RealizedSet
  primaryColor: string
  onConfirm: (set: RealizedSet) => void
  onCancel: () => void
}

export function ClientSetLogPopup({
  item,
  setIndex,
  initial,
  primaryColor,
  onConfirm,
  onCancel,
}: Props) {
  const [reps, setReps] = useState(initial.reps ?? '')
  const [load, setLoad] = useState(initial.load ?? '')
  const [rpe, setRpe] = useState(initial.rpe ?? '')
  const [note, setNote] = useState(initial.note ?? '')

  useEffect(() => {
    setReps(initial.reps ?? '')
    setLoad(initial.load ?? '')
    setRpe(initial.rpe ?? '')
    setNote(initial.note ?? '')
  }, [initial, setIndex])

  const showReps =
    (item.reps != null && String(item.reps).trim() !== '' && String(item.reps) !== '0') ||
    Boolean(initial.reps)
  const showLoad = Boolean(item.load) || Boolean(initial.load)
  const showRpe = item.rpe != null || Boolean(initial.rpe)

  function submit(e: FormEvent) {
    e.preventDefault()
    onConfirm({
      reps: showReps ? reps.trim() || null : null,
      load: showLoad ? load.trim() || null : null,
      rpe: showRpe ? rpe.trim() || null : null,
      note: note.trim() || null,
      done: true,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">
              Série {setIndex + 1}
            </p>
            <h3 className="text-lg font-extrabold text-[#1a1220]">{item.name}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2 py-1 text-sm font-bold text-black/40 hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="rounded-xl bg-[#fafafa] px-3 py-2 text-xs text-black/55">
            <p className="font-bold uppercase tracking-wide text-black/40">Demandé</p>
            <p className="mt-1 font-semibold text-[#1a1220]">
              {[
                item.sets != null && item.sets !== '' ? `${item.sets} séries` : null,
                item.reps != null && item.reps !== '' ? `${item.reps} reps` : null,
                item.load ? String(item.load) : null,
                item.rpe != null ? `RPE ${item.rpe}` : null,
                item.rest_time ? `repos ${item.rest_time}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">Réalisé</p>

          {showReps ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#1a1220]">Reps</span>
              <input
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                inputMode="numeric"
                className="h-11 rounded-xl border border-black/10 px-3 font-semibold outline-none focus:ring-2"
                style={{ ['--tw-ring-color' as string]: primaryColor }}
                autoFocus
              />
            </label>
          ) : null}

          {showLoad ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#1a1220]">Charge</span>
              <input
                value={load}
                onChange={(e) => setLoad(e.target.value)}
                className="h-11 rounded-xl border border-black/10 px-3 font-semibold outline-none focus:ring-2"
              />
            </label>
          ) : null}

          {showRpe ? (
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[#1a1220]">RPE</span>
              <input
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                inputMode="decimal"
                className="h-11 rounded-xl border border-black/10 px-3 font-semibold outline-none focus:ring-2"
              />
            </label>
          ) : null}

          {!showReps && !showLoad && !showRpe ? (
            <p className="text-sm text-black/50">
              Pas de champs série (exo vidéo / à suivre). Valide pour marquer la série.
            </p>
          ) : null}

          <label className="grid gap-1 text-sm">
            <span className="font-semibold text-[#1a1220]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optionnel"
              className="h-11 rounded-xl border border-black/10 px-3 font-semibold outline-none focus:ring-2"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/15 px-3 py-3 text-sm font-bold text-black/60"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="rounded-xl px-3 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Valider la série
          </button>
        </div>
      </form>
    </div>
  )
}
