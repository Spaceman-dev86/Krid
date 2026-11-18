'use client'

import { useState } from 'react'

import { isPngOrGifMedia } from '@/src/lib/exerciseMedia'
import type { CoachBlockPreview } from '@/src/lib/blocks/loadCoachBlockPreview'

type Props = {
  preview: CoachBlockPreview
}

export function CoachBlockDetailView({ preview }: Props) {
  const [openId, setOpenId] = useState<string | null>(preview.exercises[0]?.id ?? null)
  const open = preview.exercises.find((e) => e.id === openId) ?? null

  const meta = [
    preview.sport_label,
    preview.type_labels.length ? preview.type_labels.join(' · ') : null,
    preview.timer_summary,
    preview.expected_result_label ? `Résultat : ${preview.expected_result_label}` : null,
    `${preview.exercises.length} exo${preview.exercises.length > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
      <div className="border-b border-[var(--border)] bg-[var(--page-bg)] px-4 py-3 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted)]">Aperçu</p>
        {meta ? (
          <p className="mt-1 text-sm text-[color:var(--muted)]">{meta}</p>
        ) : (
          <p className="mt-1 text-sm text-[color:var(--muted)]">—</p>
        )}
        {preview.notes ? (
          <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--fg)]">{preview.notes}</p>
        ) : null}
      </div>

      {!preview.exercises.length ? (
        <p className="px-4 py-8 text-center text-sm text-[color:var(--muted)] sm:px-5">
          Aucun exercice dans ce bloc.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 p-3 sm:p-4">
            {preview.exercises.map((ex) => {
              const active = ex.id === openId
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setOpenId(active ? null : ex.id)}
                  className={[
                    'min-w-[7rem] max-w-full flex-[1_1_7rem] rounded-[var(--radius-md)] px-3 py-2 text-left transition',
                    active
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-da-sm'
                      : 'bg-[var(--accent)] text-[color:var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]',
                  ].join(' ')}
                >
                  <span className="block truncate text-xs font-extrabold">{ex.name}</span>
                  {!active && ex.rxLines[0] ? (
                    <span
                      className={[
                        'mt-0.5 line-clamp-2 block text-[11px] font-semibold',
                        active ? 'opacity-90' : 'text-[color:var(--muted)]',
                      ].join(' ')}
                    >
                      {ex.rxLines[0]}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {open ? (
            <div className="border-t border-[var(--border)] bg-[var(--page-bg)]">
              {open.demo_media_url ? (
                <button
                  type="button"
                  onClick={() => setOpenId(null)}
                  className="relative block w-full overflow-hidden"
                  aria-label="Fermer la démo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={open.demo_media_url}
                    alt={open.name}
                    className={
                      isPngOrGifMedia(open.demo_media_path ?? open.demo_media_url)
                        ? 'mx-auto max-h-80 w-full object-contain p-3'
                        : 'h-64 w-full object-cover sm:h-72'
                    }
                    loading="lazy"
                  />
                </button>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-[color:var(--muted)] sm:px-5">
                  Pas de média démo sur cet exercice.
                </p>
              )}
              <div className="space-y-1 px-4 pb-4 sm:px-5">
                <p className="text-sm font-bold text-[color:var(--fg)]">{open.name}</p>
                {open.exercise_type_label ? (
                  <p className="text-[11px] font-semibold text-[color:var(--muted)]">
                    {open.exercise_type_label}
                  </p>
                ) : null}
                {open.rxLines.length ? (
                  <ul className="mt-1 space-y-0.5 text-xs font-semibold text-[color:var(--muted)]">
                    {open.rxLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[color:var(--muted)]">Pas de prescription renseignée.</p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </article>
  )
}
