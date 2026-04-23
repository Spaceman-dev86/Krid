
'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useEffect, useRef } from 'react'
import { useProgramEditorUrlState } from '../lib/useProgramEditorUrlState'

type SessionRow = {
  id: string
  week_id: string
  title: string
  description: string | null
  session_order: number
}

export type SessionBlockRow = {
  id: string
  program_session_id: string
  position: number
  type: string
  title: string | null
  notes: string | null
  crosstraining_style: string | null
  rounds: number | null
  timecap_seconds: number | null
  rest_seconds: number | null
  warmup_duration_seconds: number | null
}

export type BlockExerciseRow = {
  id: string
  session_block_id: string
  position: number
  exercise_id: string | null
  exercise_name: string | null
  sets: number | null
  reps: number | null
  load_text: string | null
  rest_seconds: number | null
  notes: string | null
  exercise_library?: { name: string } | null
}

type Props = {
  embedded?: boolean
  readOnly: boolean
  sessions: SessionRow[]
  sessionBlocks: SessionBlockRow[]
  blockExercises: BlockExerciseRow[]
  exerciseLibrary: { id: string; name: string | null; muscle_group?: string | null }[]
  openSession?: string
  openBlockId?: string
  addBlockAction: (formData: FormData) => Promise<void | { newBlockId?: string | null }>
  updateBlockAction: (formData: FormData) => Promise<void>
  addBlockExerciseAction: (formData: FormData) => Promise<void | { newBlockExerciseId?: string | null; position?: number | null }>
  updateBlockExerciseAction?: (formData: FormData) => Promise<void>
  deleteBlockExerciseAction?: (formData: FormData) => Promise<void>
}

