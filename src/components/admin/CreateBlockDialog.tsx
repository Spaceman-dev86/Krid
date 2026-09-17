'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  BlockFicheEditor,
  type BlockExerciseCandidate,
} from '@/src/components/admin/BlockFicheEditor'
import { Button } from '@/src/components/ui'
import type { UnitRow } from '@/src/lib/blocks/constants'
import type { SessionBlockDetail } from '@/src/lib/sessions/blockDetail'

type Sport = { id: string; label: string }

type Props = {
  open: boolean
  /** Si défini → mode édition (PATCH). */
  blockId?: string | null
  initial?: Partial<SessionBlockDetail> | null
  candidates: BlockExerciseCandidate[]
  sports: Sport[]
  units: UnitRow[]
  /** Création depuis une séance déjà publiée → bloc publié directement. */
  publishImmediately?: boolean
  onClose: () => void
  onSaved: (block: SessionBlockDetail) => void
}

function parseJsonArray(raw: FormDataEntryValue | null): unknown[] {
  try {
    const v = JSON.parse(String(raw ?? '[]'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Même UI que /admin/blocks/new|edit, en modal — CTA unique Créer / Enregistrer. */
export function CreateBlockDialog({
  open,
  blockId = null,
  initial = null,
  candidates,
  sports,
  units,
  publishImmediately = false,
  onClose,
  onSaved,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const editing = Boolean(blockId)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setPending(false)
    setFormKey((k) => k + 1)
  }, [open, blockId, initial?.id, initial?.name, initial?.timer_note, initial?.notes])

  if (!open || !mounted) return null

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const fd = new FormData(e.currentTarget)
    const name = String(fd.get('name') ?? '').trim()
    const sport_id = String(fd.get('sport_id') ?? '').trim()
    const expected_result_unit_id = String(fd.get('expected_result_unit_id') ?? '').trim()
    if (!name) {
      setError('Nom requis')
      return
    }
    if (!sport_id) {
      setError('Sport requis')
      return
    }
    if (!expected_result_unit_id) {
      setError('Résultat attendu requis')
      return
    }

    const exercise_ids = fd.getAll('exercise_ids').map((v) => String(v).trim()).filter(Boolean)
    if (!exercise_ids.length) {
      setError('Au moins 1 exercice requis')
      return
    }
    const exercise_prescriptions = fd
      .getAll('exercise_prescriptions')
      .map((v) => parseJsonArray(v))
    const hidden_type_ids = fd.getAll('hidden_type_ids').map((v) => String(v).trim()).filter(Boolean)

    const payload = {
      name,
      sport_id,
      notes: String(fd.get('notes') ?? '').trim() || null,
      timer_note: String(fd.get('timer_note') ?? '').trim() || null,
      expected_result_unit_id: expected_result_unit_id || null,
      allow_duplicate: true,
      status: !editing && publishImmediately ? 'published' : 'draft',
      exercise_ids,
      exercise_prescriptions,
      hidden_type_ids,
    }

    setPending(true)
    setError(null)
    try {
      const res = await fetch(
        editing ? `/api/admin/blocks/${blockId}` : '/api/admin/blocks',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        error?: string
        block?: SessionBlockDetail
      }
      if (!res.ok || !json.block) {
        setError(json.error || (editing ? 'Enregistrement impossible' : 'Création impossible'))
        return
      }
      onSaved(json.block)
      onClose()
    } catch {
      setError('Erreur réseau')
    } finally {
      setPending(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
        disabled={pending}
      />
      <div
        className="absolute left-1/2 top-1/2 z-10 flex max-h-[min(92vh,900px)] w-[min(640px,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-block-title"
      >
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="create-block-title" className="text-sm font-bold text-[color:var(--fg)]">
                {editing ? 'Éditer le bloc' : 'Nouveau bloc'}
              </h2>
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                {editing
                  ? 'Modifications appliquées au catalogue · séance à jour'
                  : publishImmediately
                    ? 'Publié directement (séance déjà publiée)'
                    : 'Brouillon catalogue · rattaché à la séance'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
              disabled={pending}
            >
              Fermer
            </button>
          </div>
        </div>

        <form
          key={formKey}
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => void onSubmit(e)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {!candidates.length || !units.length ? (
              <p className="text-sm text-[var(--warning)]">
                Catalogue incomplet (sports / unités / exos). Vérifie les migrations.
              </p>
            ) : (
              <BlockFicheEditor
                candidates={candidates}
                sports={sports}
                units={units}
                showDuplicate={false}
                requireComplete
                initial={{
                  name: initial?.name ?? '',
                  notes: initial?.notes ?? '',
                  timer_note: initial?.timer_note ?? '',
                  sport_id: initial?.sport_id ?? '',
                  expected_result_unit_id: initial?.expected_result_unit_id ?? '',
                  allow_duplicate: initial?.allow_duplicate !== false,
                  exercise_ids: initial?.exercise_ids ?? [],
                  exercise_prescriptions: initial?.exercise_prescriptions ?? [],
                  hidden_type_ids: initial?.hidden_type_ids ?? [],
                }}
              />
            )}
            {error ? (
              <p className="mt-3 text-[12px] font-semibold text-[var(--danger)]">{error}</p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-4 py-3">
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
                Annuler
              </Button>
              <Button type="submit" size="sm" disabled={pending || !candidates.length}>
                {pending
                  ? editing
                    ? 'Enregistrement…'
                    : 'Création…'
                  : editing
                    ? 'Enregistrer'
                    : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
