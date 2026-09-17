'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { saveSpecRedirects } from '../../app/admin/spec/actions'
import type { SpecRedirect } from '../../lib/spec-workspace/types'
import { markSpecClean, markSpecDirty } from './SpecShell'

function newRedirect(): SpecRedirect {
  return {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: '',
    from: '',
    to: '',
    note: '',
  }
}

type Props = {
  sectionId: string
  blockId: string
  initial: SpecRedirect[]
}

export function RedirectsEditor({ sectionId, blockId, initial }: Props) {
  const [rows, setRows] = useState<SpecRedirect[]>(initial)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const dirtyRef = useRef(false)
  const [status, setStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dirtyId = `${sectionId}:redirects:${blockId}`

  async function persist(nextRows: SpecRedirect[]) {
    if (!dirtyRef.current) return
    setError(null)
    setStatus('saving')
    const cleaned = nextRows
      .map((r) => ({
        ...r,
        label: r.label.trim(),
        from: r.from?.trim() || undefined,
        to: r.to.trim(),
        note: r.note?.trim() || undefined,
      }))
      .filter((r) => r.to || r.label)

    try {
      await saveSpecRedirects(sectionId, blockId, cleaned)
      setRows(cleaned)
      rowsRef.current = cleaned
      dirtyRef.current = false
      markSpecClean(dirtyId)
      setStatus('saved')
      window.setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1500)
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Erreur sauvegarde')
    }
  }

  useEffect(() => {
    const onFlush = () => {
      startTransition(() => {
        void persist(rowsRef.current)
      })
    }
    window.addEventListener('spec-flush-save', onFlush)
    return () => window.removeEventListener('spec-flush-save', onFlush)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, blockId])

  function touch(next: SpecRedirect[]) {
    rowsRef.current = next
    setRows(next)
    dirtyRef.current = true
    setStatus('pending')
    markSpecDirty(dirtyId)
  }

  function updateRow(id: string, patch: Partial<SpecRedirect>) {
    touch(rowsRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function addRow() {
    touch([...rowsRef.current, newRedirect()])
  }

  function removeRow(id: string) {
    touch(rowsRef.current.filter((r) => r.id !== id))
  }

  const statusLabel =
    status === 'saving'
      ? 'Enregistrement…'
      : status === 'pending'
        ? 'Non sauvé'
        : status === 'saved'
          ? 'Enregistré'
          : status === 'error'
            ? 'Erreur'
            : ''

  return (
    <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--accent)]/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--brand)]">
            Routes de redirection
          </h4>
          <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
            Où mène un clic / bouton / onglet depuis cette page. Sauve via la barre sticky.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={addRow}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand)] ring-1 ring-[var(--border)] disabled:opacity-50"
          >
            + Ajouter une redirection
          </button>
          {statusLabel ? <span className="text-[10px] font-semibold text-[color:var(--muted)]">{statusLabel}</span> : null}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-[color:var(--muted)]">Aucune redirection. Ajoute-en une pour documenter les parcours.</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid gap-2 rounded-md border border-[var(--border)] bg-white p-3 sm:grid-cols-2"
            >
              <label className="grid gap-1 text-[10px] font-semibold text-[color:var(--muted)]">
                Label
                <input
                  value={row.label}
                  onChange={(e) => updateRow(row.id, { label: e.target.value })}
                  className="rounded border border-[var(--border)] px-2 py-1 text-sm font-normal text-[color:var(--fg)]"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold text-[color:var(--muted)]">
                Depuis
                <input
                  value={row.from ?? ''}
                  onChange={(e) => updateRow(row.id, { from: e.target.value })}
                  className="rounded border border-[var(--border)] px-2 py-1 text-sm font-normal text-[color:var(--fg)]"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold text-[color:var(--muted)] sm:col-span-2">
                Vers (route)
                <input
                  value={row.to}
                  onChange={(e) => updateRow(row.id, { to: e.target.value })}
                  className="rounded border border-[var(--border)] px-2 py-1 font-mono text-sm font-normal text-[color:var(--fg)]"
                />
              </label>
              <label className="grid gap-1 text-[10px] font-semibold text-[color:var(--muted)] sm:col-span-2">
                Note
                <input
                  value={row.note ?? ''}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                  className="rounded border border-[var(--border)] px-2 py-1 text-sm font-normal text-[color:var(--fg)]"
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="justify-self-start text-xs font-semibold text-red-600"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
