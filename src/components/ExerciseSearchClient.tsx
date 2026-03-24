'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Exercise = {
  id: string
  name: string
  muscle_group: string | null
  difficulty: string | null
}

type Props = {
  mode: 'add' | 'replace'
  sessionId: string
  programExerciseId?: string
  openWeek: string
  openSession: string
  uniqueMuscles: string[]
  exitUrl?: string
  onDone?: () => void
  autoFocus?: boolean
  onOptimisticAdd?: (exercise: { id: string; name: string; tmpId: string }) => void
  onReconcileOptimisticId?: (tmpId: string, insertedId: string) => void
  onReplaced?: (exercise: { id: string; name: string }) => void
  addAction: (formData: FormData) => Promise<{ insertedId: string | null; tmpId: string | null } | void>
  replaceAction: (formData: FormData) => Promise<void>
}

export default function ExerciseSearchClient({
  mode,
  sessionId,
  programExerciseId,
  openWeek,
  openSession,
  uniqueMuscles,
  exitUrl,
  onDone,
  autoFocus,
  onOptimisticAdd,
  onReconcileOptimisticId,
  onReplaced,
  addAction,
  replaceAction,
}: Props) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Exercise[]>([])
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [searchedKey, setSearchedKey] = useState('')
  const [isPending, startTransition] = useTransition()
  const abortRef = useRef<AbortController | null>(null)

  const canSearch = useMemo(() => q.trim().length >= 1 || muscle.trim().length > 0, [q, muscle])

  const queryKey = useMemo(() => `${q.trim()}|${muscle.trim()}`.toLowerCase(), [q, muscle])

  const runSearch = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setSearchStatus('loading')
    setError(null)
    try {
      const url = new URL(`/api/exercises/search`, window.location.origin)
      if (q.trim()) url.searchParams.set('q', q.trim())
      if (muscle.trim()) url.searchParams.set('muscle', muscle.trim())
      const res = await fetch(url.toString(), { method: 'GET', signal: controller.signal })
      const json = (await res.json()) as { exercises?: Exercise[]; error?: string }
      if (!res.ok) {
        setError(json.error ?? 'Erreur')
        setResults([])
      } else {
        setResults(json.exercises ?? [])
      }

      if (abortRef.current === controller) {
        setSearchStatus('done')
        setSearchedKey(`${q.trim()}|${muscle.trim()}`.toLowerCase())
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }
      setError('Erreur réseau')
      setResults([])

      if (abortRef.current === controller) {
        setSearchStatus('done')
        setSearchedKey(`${q.trim()}|${muscle.trim()}`.toLowerCase())
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(false)
      }
    }
  }, [q, muscle])

  useEffect(() => {
    if (!canSearch) {
      setResults([])
      setError(null)
      setSearchStatus('idle')
      setSearchedKey('')
      return
    }

    const t = window.setTimeout(() => {
      if (!isPending) {
        runSearch()
      }
    }, 150)

    return () => window.clearTimeout(t)
  }, [canSearch, q, muscle, isPending, runSearch])

  useEffect(() => {
    setResults([])
    setError(null)
    setSearchStatus('idle')
    setSearchedKey('')
  }, [mode, sessionId, programExerciseId])

  const selectExercise = (exercise: Exercise) => {
    startTransition(async () => {
      const isTmpReplace = mode === 'replace' && String(programExerciseId ?? '').startsWith('tmp-')

      const fd = new FormData()
      fd.set('session_id', sessionId)
      fd.set('exercise_id', exercise.id)
      fd.set('openWeek', openWeek)
      fd.set('openSession', openSession)
      fd.set('client', '1')

      setError(null)

      try {
        if (mode === 'replace') {
          if (!isTmpReplace) {
            fd.set('program_exercise_id', String(programExerciseId ?? ''))
            await replaceAction(fd)
          }
          onReplaced?.({ id: exercise.id, name: exercise.name })
        } else {
          const tmpId = `tmp-${exercise.id}-${Date.now()}`
          fd.set('tmp_id', tmpId)
          onOptimisticAdd?.({ id: exercise.id, name: exercise.name, tmpId })
          const res = await addAction(fd)
          const insertedId = (res as { insertedId: string | null; tmpId: string | null } | void)?.insertedId ?? null
          const echoedTmpId = (res as { insertedId: string | null; tmpId: string | null } | void)?.tmpId ?? null
          if (insertedId && (echoedTmpId || tmpId)) {
            onReconcileOptimisticId?.(echoedTmpId || tmpId, insertedId)
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur'
        setError(msg)
        return
      }

      setResults([])
      setQ('')
      setMuscle('')
      onDone?.()

      if (exitUrl) {
        router.replace(exitUrl, { scroll: false })
      }
      router.refresh()

      const anchor = mode === 'replace' ? `pe-${programExerciseId}` : `add-${sessionId}`
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    })
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', maxWidth: '100%' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: 0 }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6b7280',
              fontSize: 14,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            ⌕
          </span>
          <input
            value={q}
            autoFocus={Boolean(autoFocus)}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px 10px 30px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            flex: 1,
            minWidth: 0,
          }}
        >
          <option value="">(muscle)</option>
          {uniqueMuscles.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {error ? <div style={{ color: '#ef4444' }}>{error}</div> : null}

      {results.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {results.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={
                () => {
                  if (isPending) return
                  selectExercise(e)
                }
              }
              onKeyDown={
                (ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    if (isPending) return
                    selectExercise(e)
                  }
                }
              }
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 12,
                cursor: isPending ? 'not-allowed' : 'pointer',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>{e.name}</strong>
                  <div
                    style={{
                      color: '#6b7280',
                      marginTop: 6,
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>{e.muscle_group ?? ''}</span>
                    <span>{e.difficulty ?? ''}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!loading &&
      !error &&
      results.length === 0 &&
      canSearch &&
      searchStatus === 'done' &&
      searchedKey === queryKey ? (
        <div style={{ color: '#6b7280' }}>Aucun résultat.</div>
      ) : null}
    </div>
  )
}
