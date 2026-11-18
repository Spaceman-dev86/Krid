'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { Button, IconPlus, daFieldClass } from '@/src/components/ui'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import {
  CatalogLibraryPreviewModal,
  prefetchCatalogPreview,
  type CatalogPreviewTarget,
} from '@/src/components/admin/SessionLibraryPreviewModal'
import type { PaletteSessionItem } from '@/src/components/admin/ProgramBuilderPalette'
import {
  createEmptyProgramSessionQuietAction,
  publishProgramSessionToLibraryQuietAction,
  updateTrainlyProgramSessionMetaAction,
  type BoardMutationPatch,
  type CatalogSessionPaletteItem,
} from '@/src/app/admin/programs/programSessionActions'

export type SessionMetaDefaults = {
  title?: string | null
  notes?: string | null
  objective_ressenti?: boolean
  objective_note?: boolean
  objective_difficulty?: boolean
}

type SharedFields = {
  programId: string
  weekId: string
  day?: number
  pending?: boolean
  onClose: () => void
  /** Appelé après update meta réussi (sans navigation). */
  onSaved?: (patch: SessionMetaDefaults & { title: string }, flash?: string) => void
  /** Création quiet — patch board sans fermer le jour. */
  onCreated?: (board: BoardMutationPatch, day: number, flash?: string) => void
  /** Après Publier admin — refresh live palette builder. */
  onCatalogPublished?: (session: CatalogSessionPaletteItem) => void
  defaults?: SessionMetaDefaults
}

type CreateProps = SharedFields & {
  mode: 'create'
  day: number
  dayLabel: string
  /** Séances catalogue pour l’onglet Catalogue (+ Séance). */
  catalogSessions?: PaletteSessionItem[]
  onPickLibrarySession?: (librarySessionId: string) => void
}

type EditProps = SharedFields & {
  mode: 'edit'
  sessionId: string
}

type Props = CreateProps | EditProps

type CreateTab = 'new' | 'catalog'

