'use client'

import { useMemo, useState } from 'react'

import { SessionLibraryPreviewModal } from '@/src/components/admin/SessionLibraryPreviewModal'
import { IconPlus, IconSearch } from '@/src/components/ui'

export type CatalogFilterOption = { id: string; label: string }

export type PaletteSessionItem = {
  id: string
  name: string | null
  notes: string | null
  item_count: number
  sport_ids: string[]
  type_ids: string[]
}

export type PaletteBlockItem = {
  id: string
  name: string
  sport_id: string | null
  status: string
}

export type PaletteExerciseItem = {
  id: string
  name: string
  sport_id: string | null
  exercise_type_id: string | null
}

type AccordionKey = 'sessions' | 'blocks' | 'exercises'

function AccordionHeader({
  open,
  label,
  count,
  onToggle,
}: {
  open: boolean
  label: string
  count: number
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-[var(--accent)]"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
        {open ? '▾' : '▸'} {label}
      </span>
      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-[color:var(--muted)]">
        {count}
      </span>
    </button>
  )
}

export function ProgramBuilderPalette({
  sessions,
  blocks,
  exercises,
  sports,
  types,
  selectedTargetLabel,
  addDisabled,
  onAddSession,
  onAddBlock,
  onAddExercise,
  onClose,
  className,
}: {
  sessions: PaletteSessionItem[]
  blocks: PaletteBlockItem[]
  exercises: PaletteExerciseItem[]
  sports: CatalogFilterOption[]
  types: CatalogFilterOption[]
  selectedTargetLabel: string | null
  addDisabled?: boolean
  onAddSession?: (id: string) => void
  onAddBlock?: (id: string) => void
  onAddExercise?: (id: string) => void
  onClose?: () => void
  className?: string
}) {
  const [open, setOpen] = useState<Record<AccordionKey, boolean>>({
    sessions: true,
    blocks: false,
    exercises: false,
  })
  const [q, setQ] = useState('')
  const [sportId, setSportId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [previewId, setPreviewId] = useState<string | null>(null)

  const needle = q.trim().toLowerCase()

  const filteredSessions = useMemo(() => {
    return sessions.filter((it) => {
      if (sportId && !(it.sport_ids ?? []).includes(sportId)) return false
      if (typeId && !(it.type_ids ?? []).includes(typeId)) return false
      if (!needle) return true
      return (
        (it.name ?? '').toLowerCase().includes(needle) ||
        (it.notes ?? '').toLowerCase().includes(needle)
      )
    })
  }, [sessions, sportId, typeId, needle])

  const filteredBlocks = useMemo(() => {
    return blocks.filter((it) => {
      if (sportId && it.sport_id !== sportId) return false
      if (!needle) return true
      return it.name.toLowerCase().includes(needle)
    })
  }, [blocks, sportId, needle])

  const filteredExercises = useMemo(() => {
    return exercises.filter((it) => {
      if (sportId && it.sport_id !== sportId) return false
      if (typeId && it.exercise_type_id !== typeId) return false
      if (!needle) return true
      return it.name.toLowerCase().includes(needle)
    })
  }, [exercises, sportId, typeId, needle])

  const selectClass =
    'h-7 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 text-[10px] font-semibold text-[color:var(--fg)]'

  function toggle(key: AccordionKey) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <>
      <aside
        className={
          className ??
          'flex h-full min-h-[320px] w-full flex-col rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] shadow-da-sm lg:w-60 lg:shrink-0'
        }
      >
        <div className="border-b border-[var(--border)] px-2 py-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Catalogue
              </p>
              <p className="text-[9px] text-[color:var(--muted)]">
                {selectedTargetLabel
                  ? `Cible : ${selectedTargetLabel}`
                  : 'Sélectionne un jour / une séance'}
              </p>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                aria-label="Fermer le catalogue"
              >
                ×
              </button>
            ) : null}
          </div>
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
              aria-label="Sport"
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
              aria-label="Type"
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

        <div className="flex-1 overflow-y-auto">
          <div className="border-b border-[var(--border)]">
            <AccordionHeader
              open={open.sessions}
              label="Séances"
              count={filteredSessions.length}
              onToggle={() => toggle('sessions')}
            />
            {open.sessions ? (
              <div className="space-y-1 px-1.5 pb-1.5">
                {filteredSessions.map((it) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/library-session-id', it.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 py-1"
                  >
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing">
                        <p className="truncate text-[11px] font-semibold text-[color:var(--fg)]">
                          {it.name?.trim() || 'Sans titre'}
                        </p>
                        <p className="text-[9px] text-[color:var(--muted)]">{it.item_count} items</p>
                      </div>
                      <button
                        type="button"
                        className="h-5 w-5 rounded text-[10px] font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
                        onClick={() => setPreviewId(it.id)}
                        title="Aperçu"
                      >
                        i
                      </button>
                      <button
                        type="button"
                        disabled={addDisabled}
                        className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-40"
                        onClick={() => onAddSession?.(it.id)}
                        title="Ajouter"
                      >
                        <IconPlus size={11} />
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredSessions.length ? (
                  <p className="px-1 py-2 text-center text-[10px] text-[color:var(--muted)]">Aucun</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-b border-[var(--border)]">
            <AccordionHeader
              open={open.blocks}
              label="Blocs"
              count={filteredBlocks.length}
              onToggle={() => toggle('blocks')}
            />
            {open.blocks ? (
              <div className="space-y-1 px-1.5 pb-1.5">
                {filteredBlocks.map((it) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/library-block-id', it.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 py-1"
                  >
                    <p className="min-w-0 flex-1 cursor-grab truncate text-[11px] font-semibold text-[color:var(--fg)] active:cursor-grabbing">
                      {it.name}
                    </p>
                    <button
                      type="button"
                      disabled={addDisabled}
                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-40"
                      onClick={() => onAddBlock?.(it.id)}
                    >
                      <IconPlus size={11} />
                    </button>
                  </div>
                ))}
                {!filteredBlocks.length ? (
                  <p className="px-1 py-2 text-center text-[10px] text-[color:var(--muted)]">Aucun</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div>
            <AccordionHeader
              open={open.exercises}
              label="Exercices"
              count={filteredExercises.length}
              onToggle={() => toggle('exercises')}
            />
            {open.exercises ? (
              <div className="space-y-1 px-1.5 pb-1.5">
                {filteredExercises.map((it) => (
                  <div
                    key={it.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/library-exercise-id', it.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] px-1.5 py-1"
                  >
                    <p className="min-w-0 flex-1 cursor-grab truncate text-[11px] font-semibold text-[color:var(--fg)] active:cursor-grabbing">
                      {it.name}
                    </p>
                    <button
                      type="button"
                      disabled={addDisabled}
                      className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-40"
                      onClick={() => onAddExercise?.(it.id)}
                    >
                      <IconPlus size={11} />
                    </button>
                  </div>
                ))}
                {!filteredExercises.length ? (
                  <p className="px-1 py-2 text-center text-[10px] text-[color:var(--muted)]">Aucun</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <SessionLibraryPreviewModal
        sessionId={previewId}
        onClose={() => setPreviewId(null)}
        insertLabel={selectedTargetLabel}
        insertDisabled={addDisabled}
        onInsert={
          previewId && onAddSession
            ? () => {
                onAddSession(previewId)
              }
            : undefined
        }
      />
    </>
  )
}
