'use client'

import { useMemo, useState } from 'react'

import { SessionLibraryPreviewModal } from '@/src/components/admin/SessionLibraryPreviewModal'
import { IconPlus, IconSearch } from '@/src/components/ui'

export type CatalogSessionPaletteItem = {
  id: string
  name: string | null
  notes: string | null
  item_count: number
  sport_ids: string[]
  type_ids: string[]
}

export type CatalogFilterOption = { id: string; label: string }

export function ProgramSessionPalette({
  items,
  sports,
  types,
  selectedTargetLabel,
  onAddToTarget,
  addDisabled,
}: {
  items: CatalogSessionPaletteItem[]
  sports: CatalogFilterOption[]
  types: CatalogFilterOption[]
  selectedTargetLabel: string | null
  onAddToTarget?: (librarySessionId: string) => void
  addDisabled?: boolean
}) {
  const [q, setQ] = useState('')
  const [sportId, setSportId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return items.filter((it) => {
      if (sportId && !(it.sport_ids ?? []).includes(sportId)) return false
      if (typeId && !(it.type_ids ?? []).includes(typeId)) return false
      if (!needle) return true
      const name = (it.name ?? '').toLowerCase()
      const notes = (it.notes ?? '').toLowerCase()
      return name.includes(needle) || notes.includes(needle)
    })
  }, [items, q, sportId, typeId])

  const selectClass =
    'h-7 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 text-[10px] font-semibold text-[color:var(--fg)]'

  return (
    <>
      <aside className="flex h-full min-h-[280px] w-full flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-sm lg:w-56 lg:shrink-0">
        <div className="border-b border-[var(--border)] px-2 py-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
            Séances catalogue
          </p>
          <p className="text-[9px] text-[color:var(--muted)]">
            {selectedTargetLabel
              ? `Cible : ${selectedTargetLabel} · glisser ou +`
              : 'Choisis un jour / slot, puis +'}
          </p>
          <label className="relative mt-1.5 block">
            <IconSearch
              size={12}
              className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[color:var(--muted)]"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="h-7 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] py-0 pl-6 pr-2 text-[11px] text-[color:var(--fg)] placeholder:text-[color:var(--muted)]"
            />
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              className={selectClass}
              aria-label="Filtrer par sport"
            >
              <option value="">Sport</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className={selectClass}
              aria-label="Filtrer par type"
            >
              <option value="">Type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
          {filtered.length ? (
            filtered.map((it) => (
              <div
                key={it.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/library-session-id', it.id)
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 py-1.5 shadow-da-sm"
              >
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing">
                    <p className="truncate text-[11px] font-semibold text-[color:var(--fg)]">
                      {it.name?.trim() || 'Sans titre'}
                    </p>
                    <p className="text-[9px] text-[color:var(--muted)]">
                      {it.item_count} item{it.item_count === 1 ? '' : 's'} · publiée
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                    aria-label="Aperçu séance"
                    title="Aperçu client"
                    onClick={() => setPreviewId(it.id)}
                  >
                    i
                  </button>
                  <button
                    type="button"
                    disabled={addDisabled || !onAddToTarget}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-40"
                    aria-label="Ajouter à la cible"
                    title={
                      selectedTargetLabel ? `Ajouter → ${selectedTargetLabel}` : 'Choisir une cible'
                    }
                    onClick={() => onAddToTarget?.(it.id)}
                  >
                    <IconPlus size={11} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="px-1 py-4 text-center text-[11px] text-[color:var(--muted)]">
              {items.length ? 'Aucun résultat.' : 'Aucune séance publiée.'}
            </p>
          )}
        </div>
      </aside>

      <SessionLibraryPreviewModal
        sessionId={previewId}
        onClose={() => setPreviewId(null)}
        insertLabel={selectedTargetLabel}
        insertDisabled={addDisabled}
        onInsert={
          previewId && onAddToTarget
            ? () => {
                onAddToTarget(previewId)
              }
            : undefined
        }
      />
    </>
  )
}
