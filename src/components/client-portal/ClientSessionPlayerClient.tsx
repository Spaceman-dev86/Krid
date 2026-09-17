'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'

import {
  finishSessionRunAction,
  saveSessionRunProgressAction,
} from '../../app/c/[slug]/session-run-actions'
import {
  allSetsDone,
  ensureExerciseSets,
  formatRestLabel,
  hasPrescriptionFields,
  parseRestSeconds,
  parseSetsCount,
  resolveExerciseStatusFromSets,
  someSetsDone,
  type ItemRunStatus,
  type RealizedSet,
  type SessionRunRealized,
  type SessionRunSnapshot,
  type SnapshotBlock,
  type SnapshotExercise,
  type SnapshotItem,
} from '../../lib/client-portal/sessionRuns'
import { ClientRestTimer } from './ClientRestTimer'
import { ClientSetLogPopup } from './ClientSetLogPopup'

type Props = {
  slug: string
  sessionId: string
  runId: string
  primaryColor: string
  snapshot: SessionRunSnapshot
  initialRealized: SessionRunRealized
  /** Override redirect after save/finish (ex. run libre). */
  returnTo?: string
}

type ActivePanel =
  | { kind: 'exercise'; itemId: string }
  | { kind: 'block'; itemId: string }
  | null

function statusLabel(status: ItemRunStatus) {
  if (status === 'fait') return 'Fait'
  if (status === 'partiel') return 'Partiel'
  if (status === 'non_fait') return 'Non fait'
  return 'À faire'
}

function statusClass(status: ItemRunStatus) {
  if (status === 'fait') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (status === 'partiel') return 'bg-sky-50 text-sky-900 ring-sky-100'
  if (status === 'non_fait') return 'bg-amber-50 text-amber-900 ring-amber-100'
  return 'bg-black/5 text-black/50 ring-black/10'
}

function metaLine(item: SnapshotItem) {
  if (item.kind === 'block') {
    const n = item.exercises.length
    return `${n} exo${n > 1 ? 's' : ''}${item.type ? ` · ${item.type}` : ''}`
  }
  const parts: string[] = []
  if (item.sets != null && item.sets !== '' && String(item.sets) !== '0') {
    parts.push(`${item.sets} séries`)
  }
  if (item.reps != null && item.reps !== '' && String(item.reps) !== '0') {
    parts.push(`${item.reps} reps`)
  }
  if (item.load) parts.push(String(item.load))
  if (item.rest_time) parts.push(`repos ${item.rest_time}`)
  return parts.join(' · ') || null
}