export default function ProgramBlocksEditorClient(props: Props) {
  const [pendingAction, setPendingAction] = useState<null | 'saveBlock' | 'addExercise'>(null)
  const [, startTransition] = useTransition()

  const [savingBlockExerciseId, setSavingBlockExerciseId] = useState<string | null>(null)

  const [addExerciseQuery, setAddExerciseQuery] = useState<string>('')
  const [addExerciseMuscle, setAddExerciseMuscle] = useState<string>('')

  const saveFormRef = useRef<HTMLFormElement | null>(null)

  const urlState = useProgramEditorUrlState({ openSession: props.openSession, openBlock: props.openBlockId ?? undefined })
  const effectiveOpenBlockId = urlState.openBlockId
  const effectiveOpenSession = urlState.openSessionId

  const withPreservedWindowScroll = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    const y = typeof window !== 'undefined' ? window.scrollY : null
    const res = await fn()
    if (typeof window !== 'undefined' && y != null) {
      window.setTimeout(() => {
        window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior })
      }, 0)
    }
    return res
  }, [])

  const closeOpenBlockInUrl = () => urlState.closeBlock({ preserveScroll: true })

  const [optimisticBlockMetaById, setOptimisticBlockMetaById] = useState<Record<string, { title: string; notes: string }>>({})

  const [optimisticBlockExerciseNotesById, setOptimisticBlockExerciseNotesById] = useState<Record<string, string>>({})
  const [optimisticDeletedBlockExerciseIds, setOptimisticDeletedBlockExerciseIds] = useState<Record<string, true>>({})
  const [optimisticInsertedBlockExercises, setOptimisticInsertedBlockExercises] = useState<BlockExerciseRow[]>([])
  const [optimisticBlockExercisesOverrideByBlockId, setOptimisticBlockExercisesOverrideByBlockId] = useState<
    Record<string, BlockExerciseRow[]>
  >({})

  const sessionsById = useMemo(() => {
    const m = new Map<string, SessionRow>()
    for (const s of props.sessions) m.set(s.id, s)
    return m
  }, [props.sessions])

  const forcedOpenBlock = useMemo(() => {
    if (!effectiveOpenBlockId) return null
    const fromList = props.sessionBlocks.find((b) => b.id === effectiveOpenBlockId) ?? null
    if (fromList) return fromList

    if (typeof window === 'undefined') return null
    const sessionId = effectiveOpenSession ?? null
    if (!sessionId) return null

    let cachedTitle = ''
    let cachedNotes = ''
    try {
      const raw = window.sessionStorage.getItem(`program:block-meta:${effectiveOpenBlockId}`)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === 'object') {
          const rec = parsed as { title?: unknown; notes?: unknown }
          cachedTitle = String(rec.title ?? '')
          cachedNotes = String(rec.notes ?? '')
        }
      }
    } catch {
    }

    return {
      id: effectiveOpenBlockId,
      program_session_id: sessionId,
      position: 0,
      type: 'strength',
      title: cachedTitle ? cachedTitle : null,
      notes: cachedNotes ? cachedNotes : null,
    }
  }, [effectiveOpenBlockId, effectiveOpenSession, props.sessionBlocks])

  const isTmpOpenBlock = useMemo(() => {
    return Boolean(effectiveOpenBlockId && effectiveOpenBlockId.startsWith('tmp-block-'))
  }, [effectiveOpenBlockId])

  const sessionId = forcedOpenBlock?.program_session_id ?? effectiveOpenSession ?? null

  const effectiveSelectedBlockId = useMemo(() => {
    if (!forcedOpenBlock) return null
    return forcedOpenBlock.id
  }, [forcedOpenBlock])

  const itemsForSelectedBlock = useMemo(() => {
    if (!effectiveSelectedBlockId) return []

    const base = (optimisticBlockExercisesOverrideByBlockId[effectiveSelectedBlockId] ?? props.blockExercises)
      .filter((be) => be.session_block_id === effectiveSelectedBlockId)
      .filter((be) => !optimisticDeletedBlockExerciseIds[be.id])

    const optimistic = optimisticInsertedBlockExercises
      .filter((be) => be.session_block_id === effectiveSelectedBlockId)
      .filter((be) => !optimisticDeletedBlockExerciseIds[be.id])

    const merged = base.concat(optimistic)
    const byId = new Map<string, BlockExerciseRow>()
    for (const row of merged) {
      byId.set(row.id, row)
    }
    return Array.from(byId.values()).slice().sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  }, [
    props.blockExercises,
    effectiveSelectedBlockId,
    optimisticDeletedBlockExerciseIds,
    optimisticInsertedBlockExercises,
    optimisticBlockExercisesOverrideByBlockId,
  ])

  const itemsForSelectedBlockWithOptimisticNotes = useMemo(() => {
    return itemsForSelectedBlock.map((row) => {
      const nextNotes = optimisticBlockExerciseNotesById[row.id]
      if (nextNotes == null) return row
      return { ...row, notes: nextNotes }
    })
  }, [itemsForSelectedBlock, optimisticBlockExerciseNotesById])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const blockId = String(effectiveSelectedBlockId ?? '').trim()
    if (!blockId) return

    try {
      const raw = window.sessionStorage.getItem(`program:block-exercises:${blockId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const rows = parsed as BlockExerciseRow[]
      setOptimisticBlockExercisesOverrideByBlockId((prev) => ({ ...prev, [blockId]: rows }))
    } catch {
      // ignore
    }
  }, [effectiveSelectedBlockId])

  const exerciseNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const ex of props.exerciseLibrary) {
      m.set(ex.id, String(ex.name ?? '').trim())
    }
    return m
  }, [props.exerciseLibrary])

  const addExerciseOptimistic = useCallback(
    (exerciseId: string, notes: string) => {
      if (props.readOnly) return
      if (!effectiveSelectedBlockId) return
      const tmpId = `tmp-be-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const nextPos = itemsForSelectedBlock.length
      const name = exerciseNameById.get(exerciseId) || 'Exercice'
      const safeNotes = String(notes ?? '')
      const tmpRow: BlockExerciseRow = {
        id: tmpId,
        session_block_id: effectiveSelectedBlockId,
        position: nextPos,
        exercise_id: exerciseId,
        exercise_name: null,
        sets: null,
        reps: null,
        load_text: null,
        rest_seconds: null,
        notes: safeNotes ? safeNotes : null,
        exercise_library: { name },
      }

      setOptimisticInsertedBlockExercises((prev) => prev.concat(tmpRow))

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('program:block-editor:block-exercise-upsert', {
            detail: { blockId: effectiveSelectedBlockId, row: tmpRow },
          })
        )
      }

      const fd = new FormData()
      fd.set('client', '1')
      fd.set('session_block_id', effectiveSelectedBlockId)
      fd.set('exercise_id', exerciseId)
      fd.set('notes', safeNotes)

      setPendingAction('addExercise')
      startTransition(async () => {
        try {
          const res = await withPreservedWindowScroll(async () => props.addBlockExerciseAction(fd))
          const newId = (res as { newBlockExerciseId?: string | null } | void)?.newBlockExerciseId ?? null
          const serverPos = (res as { position?: number | null } | void)?.position ?? null
          if (newId) {
            setOptimisticBlockExerciseNotesById((prev) => {
              const existing = prev[tmpId]
              if (existing == null) return prev
              const next = { ...prev }
              next[newId] = existing
              delete next[tmpId]
              return next
            })

            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('program:block-editor:block-exercise-reconcile', {
                  detail: {
                    blockId: effectiveSelectedBlockId,
                    tmpId,
                    newId,
                    position: serverPos != null ? serverPos : nextPos,
                  },
                })
              )
            }
            setOptimisticInsertedBlockExercises((prev) =>
              prev.map((r) => {
                if (r.id !== tmpId) return r
                return { ...r, id: newId, position: serverPos != null ? serverPos : r.position }
              })
            )
          }
        } catch {
          setOptimisticInsertedBlockExercises((prev) => prev.filter((r) => r.id !== tmpId))

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('program:block-editor:block-exercise-deleted', {
                detail: { blockId: effectiveSelectedBlockId, id: tmpId },
              })
            )
          }
        } finally {
          setPendingAction(null)
        }
      })
    },
    [effectiveSelectedBlockId, exerciseNameById, itemsForSelectedBlock.length, props, startTransition, withPreservedWindowScroll]
  )

  const selectedSession = sessionId ? sessionsById.get(sessionId) ?? null : null
  const selectedBlock = useMemo(() => {
    if (!forcedOpenBlock) return null
    const override = optimisticBlockMetaById[String(forcedOpenBlock.id)]
    if (!override) return forcedOpenBlock
    return {
      ...forcedOpenBlock,
      title: override.title,
      notes: override.notes,
    }
  }, [forcedOpenBlock, optimisticBlockMetaById])

  const [draftTitle, setDraftTitle] = useState<string>('')
  const [draftNotes, setDraftNotes] = useState<string>('')
  const selectedBlockId = selectedBlock?.id ?? null

  useEffect(() => {
    if (!selectedBlock) return
    setDraftTitle(String(selectedBlock.title ?? ''))
    setDraftNotes(String(selectedBlock.notes ?? ''))
  }, [selectedBlock])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedBlockId) return

    try {
      const raw = window.sessionStorage.getItem(`program:block-meta:${selectedBlockId}`)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object') return
      const rec = parsed as { title?: string; notes?: string }

      const nextTitle = String(rec.title ?? '')
      const nextNotes = String(rec.notes ?? '')

      setOptimisticBlockMetaById((prev) => ({ ...prev, [selectedBlockId]: { title: nextTitle, notes: nextNotes } }))
      setDraftTitle(nextTitle)
      setDraftNotes(nextNotes)
    } catch {
      // ignore
    }
  }, [selectedBlockId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onBlockUpdated = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; title?: string; notes?: string }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      if (!blockId) return
      const title = String(e.detail?.title ?? '')
      const notes = String(e.detail?.notes ?? '')
      setOptimisticBlockMetaById((prev) => ({ ...prev, [blockId]: { title, notes } }))

       if (selectedBlock && String(selectedBlock.id) === blockId) {
         setDraftTitle(title)
         setDraftNotes(notes)
       }

      try {
        window.sessionStorage.setItem(`program:block-meta:${blockId}`, JSON.stringify({ title, notes }))
      } catch {
        // ignore
      }
    }

    window.addEventListener('program:block-editor:block-updated', onBlockUpdated as EventListener)
    return () => window.removeEventListener('program:block-editor:block-updated', onBlockUpdated as EventListener)
  }, [selectedBlock])

  useEffect(() => {
    if (props.readOnly) return
    if (typeof window === 'undefined') return

    const onRequestSaveClose = () => {
      if (!saveFormRef.current) return
      if (pendingAction) return
      saveFormRef.current.requestSubmit()
    }

    window.addEventListener('program:block-editor:request-save-close', onRequestSaveClose as EventListener)
    return () => {
      window.removeEventListener('program:block-editor:request-save-close', onRequestSaveClose as EventListener)
    }
  }, [pendingAction, props.readOnly])

  useEffect(() => {
    if (props.readOnly) return
    if (typeof window === 'undefined') return

    const onAddExercise = (evt: Event) => {
      const e = evt as CustomEvent<{ exerciseId?: string }>
      const exerciseId = String(e.detail?.exerciseId ?? '').trim()
      if (!exerciseId) return
      addExerciseOptimistic(exerciseId, '')
    }

    window.addEventListener('program:block-editor:add-exercise', onAddExercise as EventListener)
    return () => {
      window.removeEventListener('program:block-editor:add-exercise', onAddExercise as EventListener)
    }
  }, [addExerciseOptimistic, props.readOnly])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onSnapshot = (evt: Event) => {
      const e = evt as CustomEvent<{ blockId?: string; rows?: BlockExerciseRow[] }>
      const blockId = String(e.detail?.blockId ?? '').trim()
      const rows = e.detail?.rows
      if (!blockId || !rows) return

      setOptimisticBlockExercisesOverrideByBlockId((prev) => ({ ...prev, [blockId]: rows.slice() }))
      try {
        window.sessionStorage.setItem(`program:block-exercises:${blockId}`, JSON.stringify(rows))
      } catch {
        // ignore
      }
    }

    window.addEventListener('program:block-editor:block-exercises-snapshot', onSnapshot as EventListener)
    return () => {
      window.removeEventListener('program:block-editor:block-exercises-snapshot', onSnapshot as EventListener)
    }
  }, [])

  const content = selectedBlock ? (
    <div className="mt-3 rounded-xl bg-white ring-1 ring-gray-200">
      <div className="border-b border-gray-100 px-3 py-3">
        <form
          ref={saveFormRef}
          key={selectedBlock.id}
          id={`block-form-${selectedBlock.id}`}
          data-block-form-id={selectedBlock.id}
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (props.readOnly) return
            if (pendingAction) return
            setPendingAction('saveBlock')

            const fd = new FormData(e.currentTarget)
            const blockId = String(fd.get('session_block_id') ?? '').trim()
            const title = String(fd.get('title') ?? '')
            const notes = String(fd.get('notes') ?? '')
            startTransition(async () => {
              try {
                if (props.updateBlockExerciseAction && blockId) {
                  const serverNotesById = new Map<string, string>()
                  for (const be of props.blockExercises ?? []) {
                    if (String(be.session_block_id) !== String(blockId)) continue
                    serverNotesById.set(String(be.id), String(be.notes ?? ''))
                  }

                  const toFlush = itemsForSelectedBlock
                    .filter((row) => String(row.session_block_id) === String(blockId))
                    .filter((row) => !String(row.id).startsWith('tmp-be-'))
                    .filter((row) => {
                      const next = String(optimisticBlockExerciseNotesById[row.id] ?? (row.notes ?? ''))
                      const prev = serverNotesById.has(String(row.id))
                        ? String(serverNotesById.get(String(row.id)) ?? '')
                        : String(row.notes ?? '')
                      return next.trim() !== prev.trim()
                    })

                  if (toFlush.length) {
                    await withPreservedWindowScroll(async () => {
                      await Promise.all(
                        toFlush.map(async (row) => {
                          const nextNotes = String(optimisticBlockExerciseNotesById[row.id] ?? (row.notes ?? '')).trim()
                          const fd2 = new FormData()
                          fd2.set('client', '1')
                          fd2.set('block_exercise_id', String(row.id))
                          fd2.set('notes', nextNotes)
                          await props.updateBlockExerciseAction?.(fd2)
                        })
                      )
                    })
                  }
                }

                await withPreservedWindowScroll(async () => {
                  await props.updateBlockAction(fd)
                })

                if (typeof window !== 'undefined' && blockId) {
                  window.dispatchEvent(
                    new CustomEvent('program:block-editor:block-updated', {
                      detail: { blockId, title, notes },
                    })
                  )

                  window.dispatchEvent(
                    new CustomEvent('program:block-editor:block-exercises-snapshot', {
                      detail: {
                        blockId,
                        rows: itemsForSelectedBlockWithOptimisticNotes,
                      },
                    })
                  )
                }

                closeOpenBlockInUrl()
              } finally {
                setPendingAction(null)
              }
            })
          }}
        >
          <input type="hidden" name="client" value="1" />
          <input type="hidden" name="session_block_id" value={selectedBlock.id} />
          <div className="flex items-end gap-2">
            <label className="grid flex-1 gap-1">
              <span className="text-xs font-semibold text-gray-700">Titre</span>
              <input
                name="title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                disabled={props.readOnly || pendingAction === 'saveBlock'}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50"
              />
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-semibold text-gray-700">Note</span>
            <textarea
              name="notes"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              disabled={props.readOnly || pendingAction === 'saveBlock'}
              rows={3}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
            />
          </label>
        </form>
      </div>

      <div className="border-b border-gray-100 px-3 py-3">
        <form
          key={selectedBlock.id}
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (props.readOnly) return
            if (pendingAction) return
          }}
        >
          <div className="grid gap-2 md:grid-cols-[1fr_220px]">
            <label className="min-w-0">
              <span className="sr-only">Rechercher un exercice</span>
              <input
                value={addExerciseQuery}
                onChange={(e) => setAddExerciseQuery(e.target.value)}
                placeholder="Rechercher un exercice…"
                disabled={props.readOnly || pendingAction === 'addExercise'}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50"
              />
            </label>

            <label>
              <span className="sr-only">Muscle</span>
              <select
                value={addExerciseMuscle}
                onChange={(e) => setAddExerciseMuscle(e.target.value)}
                disabled={props.readOnly || pendingAction === 'addExercise'}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 pr-8 text-sm disabled:opacity-50"
              >
                <option value="">Muscle</option>
                {Array.from(
                  new Set(
                    props.exerciseLibrary
                      .map((ex) => String(ex.muscle_group ?? '').trim())
                      .filter(Boolean)
                  )
                )
                  .sort((a, b) => a.localeCompare(b))
                  .map((mg) => (
                    <option key={mg} value={mg}>
                      {mg}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {addExerciseQuery.trim() || addExerciseMuscle.trim() ? (
            <div className="grid gap-1">
              {props.exerciseLibrary
                .filter((ex) => {
                  const q = addExerciseQuery.trim().toLowerCase()
                  const nameOk = !q || String(ex.name ?? '').toLowerCase().includes(q)
                  if (!nameOk) return false
                  if (!addExerciseMuscle) return true
                  return String(ex.muscle_group ?? '').trim() === addExerciseMuscle
                })
                .slice(0, 8)
                .map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    disabled={props.readOnly || pendingAction === 'addExercise'}
                    className="flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3 text-left text-sm font-semibold text-[var(--brand)] hover:bg-gray-50 disabled:opacity-50"
                    onClick={() => {
                      if (props.readOnly) return
                      if (pendingAction) return
                      const exerciseId = String(ex.id)
                      addExerciseOptimistic(exerciseId, '')
                      setAddExerciseQuery('')
                      setAddExerciseMuscle('')
                    }}
                  >
                    <div className="min-w-0 truncate">{String(ex.name ?? '').trim() || '—'}</div>
                  </button>
                ))}
            </div>
          ) : null}
        </form>
      </div>

      {itemsForSelectedBlockWithOptimisticNotes.length ? (
        <div className="divide-y divide-gray-100">
          {itemsForSelectedBlockWithOptimisticNotes.map((row) => (
            <div
              key={row.id}
              className="px-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
                    {row.exercise_library?.name ?? row.exercise_name ?? 'Exercice'}
                  </div>

                  <input
                    value={optimisticBlockExerciseNotesById[row.id] ?? (row.notes ?? '')}
                    onChange={(e) => {
                      const next = e.target.value
                      setOptimisticBlockExerciseNotesById((p) => ({ ...p, [row.id]: next }))
                    }}
                    onBlur={() => {
                      if (props.readOnly) return
                      if (!props.updateBlockExerciseAction) return
                      if (savingBlockExerciseId) return
                      if (String(row.id).startsWith('tmp-be-')) return

                      const nextNotes = String(optimisticBlockExerciseNotesById[row.id] ?? (row.notes ?? '')).trim()
                      const baseRow = itemsForSelectedBlock.find((r) => String(r.id) === String(row.id)) ?? null
                      const prevNotes = String(baseRow?.notes ?? '').trim()
                      if (nextNotes === prevNotes) return

                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(
                          new CustomEvent('program:block-editor:block-exercise-upsert', {
                            detail: {
                              blockId: selectedBlock.id,
                              row: { ...row, notes: nextNotes },
                            },
                          })
                        )
                      }

                      setSavingBlockExerciseId(row.id)
                      const fd = new FormData()
                      fd.set('client', '1')
                      fd.set('block_exercise_id', row.id)
                      fd.set('notes', nextNotes)
                      startTransition(async () => {
                        try {
                          await withPreservedWindowScroll(async () => {
                            await props.updateBlockExerciseAction?.(fd)
                          })
                        } finally {
                          setSavingBlockExerciseId(null)
                        }
                      })
                    }}
                    className="h-9 w-[220px] rounded-xl border border-gray-200 bg-white px-3 text-sm disabled:opacity-50"
                    placeholder="série / rep ..."
                    disabled={
                      props.readOnly ||
                      !props.updateBlockExerciseAction ||
                      savingBlockExerciseId === row.id
                    }
                  />

                  {!props.readOnly && props.deleteBlockExerciseAction ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-gray-500 hover:text-gray-900 disabled:opacity-50"
                      disabled={savingBlockExerciseId === row.id}
                      onClick={() => {
                        if (!props.deleteBlockExerciseAction) return
                        if (props.readOnly) return
                        if (savingBlockExerciseId) return

                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(
                            new CustomEvent('program:block-editor:block-exercise-deleted', {
                              detail: { blockId: selectedBlock.id, id: row.id },
                            })
                          )
                        }

                        setOptimisticDeletedBlockExerciseIds((p) => ({ ...p, [row.id]: true }))
                        const fd = new FormData()
                        fd.set('client', '1')
                        fd.set('block_exercise_id', row.id)
                        startTransition(async () => {
                          try {
                            await withPreservedWindowScroll(async () => {
                              await props.deleteBlockExerciseAction?.(fd)
                            })
                          } catch {
                            setOptimisticDeletedBlockExerciseIds((p) => {
                              const next = { ...p }
                              delete next[row.id]
                              return next
                            })
                          } finally {
                          }
                        })
                      }}
                    >
                      Supprimer
                    </button>
                  ) : null}
                </div>

                {savingBlockExerciseId === row.id ? (
                  <div className="mt-1 text-[11px] font-semibold text-gray-500">Enregistrement…</div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 text-sm text-gray-600">Aucun item dans ce bloc.</div>
      )}

      <div className="border-t border-gray-100 px-3 py-3">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={props.readOnly || pendingAction === 'saveBlock'}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 disabled:opacity-50"
            onClick={() => {
              if (typeof window === 'undefined') return
              if (!effectiveOpenBlockId || effectiveOpenBlockId.startsWith('tmp-block-')) return
              closeOpenBlockInUrl()
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            form={`block-form-${selectedBlock.id}`}
            disabled={props.readOnly || pendingAction === 'saveBlock'}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pendingAction === 'saveBlock' ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  ) : isTmpOpenBlock ? (
    <div className="mt-3 rounded-xl bg-white px-3 py-4 text-sm text-gray-700 ring-1 ring-gray-200">Création du bloc…</div>
  ) : (
    <div className="mt-3 text-sm text-gray-600">Ouvre un bloc depuis la timeline.</div>
  )

  if (props.embedded) {
    return content
  }

  return (
    <section className="mt-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[var(--brand)]">Éditeur blocs (beta)</div>
            <div className="mt-1 text-sm font-semibold text-gray-900">
              {selectedSession ? selectedSession.title : 'Séance'}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold text-[var(--brand)]">Contenu</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">
                {selectedBlock ? (selectedBlock.title?.trim() ? selectedBlock.title : selectedBlock.type) : 'Sélectionne un bloc'}
              </div>
            </div>
          </div>

          {content}
        </div>
      </div>
    </section>
  )
}
