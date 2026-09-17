'use client'

import { createPortal } from 'react-dom'
import { useMemo, useState } from 'react'

import { EDITOR_SIDEBAR_MAX_H } from '../../../../components/program-editor-v2/editorLayoutConstants'
import {
  EDITOR_PANEL_SHADOW_CLASS,
  EDITOR_ROUNDED_FIELD_CLASS,
  EDITOR_TEXT_INPUT_X,
  EDITOR_TEXT_INPUT_X_DENSE,
} from '../../../../components/program-editor-v2/ui/editorInputStyles'
import { EDITOR_SECTION_TITLE_CLASS } from '../../../../components/program-editor-v2/ui/editorSectionTitle'

type PreviewWeek = {
  id: string
  title: string
  sessions: unknown[]
}

type ExercisePreview = {
  id: string
  name: string | null
}

type Props = {
  paletteBlocks: string[]
  previewWeeks: PreviewWeek[]
  exercises: ExercisePreview[]
  uniqueMuscles: string[]
}

function PalettePreviewRow({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center rounded-none border-0 border-b border-[var(--brand)]/30 bg-white px-2.5 py-2 text-left text-[var(--brand)]">
      <span className="min-w-0 flex-1 text-sm font-extrabold">{label}</span>
    </div>
  )
}

export default function NewProgramLockedPreviewClient({
  paletteBlocks,
  previewWeeks,
  exercises,
  uniqueMuscles,
}: Props) {
  const [open, setOpen] = useState(false)
  const canUseDom = useMemo(() => typeof document !== 'undefined', [])

  return (
    <>
      <div
        className="relative flex cursor-default items-start select-none"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Crée le programme pour pouvoir l'éditer"
      >
        <aside
          className={[
            'hidden min-[1000px]:block min-[1000px]:sticky min-[1000px]:top-0 min-[1000px]:w-[220px] min-[1000px]:shrink-0',
            'min-[1000px]:self-start min-[1000px]:overflow-y-auto min-[1000px]:overscroll-contain min-[1000px]:p-4',
            EDITOR_SIDEBAR_MAX_H,
          ].join(' ')}
        >
          <div className={`relative rounded-2xl bg-white px-3 pb-3 pt-2 ${EDITOR_PANEL_SHADOW_CLASS}`}>
            <div className={EDITOR_SECTION_TITLE_CLASS}>Blocs</div>
            <p className="mt-1 text-[10px] font-medium text-[color:var(--muted)]">Glisser dans une séance ouverte.</p>
            <div className="mt-2 grid gap-1.5">
              {paletteBlocks.map((label) => (
                <PalettePreviewRow key={label} label={label} />
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 pb-8">
          <div className="grid w-full gap-3 pb-6">
            {previewWeeks.map((w) => (
              <section
                key={w.id}
                className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] ${EDITOR_PANEL_SHADOW_CLASS}`}
              >
                <div className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-[#fafafa]">
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${EDITOR_SECTION_TITLE_CLASS}`}>{w.title}</div>
                    <div className="mt-1 text-[10px] font-semibold text-black/40">
                      {w.sessions.length} séance{w.sessions.length > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            <div
              className={`inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)] ${EDITOR_PANEL_SHADOW_CLASS}`}
            >
              + Ajouter une semaine
            </div>
          </div>
        </div>

        <aside
          className={[
            'hidden min-[768px]:sticky min-[768px]:top-0 min-[768px]:flex min-[768px]:shrink-0',
            'min-[768px]:self-start min-[768px]:flex-col min-[768px]:gap-3',
            'min-[768px]:w-[clamp(200px,28vw,320px)] min-[768px]:overflow-hidden min-[768px]:p-4',
            'min-[1000px]:w-[clamp(160px,22vw,320px)]',
            EDITOR_SIDEBAR_MAX_H,
          ].join(' ')}
        >
          <div className="min-[768px]:max-[999px]:block min-[1000px]:hidden min-[768px]:max-[999px]:shrink-0 min-[768px]:max-[999px]:overflow-y-auto min-[768px]:max-[999px]:overscroll-contain">
            <div className={`relative rounded-2xl bg-white px-3 pb-3 pt-2 ${EDITOR_PANEL_SHADOW_CLASS}`}>
              <div className={EDITOR_SECTION_TITLE_CLASS}>Blocs</div>
              <p className="mt-1 text-[10px] font-medium text-[color:var(--muted)]">Glisser dans une séance ouverte.</p>
              <div className="mt-2 grid gap-1.5">
                {paletteBlocks.map((label) => (
                  <PalettePreviewRow key={`mid-${label}`} label={label} />
                ))}
              </div>
            </div>
          </div>

          <div
            className={`relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white ${EDITOR_PANEL_SHADOW_CLASS} min-[768px]:flex-1`}
          >
            <div className="shrink-0 rounded-t-2xl bg-white px-3 pb-3 pt-3">
              <div className={`${EDITOR_SECTION_TITLE_CLASS} truncate whitespace-nowrap`}>
                Bibliothèque d&apos;exercice
              </div>
              <p className="mt-1 text-[10px] font-medium text-[color:var(--muted)]">
                Glisser dans une séance ou un bloc ouvert.
              </p>

              <div className="mt-2 flex items-center gap-2">
                <input
                  disabled
                  placeholder="Rechercher…"
                  className={`h-9 w-full min-w-0 flex-1 ${EDITOR_ROUNDED_FIELD_CLASS} ${EDITOR_TEXT_INPUT_X} text-sm`}
                />
                <select
                  disabled
                  className={`h-9 w-[108px] flex-none rounded-xl border border-gray-200 bg-white ${EDITOR_TEXT_INPUT_X_DENSE} pr-7 text-sm`}
                >
                  <option value="">Muscle</option>
                  {uniqueMuscles.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {exercises.length ? (
              <div className="relative mt-1 px-3 pb-3 pr-1">
                <div className="grid gap-1.5">
                  {exercises.slice(0, 10).map((ex) => (
                    <div
                      key={ex.id}
                      className="overflow-hidden rounded-xl border border-[var(--brand)]/30 bg-white px-2.5 py-2 text-sm font-extrabold text-[var(--brand)]"
                    >
                      <div className="truncate">{String(ex.name ?? '').trim() || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 px-3 pb-3 text-sm text-[color:var(--muted)]">Aucun exercice.</div>
            )}
          </div>
        </aside>
      </div>

      {canUseDom && open
        ? createPortal(
            <div className="fixed inset-0 z-[9999]">
              <button
                type="button"
                className="absolute inset-0 bg-black/30"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              />

              <div className="absolute left-1/2 top-24 z-10 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2">
                <div className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
                  <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
                    <div className="text-sm font-extrabold text-[var(--brand)]">Édition indisponible</div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50"
                      onClick={() => setOpen(false)}
                      aria-label="Fermer"
                      title="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="text-sm font-semibold text-gray-900">
                      Crée le programme pour pouvoir l&apos;éditer.
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/10"
                        onClick={() => setOpen(false)}
                      >
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