export function ClientSessionPlayerClient({
  slug,
  sessionId,
  runId,
  primaryColor,
  snapshot,
  initialRealized,
  returnTo,
}: Props) {
  const [realized, setRealized] = useState<SessionRunRealized>(() => {
    let next = initialRealized
    for (const item of snapshot.items) {
      if (item.kind === 'exercise') next = ensureExerciseSets(next, item)
    }
    return next
  })
  const [pending, startTransition] = useTransition()
  const [active, setActive] = useState<ActivePanel>(null)
  const [logSetIndex, setLogSetIndex] = useState<number | null>(null)
  const [restSeconds, setRestSeconds] = useState<number | null>(null)
  const [saveFlash, setSaveFlash] = useState(false)

  const doneCount = useMemo(() => {
    return Object.values(realized.items).filter(
      (e) => e.status === 'fait' || e.status === 'partiel'
    ).length
  }, [realized])

  const total = snapshot.items.length

  const activeItem = useMemo(() => {
    if (!active) return null
    return snapshot.items.find((i) => i.id === active.itemId) ?? null
  }, [active, snapshot.items])

  const activeExercise = activeItem?.kind === 'exercise' ? activeItem : null
  const activeBlock = activeItem?.kind === 'block' ? activeItem : null

  useEffect(() => {
    if (!saveFlash) return
    const t = window.setTimeout(() => setSaveFlash(false), 1500)
    return () => window.clearTimeout(t)
  }, [saveFlash])

  function patchItem(itemId: string, patch: Partial<SessionRunRealized['items'][string]>) {
    setRealized((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [itemId]: {
          ...prev.items[itemId],
          ...patch,
        },
      },
    }))
  }

  function openExercise(item: SnapshotExercise) {
    setRealized((prev) => ensureExerciseSets(prev, item))
    setActive({ kind: 'exercise', itemId: item.id })
    setLogSetIndex(null)
    setRestSeconds(null)
  }

  function openBlock(item: SnapshotBlock) {
    setActive({ kind: 'block', itemId: item.id })
    setRestSeconds(null)
  }

  function closePanel() {
    setActive(null)
    setLogSetIndex(null)
    setRestSeconds(null)
  }

  function markExerciseFait(itemId: string) {
    const entry = realized.items[itemId]
    const nextStatus = resolveExerciseStatusFromSets(entry?.sets, 'fait')
    const next: SessionRunRealized = {
      ...realized,
      items: {
        ...realized.items,
        [itemId]: { ...entry, status: nextStatus === 'pending' ? 'fait' : nextStatus },
      },
    }
    setRealized(next)
    autosave(next)
    closePanel()
  }

  function markExerciseNonFait(itemId: string) {
    patchItem(itemId, { status: 'non_fait' })
    closePanel()
  }

  function confirmSet(item: SnapshotExercise, setIndex: number, setData: RealizedSet) {
    const ensured = ensureExerciseSets(realized, item)
    const entry = ensured.items[item.id]
    const sets = [...(entry.sets ?? [])]
    sets[setIndex] = setData
    const complete = allSetsDone(sets)
    const next: SessionRunRealized = {
      ...ensured,
      items: {
        ...ensured.items,
        [item.id]: {
          ...entry,
          sets,
          status: complete
            ? 'fait'
            : someSetsDone(sets)
              ? 'partiel'
              : entry.status === 'fait'
                ? 'fait'
                : 'pending',
        },
      },
    }
    setRealized(next)
    autosave(next)
    setLogSetIndex(null)

    const rest = parseRestSeconds(item.rest_time)
    const setsCount = parseSetsCount(item.sets)
    const isLast = setIndex >= setsCount - 1
    if (rest && rest > 0 && !isLast) {
      setRestSeconds(rest)
    } else {
      setRestSeconds(null)
    }
  }

  function toggleBlockExercise(blockId: string, exoId: string) {
    const entry = realized.items[blockId] ?? { status: 'pending' as const }
    const map = { ...(entry.blockExercises ?? {}) }
    const cur = map[exoId]?.status ?? 'pending'
    const nextStatus: ItemRunStatus =
      cur === 'pending' ? 'fait' : cur === 'fait' ? 'non_fait' : 'pending'
    map[exoId] = { status: nextStatus }
    const next: SessionRunRealized = {
      ...realized,
      items: {
        ...realized.items,
        [blockId]: { ...entry, blockExercises: map, status: 'pending' },
      },
    }
    setRealized(next)
    autosave(next)
  }

  function finishBlock(block: SnapshotBlock, as: 'fait' | 'non_fait' = 'fait') {
    const entry = realized.items[block.id] ?? { status: 'pending' as const }
    const map = { ...(entry.blockExercises ?? {}) }
    for (const ex of block.exercises) {
      if (!map[ex.id]) map[ex.id] = { status: 'pending' }
      if (map[ex.id].status === 'pending') {
        map[ex.id] = { status: as }
      }
    }
    const allFait =
      block.exercises.length > 0 &&
      block.exercises.every((ex) => map[ex.id]?.status === 'fait')
    const anyFait = Object.values(map).some((e) => e.status === 'fait')
    const next: SessionRunRealized = {
      ...realized,
      items: {
        ...realized.items,
        [block.id]: {
          ...entry,
          blockExercises: map,
          status: as === 'non_fait' && !anyFait ? 'non_fait' : allFait || anyFait ? 'fait' : 'non_fait',
        },
      },
    }
    setRealized(next)
    autosave(next)
    closePanel()
  }

  function persist(action: 'save' | 'finish') {
    const fd = new FormData()
    fd.set('slug', slug)
    fd.set('session_id', sessionId)
    fd.set('run_id', runId)
    fd.set('realized', JSON.stringify(realized))
    if (returnTo) fd.set('return_to', returnTo)
    if (action === 'save') fd.set('stay', '1')
    startTransition(() => {
      if (action === 'save') {
        void saveSessionRunProgressAction(fd).then(() => setSaveFlash(true))
      } else {
        void finishSessionRunAction(fd)
      }
    })
  }

  /** Autosave silencieux après validation série / fin exo. */
  function autosave(next: SessionRunRealized) {
    const fd = new FormData()
    fd.set('slug', slug)
    fd.set('session_id', sessionId)
    fd.set('run_id', runId)
    fd.set('realized', JSON.stringify(next))
    fd.set('stay', '1')
    if (returnTo) fd.set('return_to', returnTo)
    void saveSessionRunProgressAction(fd)
  }

  const exerciseSets = activeExercise
    ? realized.items[activeExercise.id]?.sets ?? []
    : []
  const nextUndoneSetIndex = exerciseSets.findIndex((s) => !s.done)

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-black/10 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-black/40">Mode run</p>
            <p className="text-sm font-semibold text-[#1a1220]">
              {doneCount}/{total} traité{doneCount > 1 ? 's' : ''}
            </p>
          </div>
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: primaryColor }}
          >
            En cours
          </span>
        </div>
        <p className="mt-2 text-xs text-black/45">
          Ordre libre — démarre un exo ou un bloc, loggue les séries, timer repos auto si renseigné.
        </p>
      </div>

      {/* Liste items */}
      {!active ? (
        <ul className="grid gap-3">
          {snapshot.items.map((item) => {
            const status = realized.items[item.id]?.status ?? 'pending'
            const meta = metaLine(item)
            const setsDone =
              item.kind === 'exercise'
                ? (realized.items[item.id]?.sets ?? []).filter((s) => s.done).length
                : 0
            const setsTotal =
              item.kind === 'exercise' ? parseSetsCount(item.sets) : 0

            return (
              <li key={item.id} className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1a1220]">
                      {item.kind === 'block' ? item.title : item.name}
                    </p>
                    {meta ? <p className="mt-0.5 text-xs text-black/45">{meta}</p> : null}
                    {item.kind === 'exercise' && setsTotal > 0 ? (
                      <p className="mt-0.5 text-xs text-black/40">
                        {setsDone}/{setsTotal} séries
                      </p>
                    ) : null}
                    {item.kind === 'block' ? (
                      <ul className="mt-2 space-y-1 border-t border-black/5 pt-2">
                        {item.exercises.map((ex) => (
                          <li key={ex.id} className="text-xs text-black/60">
                            <span className="font-semibold text-[#1a1220]">{ex.name}</span>
                            {ex.sets != null || ex.reps != null
                              ? ` · ${ex.sets ?? '—'}×${ex.reps ?? '—'}`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(status)}`}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      item.kind === 'exercise' ? openExercise(item) : openBlock(item)
                    }
                    className="rounded-lg px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {status === 'fait' ? 'Revoir' : 'Démarrer'}
                  </button>
                  {status !== 'fait' ? (
                    <button
                      type="button"
                      onClick={() => patchItem(item.id, { status: 'non_fait' })}
                      className="rounded-lg border border-black/15 px-3 py-2 text-xs font-bold text-black/55"
                    >
                      Non fait
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {!snapshot.items.length ? (
        <p className="text-sm text-black/50">
          Snapshot vide — ajoute des exercices dans l’éditeur coach puis redémarre une séance.
        </p>
      ) : null}

      {/* Panel exercice */}
      {activeExercise ? (
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={closePanel}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Liste
          </button>
          <h2 className="mt-2 text-xl font-extrabold" style={{ color: primaryColor }}>
            {activeExercise.name}
          </h2>
          {metaLine(activeExercise) ? (
            <p className="mt-1 text-sm text-black/50">{metaLine(activeExercise)}</p>
          ) : null}
          {activeExercise.notes ? (
            <p className="mt-2 text-sm text-black/60">{activeExercise.notes}</p>
          ) : null}
          {activeExercise.demo_media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeExercise.demo_media_url}
              alt=""
              className="mt-3 max-h-48 w-full rounded-xl object-contain bg-black/5"
            />
          ) : null}

          {restSeconds != null ? (
            <div className="mt-4">
              <ClientRestTimer
                seconds={restSeconds}
                primaryColor={primaryColor}
                onDone={() => setRestSeconds(null)}
                onSkip={() => setRestSeconds(null)}
              />
            </div>
          ) : null}

          {hasPrescriptionFields(activeExercise) || exerciseSets.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {exerciseSets.map((set, idx) => (
                <li key={idx}>
                  <button
                    type="button"
                    disabled={restSeconds != null}
                    onClick={() => setLogSetIndex(idx)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left text-sm transition ${
                      set.done
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-black/10 bg-[#fafafa] hover:bg-white'
                    } disabled:opacity-50`}
                  >
                    <span className="font-semibold text-[#1a1220]">
                      Série {idx + 1}
                      {set.done
                        ? ` · ${[set.reps && `${set.reps} reps`, set.load, set.rpe && `RPE ${set.rpe}`]
                            .filter(Boolean)
                            .join(' · ')}`
                        : ''}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                        set.done
                          ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                          : 'bg-white text-black/45 ring-black/10'
                      }`}
                    >
                      {set.done ? 'OK' : 'À faire'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-black/50">
              Exo sans séries (vidéo / à suivre) — marque Fait quand c’est bon.
            </p>
          )}

          {activeExercise.rest_time && restSeconds == null ? (
            <button
              type="button"
              onClick={() => {
                const s = parseRestSeconds(activeExercise.rest_time)
                if (s) setRestSeconds(s)
              }}
              className="mt-3 text-xs font-bold text-sky-700 underline"
            >
              Lancer un timer ({formatRestLabel(parseRestSeconds(activeExercise.rest_time) ?? 0)})
            </button>
          ) : null}

          <div className="mt-4 grid gap-2">
            {nextUndoneSetIndex >= 0 && restSeconds == null ? (
              <button
                type="button"
                onClick={() => setLogSetIndex(nextUndoneSetIndex)}
                className="rounded-xl px-3 py-3 text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                Logger série {nextUndoneSetIndex + 1}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => markExerciseFait(activeExercise.id)}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-900"
            >
              {exerciseSets.length > 0 &&
              someSetsDone(exerciseSets) &&
              !allSetsDone(exerciseSets)
                ? 'Finir l’exercice (Partiel)'
                : 'Finir l’exercice (Fait)'}
            </button>
            <button
              type="button"
              onClick={() => markExerciseNonFait(activeExercise.id)}
              className="rounded-xl border border-black/15 px-3 py-2.5 text-xs font-bold text-black/55"
            >
              Marquer Non fait
            </button>
          </div>
        </section>
      ) : null}

      {/* Panel bloc */}
      {activeBlock ? (
        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={closePanel}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Liste
          </button>
          <h2 className="mt-2 text-xl font-extrabold" style={{ color: primaryColor }}>
            {activeBlock.title}
          </h2>
          {activeBlock.notes ? (
            <p className="mt-1 text-sm text-black/55">{activeBlock.notes}</p>
          ) : null}

          {restSeconds != null ? (
            <div className="mt-4">
              <ClientRestTimer
                seconds={restSeconds}
                primaryColor={primaryColor}
                onDone={() => setRestSeconds(null)}
                onSkip={() => setRestSeconds(null)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRestSeconds(60)}
              className="mt-3 text-xs font-bold text-sky-700 underline"
            >
              Lancer un timer (60s)
            </button>
          )}

          <ul className="mt-4 grid gap-2">
            {activeBlock.exercises.map((ex) => {
              const st =
                realized.items[activeBlock.id]?.blockExercises?.[ex.id]?.status ?? 'pending'
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => toggleBlockExercise(activeBlock.id, ex.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#fafafa] px-3 py-3 text-left text-sm"
                  >
                    <span>
                      <span className="font-semibold text-[#1a1220]">{ex.name}</span>
                      {(ex.sets != null || ex.reps != null) && (
                        <span className="mt-0.5 block text-xs text-black/45">
                          {ex.sets ?? '—'}×{ex.reps ?? '—'}
                          {ex.load_text ? ` · ${ex.load_text}` : ''}
                        </span>
                      )}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(st)}`}
                    >
                      {statusLabel(st)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => finishBlock(activeBlock, 'fait')}
              className="w-full rounded-xl px-3 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Finir le bloc (Fait)
            </button>
            <button
              type="button"
              onClick={() => finishBlock(activeBlock, 'non_fait')}
              className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-xs font-bold text-black/55"
            >
              Marquer Non fait
            </button>
            <p className="text-center text-[11px] text-black/40">
              Finir = les exos non tapés passent en Fait. Tape un exo pour le marquer individuellement.
            </p>
          </div>
        </section>
      ) : null}

      {/* Pop-up série */}
      {activeExercise && logSetIndex != null && exerciseSets[logSetIndex] ? (
        <ClientSetLogPopup
          item={activeExercise}
          setIndex={logSetIndex}
          initial={exerciseSets[logSetIndex]}
          primaryColor={primaryColor}
          onCancel={() => setLogSetIndex(null)}
          onConfirm={(set) => confirmSet(activeExercise, logSetIndex, set)}
        />
      ) : null}

      <div className="sticky bottom-20 grid gap-2 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-lg backdrop-blur">
        {saveFlash ? (
          <p className="text-center text-xs font-semibold text-emerald-700">Progression enregistrée</p>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => persist('save')}
          className="w-full rounded-lg border border-black/15 px-3 py-2.5 text-sm font-bold text-black/65 disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer la progression'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => persist('finish')}
          className="w-full rounded-lg px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          Terminer la séance
        </button>
        <p className="text-center text-[11px] text-black/40">
          Terminer = items non marqués → « Non fait ».
        </p>
      </div>
    </div>
  )
}