export function ProgramSessionMetaPopup(props: Props) {
  const { programId, weekId, day, pending, onClose, onSaved, onCreated, onCatalogPublished, defaults } =
    props
  const isCreate = props.mode === 'create'
  const restoreDay = isCreate ? props.day : day
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingKind, setPendingKind] = useState<'save' | 'publish' | null>(null)
  const [, startSaving] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const publishAdminRef = useRef(false)
  const backdropMouseDownRef = useRef(false)
  const [createTab, setCreateTab] = useState<CreateTab>('new')
  const [catalogQ, setCatalogQ] = useState('')
  const [previewTarget, setPreviewTarget] = useState<CatalogPreviewTarget>(null)

  const catalogSessions = isCreate ? (props.catalogSessions ?? []) : []
  const onPickLibrarySession = isCreate ? props.onPickLibrarySession : undefined

  const filteredCatalog = useMemo(() => {
    const needle = catalogQ.trim().toLowerCase()
    if (!needle) return catalogSessions
    return catalogSessions.filter(
      (s) =>
        (s.name ?? '').toLowerCase().includes(needle) ||
        (s.notes ?? '').toLowerCase().includes(needle),
    )
  }, [catalogSessions, catalogQ])

  useEffect(() => setMounted(true), [])

  function pickLibrarySession(id: string) {
    onPickLibrarySession?.(id)
    onClose()
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const wantPublish = publishAdminRef.current
    publishAdminRef.current = false
    if (isCreate && wantPublish) {
      formData.set('publish_admin', '1')
    }
    setError(null)
    setPendingKind(wantPublish ? 'publish' : 'save')
    startSaving(async () => {
      try {
        if (isCreate) {
          const res = await createEmptyProgramSessionQuietAction(formData)
          if (!res.ok) {
            setError(res.error)
            return
          }
          if (res.catalogSession) onCatalogPublished?.(res.catalogSession)
          onCreated?.(res.board, res.day ?? props.day, res.flash)
          onClose()
          return
        }

        if (wantPublish) {
          const res = await publishProgramSessionToLibraryQuietAction(formData)
          if (!res.ok) {
            setError(res.error)
            return
          }
          onCatalogPublished?.(res.catalogSession)
          onSaved?.(
            {
              title: String(formData.get('title') ?? '').trim() || 'Séance',
              notes: String(formData.get('notes') ?? '').trim() || null,
              objective_ressenti: formData.get('objective_ressenti') === 'on',
              objective_note: formData.get('objective_note') === 'on',
              objective_difficulty: formData.get('objective_difficulty') === 'on',
            },
            res.flash,
          )
          onClose()
          return
        }

        const res = await updateTrainlyProgramSessionMetaAction(formData)
        if (!res.ok) {
          setError(res.error)
          return
        }
        onSaved?.({
          title: String(formData.get('title') ?? '').trim() || 'Séance',
          notes: String(formData.get('notes') ?? '').trim() || null,
          objective_ressenti: formData.get('objective_ressenti') === 'on',
          objective_note: formData.get('objective_note') === 'on',
          objective_difficulty: formData.get('objective_difficulty') === 'on',
        })
        onClose()
      } finally {
        setPendingKind(null)
      }
    })
  }

  const busy = Boolean(pending || pendingKind)

  if (!mounted) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      data-builder-chrome=""
      className="da-vv-overlay z-[9999] flex items-center justify-center bg-black/50 p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        e.stopPropagation()
        backdropMouseDownRef.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        e.stopPropagation()
        // Évite de fermer si la sélection texte a commencé dans la popup
        // et que le mouseup / click arrive sur le fond.
        if (e.target === e.currentTarget && backdropMouseDownRef.current) onClose()
        backdropMouseDownRef.current = false
      }}
    >
      <div
        className="da-vv-dialog w-full max-w-md overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-[color:var(--fg)]">
              {isCreate ? 'Nouvelle séance' : 'Infos séance'}
            </h4>
            {isCreate ? (
              <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">Sur {props.dayLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)]"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {isCreate && onPickLibrarySession ? (
          <div className="mb-3 flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant={createTab === 'new' ? undefined : 'secondary'}
              className="!h-7 !rounded-full !px-2.5 !text-[11px]"
              onClick={() => setCreateTab('new')}
            >
              Nouvelle
            </Button>
            <Button
              type="button"
              size="sm"
              variant={createTab === 'catalog' ? undefined : 'secondary'}
              className="!h-7 !rounded-full !px-2.5 !text-[11px]"
              onClick={() => setCreateTab('catalog')}
            >
              Catalogue
            </Button>
          </div>
        ) : null}

        {isCreate && createTab === 'catalog' && onPickLibrarySession ? (
          <div className="space-y-2">
            <input
              value={catalogQ}
              onChange={(e) => setCatalogQ(e.target.value)}
              placeholder="Rechercher une séance…"
              className={daFieldClass}
              autoFocus
            />
            <ul className="da-scrollbar max-h-64 space-y-1 overflow-y-auto">
              {filteredCatalog.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-[color:var(--fg)]">
                      {it.name?.trim() || 'Sans titre'}
                    </p>
                    <p className="text-[10px] text-[color:var(--muted)]">{it.item_count} items</p>
                  </div>
                  <button
                    type="button"
                    className="h-6 w-6 shrink-0 rounded text-[11px] font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
                    onPointerEnter={() => prefetchCatalogPreview('session', it.id)}
                    onFocus={() => prefetchCatalogPreview('session', it.id)}
                    onPointerDown={() => prefetchCatalogPreview('session', it.id)}
                    onClick={() =>
                      setPreviewTarget({
                        kind: 'session',
                        id: it.id,
                        nameHint: it.name?.trim() || 'Sans titre',
                      })
                    }
                    title="Aperçu"
                    aria-label="Aperçu séance"
                  >
                    i
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-40"
                    onClick={() => pickLibrarySession(it.id)}
                    title="Ajouter"
                    aria-label="Ajouter la séance"
                  >
                    <IconPlus size={12} />
                  </button>
                </li>
              ))}
              {!filteredCatalog.length ? (
                <li className="px-2 py-4 text-center text-[12px] text-[color:var(--muted)]">
                  Aucune séance
                </li>
              ) : null}
            </ul>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!h-8 !rounded-full !px-3 !text-[12px]"
                onClick={onClose}
                disabled={busy}
              >
                Annuler
              </Button>
            </div>
            <CatalogLibraryPreviewModal
              target={previewTarget}
              onClose={() => setPreviewTarget(null)}
              insertLabel={isCreate ? props.dayLabel : null}
              insertDisabled={busy}
              onInsert={
                previewTarget?.kind === 'session'
                  ? () => {
                      pickLibrarySession(previewTarget.id)
                      setPreviewTarget(null)
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
            <input type="hidden" name="program_id" value={programId} />
            <input type="hidden" name="week_id" value={weekId} />
            {restoreDay != null ? (
              <input type="hidden" name="day" value={String(restoreDay)} />
            ) : null}
            {isCreate ? (
              <input type="hidden" name="target_order" value={String(props.day)} />
            ) : (
              <input type="hidden" name="session_id" value={props.sessionId} />
            )}

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Nom *</span>
              <input
                name="title"
                required
                autoFocus
                defaultValue={defaults?.title?.trim() || ''}
                placeholder="Nom de la séance"
                className={daFieldClass}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold text-[color:var(--muted)]">Notes</span>
              <textarea
                name="notes"
                rows={3}
                defaultValue={defaults?.notes?.trim() || ''}
                placeholder="Consignes coach…"
                className={daFieldClass}
              />
            </label>

            <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--page-bg)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Feedback client (fin de séance)
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--muted)]">
                Hors composition — questions après la séance.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-[color:var(--fg)]">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="objective_ressenti"
                    defaultChecked={defaults?.objective_ressenti !== false}
                    className="accent-[var(--brand)]"
                  />
                  Ressenti
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="objective_note"
                    defaultChecked={defaults?.objective_note !== false}
                    className="accent-[var(--brand)]"
                  />
                  Note
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="objective_difficulty"
                    defaultChecked={defaults?.objective_difficulty !== false}
                    className="accent-[var(--brand)]"
                  />
                  Difficulté (5 smileys)
                </label>
              </div>
            </section>

            {error ? (
              <p className="text-[12px] font-semibold text-[var(--danger)]">{error}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!h-8 !rounded-full !px-3 !text-[12px]"
                onClick={onClose}
                disabled={busy}
              >
                Annuler
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="!h-8 !gap-1.5 !rounded-full !px-3 !text-[12px]"
                disabled={busy}
                title={
                  isCreate
                    ? 'Crée la séance et un modèle catalogue vide'
                    : 'Publie la composition dans le catalogue admin'
                }
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
                className="!h-8 !gap-1.5 !rounded-full !px-3 !text-[12px]"
                disabled={busy}
                onClick={() => {
                  publishAdminRef.current = false
                }}
              >
                {pendingKind === 'save' ? (
                  <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
                ) : null}
                {isCreate
                  ? pendingKind === 'save'
                    ? 'Création…'
                    : 'Créer'
                  : pendingKind === 'save'
                    ? 'Enregistrement…'
                    : 'Enregistrer'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  )
}
