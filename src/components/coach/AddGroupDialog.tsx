'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  createLinkedGroupFromPrestaAction,
  createManualGroupAction,
} from '@/src/app/clients/groupes/actions'
import { Button, IconButton, IconClose, IconPlus, daFieldClass, daSelectClass } from '@/src/components/ui'

type PrestaOpt = { id: string; name: string }
type ProgramOpt = { id: string; title: string }
type ClientOpt = {
  id: string
  label: string
  prestationIds: string[]
  programIds: string[]
}

function SubmitCreate({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? 'Création…' : label}
    </Button>
  )
}

type Props = {
  linkablePrestations?: PrestaOpt[]
  /** Toutes les prestas (filtre membres). */
  filterPrestations?: PrestaOpt[]
  filterPrograms?: ProgramOpt[]
  clients?: ClientOpt[]
  defaultKind?: 'libre' | 'lie'
  defaultPrestationId?: string | null
}

export function AddGroupDialog({
  linkablePrestations = [],
  filterPrestations = [],
  filterPrograms = [],
  clients = [],
  defaultKind = 'libre',
  defaultPrestationId = null,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(defaultKind === 'lie')
  const [kind, setKind] = useState<'libre' | 'lie'>(defaultKind)
  const [filterPresta, setFilterPresta] = useState('')
  const [filterProgram, setFilterProgram] = useState('')
  const [memberQ, setMemberQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const canLink = linkablePrestations.length > 0
  const initialPresta = useMemo(() => {
    if (defaultPrestationId && linkablePrestations.some((p) => p.id === defaultPrestationId)) {
      return defaultPrestationId
    }
    return linkablePrestations[0]?.id ?? ''
  }, [defaultPrestationId, linkablePrestations])

  const filteredClients = useMemo(() => {
    const q = memberQ.trim().toLowerCase()
    return clients.filter((c) => {
      if (filterPresta && !c.prestationIds.includes(filterPresta)) return false
      if (filterProgram && !c.programIds.includes(filterProgram)) return false
      if (q && !c.label.toLowerCase().includes(q)) return false
      return true
    })
  }, [clients, filterPresta, filterProgram, memberQ])

  useEffect(() => {
    if (!open) return
    setKind(defaultKind === 'lie' && canLink ? 'lie' : 'libre')
    setSelected(new Set())
    setFilterPresta('')
    setFilterProgram('')
    setMemberQ('')
  }, [open, defaultKind, canLink])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const c of filteredClients) next.add(c.id)
      return next
    })
  }

  return (
    <>
      <IconButton type="button" label="Ajouter un groupe" tone="solid" size="md" onClick={() => setOpen(true)}>
        <IconPlus size={20} />
      </IconButton>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[1] flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:max-h-[85vh] sm:rounded-[1.25rem]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
              <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
                Nouveau groupe
              </p>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                <IconClose size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-4 flex gap-1 rounded-xl bg-[var(--accent)] p-1">
                <button
                  type="button"
                  onClick={() => setKind('libre')}
                  className={
                    kind === 'libre'
                      ? 'flex-1 rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[color:var(--brand)] shadow-da-sm'
                      : 'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)]'
                  }
                >
                  Libre
                </button>
                <button
                  type="button"
                  onClick={() => canLink && setKind('lie')}
                  disabled={!canLink}
                  className={
                    kind === 'lie'
                      ? 'flex-1 rounded-lg bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[color:var(--brand)] shadow-da-sm'
                      : 'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] disabled:opacity-40'
                  }
                >
                  Lié à une presta
                </button>
              </div>

              {kind === 'libre' ? (
                <form id="create-libre-group" action={createManualGroupAction} className="grid gap-3">
                  {Array.from(selected).map((id) => (
                    <input key={id} type="hidden" name="member_id" value={id} />
                  ))}
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Nom *</span>
                    <input
                      name="name"
                      required
                      autoFocus
                      placeholder="Challenge avril"
                      className={daFieldClass}
                    />
                  </label>

                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[color:var(--fg)]">
                        Membres
                        <span className="ml-1 font-normal text-[color:var(--muted)]">
                          ({selected.size} choisi{selected.size > 1 ? 's' : ''})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={selectVisible}
                        className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
                      >
                        Tout cocher (filtrés)
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs">
                        <span className="font-semibold text-[color:var(--muted)]">Presta</span>
                        <select
                          value={filterPresta}
                          onChange={(e) => setFilterPresta(e.target.value)}
                          className={daSelectClass}
                        >
                          <option value="">Toutes</option>
                          {filterPrestations.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs">
                        <span className="font-semibold text-[color:var(--muted)]">Programme</span>
                        <select
                          value={filterProgram}
                          onChange={(e) => setFilterProgram(e.target.value)}
                          className={daSelectClass}
                        >
                          <option value="">Tous</option>
                          {filterPrograms.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <input
                      type="search"
                      value={memberQ}
                      onChange={(e) => setMemberQ(e.target.value)}
                      placeholder="Rechercher un client…"
                      className={daFieldClass}
                    />
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-2">
                      {!filteredClients.length ? (
                        <p className="px-2 py-3 text-xs text-[color:var(--muted)]">Aucun client.</p>
                      ) : (
                        filteredClients.map((c) => (
                          <label
                            key={c.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[color:var(--fg)] hover:bg-[var(--accent)]"
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggle(c.id)}
                            />
                            <span className="min-w-0 truncate">{c.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-[color:var(--muted)]">
                      Chat et Drive s’activent ensuite sur la fiche groupe.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpen(false)}
                      className="!rounded-lg !px-4 !py-2 text-sm"
                    >
                      Annuler
                    </Button>
                    <SubmitCreate label="Créer" />
                  </div>
                </form>
              ) : (
                <form id="create-lie-group" action={createLinkedGroupFromPrestaAction} className="grid gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Prestation *</span>
                    <select
                      name="prestation_id"
                      required
                      defaultValue={initialPresta}
                      className={daSelectClass}
                    >
                      {linkablePrestations.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-semibold">Nom du groupe</span>
                    <input
                      name="name"
                      placeholder="Par défaut = nom de la presta"
                      className={daFieldClass}
                    />
                  </label>
                  <p className="text-xs text-[color:var(--muted)]">
                    Membres = grants actifs Soft (backfill auto). Chat / Drive sur la fiche ensuite.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setOpen(false)}
                      className="!rounded-lg !px-4 !py-2 text-sm"
                    >
                      Annuler
                    </Button>
                    <SubmitCreate label="Créer le groupe lié" />
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
