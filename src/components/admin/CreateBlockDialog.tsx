'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  BlockFicheEditor,
  type BlockExerciseCandidate,
} from '@/src/components/admin/BlockFicheEditor'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button } from '@/src/components/ui'
import type { UnitRow } from '@/src/lib/blocks/constants'
import type { SessionBlockDetail } from '@/src/lib/sessions/blockDetail'

type Sport = { id: string; label: string }

export type CatalogBlockPublished = {
  id: string
  name: string
  sport_id: string | null
  status: string
}

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
  /**
   * Builder programme : copie figée (pas de block_library).
   * - create : POST program-session-blocks avec programSessionId
   * - edit : PATCH program-session-blocks/[sessionBlockId]
   */
  programSessionId?: string | null
  /** Vision coach : écrit `/api/coach/blocks` + CTAs Publier → Ma biblio / Brouillon. */
  coachMode?: boolean
  onClose: () => void
  onSaved: (block: SessionBlockDetail) => void
  /** Après Publier admin — pour refresh live du catalogue builder. */
  onCatalogPublished?: (block: CatalogBlockPublished) => void
}

function parseJsonArray(raw: FormDataEntryValue | null): unknown[] {
  try {
    const v = JSON.parse(String(raw ?? '[]'))
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Même UI que /admin/blocks/new|edit, en modal — Créer / Publier admin / Enregistrer. */
export function CreateBlockDialog({
  open,
  blockId = null,
  initial = null,
  candidates,
  sports,
  units,
  publishImmediately = false,
  programSessionId = null,
  coachMode = false,
  onClose,
  onSaved,
  onCatalogPublished,
}: Props) {
  const [mounted, setMounted] = useState(false)
  const [pendingKind, setPendingKind] = useState<'save' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formKey, setFormKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const publishAdminRef = useRef(false)
  /** Coach depuis séance / futur programme : usage éphémère | Ma biblio (pas de brouillon hub). */
  const coachDestRef = useRef<'usage' | 'mine'>('usage')
  /** Builder programme : create + edit passent par program-session-blocks. */
  const isProgramCopy = Boolean(programSessionId)
  const editing = Boolean(blockId)
  const pending = pendingKind != null
  const blocksApiBase = coachMode ? '/api/coach/blocks' : '/api/admin/blocks'

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setPendingKind(null)
    publishAdminRef.current = false
    coachDestRef.current = 'usage'
    setFormKey((k) => k + 1)
  }, [open, blockId, initial?.id, initial?.name, initial?.timer_note, initial?.notes])

  if (!open || !mounted) return null

  function emitCatalog(block: { id: string; name: string; sport_id?: string | null; status?: string }) {
    onCatalogPublished?.({
      id: block.id,
      name: block.name,
      sport_id: block.sport_id ?? null,
      status: block.status || 'published',
    })
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    e.stopPropagation()
    const fd = new FormData(e.currentTarget)
    const publishAdmin = publishAdminRef.current
    publishAdminRef.current = false
    const coachDest = coachDestRef.current
    coachDestRef.current = 'usage'

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

    const notes = String(fd.get('notes') ?? '').trim() || null
    const timer_note = String(fd.get('timer_note') ?? '').trim() || null
    const catalogPayload = {
      name,
      sport_id,
      notes,
      timer_note,
      expected_result_unit_id: expected_result_unit_id || null,
      allow_duplicate: true,
      status: 'published' as const,
      exercise_ids,
      exercise_prescriptions,
      hidden_type_ids,
    }

    const wantPublish =
      publishAdmin || (!editing && !isProgramCopy && publishImmediately)

    // Déjà publié → erreur immédiate (évite le PATCH long / spinner vide). Admin / programme only.
    if (
      !coachMode &&
      wantPublish &&
      editing &&
      (String(initial?.source_block_library_id ?? '').trim() ||
        String(initial?.status ?? '').toLowerCase() === 'published')
    ) {
      setError('Ce bloc est déjà publié dans le catalogue')
      return
    }

    setPendingKind(
      coachMode
        ? coachDest === 'mine'
          ? 'publish'
          : 'save'
        : wantPublish
          ? 'publish'
          : 'save',
    )
    setError(null)
    const publishSignal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(12_000)
        : undefined
    try {
      // Coach depuis parent : Ajouter = usage ; → Ma biblio = modèle hub (pas de → Brouillon).
      if (coachMode && !isProgramCopy) {
        const payload: Record<string, unknown> = {
          name,
          sport_id,
          notes,
          timer_note,
          expected_result_unit_id: expected_result_unit_id || null,
          allow_duplicate: true,
          exercise_ids,
          exercise_prescriptions,
          hidden_type_ids,
        }
        if (coachDest === 'usage') {
          // Création éphémère ; en édition = garder la destination actuelle (pas de demote).
          if (!editing) {
            payload.status = 'published'
            payload.hub_visible = false
          }
        } else {
          payload.status = 'published'
          payload.hub_visible = true
        }
        const res = await fetch(editing ? `${blocksApiBase}/${blockId}` : blocksApiBase, {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: publishSignal,
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!res.ok || !json.block) {
          setError(json.error || (editing ? 'Enregistrement impossible' : 'Création impossible'))
          return
        }
        if (coachDest === 'mine') emitCatalog(json.block)
        onSaved(json.block)
        onClose()
        return
      }

      // Édition copie programme + Publier admin (pas encore lié) → crée catalogue puis lie.
      if (wantPublish && isProgramCopy && editing && blockId) {
        const createRes = await fetch('/api/admin/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catalogPayload),
          signal: publishSignal,
        })
        const createJson = (await createRes.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!createRes.ok || !createJson.block) {
          setError(createJson.error || 'Publication impossible')
          return
        }
        const libraryId = createJson.block.id
        const progRes = await fetch(`/api/admin/program-session-blocks/${blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            sport_id,
            notes,
            timer_note,
            expected_result_unit_id: expected_result_unit_id || null,
            exercise_ids,
            exercise_prescriptions,
            source_block_library_id: libraryId,
          }),
          signal: publishSignal,
        })
        const progJson = (await progRes.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!progRes.ok || !progJson.block) {
          setError(progJson.error || 'Enregistrement programme impossible')
          return
        }
        emitCatalog(createJson.block)
        onSaved({ ...progJson.block, source_block_library_id: libraryId })
        onClose()
        return
      }

      // Création : Publier admin → catalogue published (+ fork programme si besoin).
      if (wantPublish && !editing) {
        const libRes = await fetch('/api/admin/blocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catalogPayload),
          signal: publishSignal,
        })
        const libJson = (await libRes.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!libRes.ok || !libJson.block) {
          setError(libJson.error || 'Publication impossible')
          return
        }

        emitCatalog(libJson.block)

        if (isProgramCopy && programSessionId) {
          const forkRes = await fetch('/api/admin/program-session-blocks/from-library', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              program_session_id: programSessionId,
              block_library_id: libJson.block.id,
            }),
            signal: publishSignal,
          })
          const forkJson = (await forkRes.json().catch(() => ({}))) as {
            error?: string
            block?: SessionBlockDetail
          }
          if (!forkRes.ok || !forkJson.block) {
            setError(forkJson.error || 'Ajout au programme impossible')
            return
          }
          onSaved(forkJson.block)
          onClose()
          return
        }

        onSaved(libJson.block)
        onClose()
        return
      }

      // Édition catalogue seul + Publier admin (draft → published)
      if (wantPublish && editing && !isProgramCopy && blockId) {
        const res = await fetch(`/api/admin/blocks/${blockId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(catalogPayload),
          signal: publishSignal,
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          block?: SessionBlockDetail
        }
        if (!res.ok || !json.block) {
          setError(json.error || 'Publication impossible')
          return
        }
        emitCatalog(json.block)
        onSaved(json.block)
        onClose()
        return
      }

      if (isProgramCopy) {
        const payload = {
          program_session_id: programSessionId,
          name,
          sport_id,
          notes,
          timer_note,
          expected_result_unit_id: expected_result_unit_id || null,
          exercise_ids,
          exercise_prescriptions,
        }
        const res = await fetch(
          editing
            ? `/api/admin/program-session-blocks/${blockId}`
            : '/api/admin/program-session-blocks',
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
        return
      }

      const payload = {
        name,
        sport_id,
        notes,
        timer_note,
        expected_result_unit_id: expected_result_unit_id || null,
        allow_duplicate: true,
        ...(editing ? {} : { status: 'draft' as const }),
        exercise_ids,
        exercise_prescriptions,
        hidden_type_ids,
      }
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
    } catch (err) {
      const aborted =
        err instanceof Error &&
        (err.name === 'AbortError' || err.name === 'TimeoutError')
      setError(aborted ? 'Publication trop longue — réessaie' : 'Erreur réseau')
    } finally {
      setPendingKind(null)
    }
  }

  return createPortal(
    <div
      className="da-vv-overlay z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-block-title"
      data-builder-chrome=""
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="da-vv-dialog relative z-10 flex w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="create-block-title" className="text-sm font-bold text-[color:var(--fg)]">
                {editing ? 'Éditer le bloc' : 'Nouveau bloc'}
              </h2>
              {!isProgramCopy ? (
                <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                  {coachMode
                    ? 'Ajouter = cette séance seulement · → Ma biblio = modèle réutilisable'
                    : editing
                      ? 'Publier admin met à jour le modèle catalogue'
                      : publishImmediately
                        ? 'Publié directement (séance déjà publiée)'
                        : 'Créer = brouillon · Publier admin = catalogue publié'}
                </p>
              ) : null}
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
          ref={formRef}
          key={formKey}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => void onSubmit(e)}
        >
          <div className="da-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
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
              {coachMode ? (
                <>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="!gap-1.5"
                    disabled={pending || !candidates.length}
                    title={
                      editing
                        ? 'Modifs pour cette séance seulement'
                        : 'Dans cette séance seulement (pas dans Blocs)'
                    }
                    onClick={() => {
                      coachDestRef.current = 'usage'
                    }}
                  >
                    {pendingKind === 'save' ? <FluidSpinner size={12} /> : null}
                    {pendingKind === 'save' ? '…' : editing ? 'Enregistrer' : 'Ajouter'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="!gap-1.5"
                    disabled={pending || !candidates.length}
                    title="Séance + modèle dans Ma biblio"
                    onClick={() => {
                      coachDestRef.current = 'mine'
                      formRef.current?.requestSubmit()
                    }}
                  >
                    {pendingKind === 'publish' ? (
                      <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
                    ) : null}
                    {pendingKind === 'publish' ? '…' : '→ Ma biblio'}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="!gap-1.5"
                    disabled={pending || !candidates.length}
                    title="Publie dans le catalogue admin"
                    onClick={() => {
                      publishAdminRef.current = true
                      formRef.current?.requestSubmit()
                    }}
                  >
                    {pendingKind === 'publish' ? <FluidSpinner size={12} /> : null}
                    {pendingKind === 'publish' ? 'Publication…' : 'Publier admin'}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="!gap-1.5"
                    disabled={pending || !candidates.length}
                    onClick={() => {
                      publishAdminRef.current = false
                    }}
                  >
                    {pendingKind === 'save' ? (
                      <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
                    ) : null}
                    {pendingKind === 'save'
                      ? editing
                        ? 'Enregistrement…'
                        : 'Création…'
                      : editing
                        ? 'Enregistrer'
                        : 'Créer'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
