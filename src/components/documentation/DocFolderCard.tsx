'use client'

import { useId, type ReactNode } from 'react'

import { cn } from '@/src/lib/cn'

type Props = {
  /** String ou nœud (ex. rename inline Drive). */
  title: ReactNode
  subtitle?: string | null
  /** Badge principal = docs / fichiers. */
  count: number
  /** Tooltip du badge count. */
  countTitle?: string
  /** Badge secondaire (ex. nb de clients partagés Drive). */
  shareCount?: number
  shareCountTitle?: string
  /** Clic badge fichiers (stopPropagation). */
  onCountClick?: (e: React.MouseEvent) => void
  /** Clic badge partages. */
  onShareCountClick?: (e: React.MouseEvent) => void
  /** Crayon rename à droite du titre (galerie). Déprécié si `title` est déjà le contrôle. */
  titleAccessory?: ReactNode
  /** Remplace « Ouvrir → » (ex. déplacer / partager). */
  footerActions?: ReactNode
  /** Coin haut droite (ex. poubelle). */
  corner?: ReactNode
  /** Brouillons admin (optionnel). */
  draftCount?: number
  onOpen: () => void
  tone?: 'default' | 'system'
}

function CountBadges({
  count,
  draftCount,
  countTitle,
  shareCount,
  shareCountTitle,
  onCountClick,
  onShareCountClick,
}: {
  count: number
  draftCount: number
  countTitle: string
  shareCount?: number
  shareCountTitle?: string
  onCountClick?: (e: React.MouseEvent) => void
  onShareCountClick?: (e: React.MouseEvent) => void
}) {
  const countCls =
    'inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand-fg)] shadow-da-sm'
  const shareCls =
    'inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--fg)] ring-1 ring-[var(--border)]'

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {draftCount > 0 ? (
        <span
          className="rounded-full bg-[var(--accent)] px-2 py-1 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]"
          title={`${draftCount} brouillon${draftCount > 1 ? 's' : ''} (invisible coach)`}
        >
          {draftCount} br.
        </span>
      ) : null}
      {onCountClick ? (
        <button type="button" className={countCls} title={countTitle} onClick={onCountClick}>
          {count}
        </button>
      ) : (
        <span className={countCls} title={countTitle}>
          {count}
        </span>
      )}
      {shareCount != null ? (
        onShareCountClick ? (
          <button
            type="button"
            className={shareCls}
            title={shareCountTitle ?? 'Partages'}
            onClick={onShareCountClick}
          >
            {shareCount}
          </button>
        ) : (
          <span className={shareCls} title={shareCountTitle ?? 'Partages'}>
            {shareCount}
          </span>
        )
      ) : null}
    </span>
  )
}

/**
 * Desktop / tablette : pochette 3D.
 * Téléphone (< sm) : ligne liste sans graphisme dossier.
 */
export function DocFolderCard({
  title,
  subtitle,
  count,
  countTitle = 'Documents publiés (visibles coach)',
  shareCount,
  shareCountTitle,
  onCountClick,
  onShareCountClick,
  titleAccessory,
  footerActions,
  corner,
  draftCount = 0,
  onOpen,
  tone = 'default',
}: Props) {
  const uid = useId().replace(/:/g, '')
  const gBack = `df-b-${uid}`
  const gFront = `df-f-${uid}`

  // div (pas button) pour autoriser les pastilles cliquables sans bouton imbriqué
  return (
    <div
      className={cn(
        'group w-full min-w-0 text-left',
        'doc-folder-real',
        tone === 'system' && 'doc-folder-real--system',
      )}
    >
      {/* Liste téléphone — pas de bouton imbriqué (title peut contenir rename). */}
      <div
        className={cn(
          'relative flex w-full min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 shadow-da-sm sm:hidden',
          tone === 'system' && 'ring-1 ring-[color-mix(in_srgb,var(--brand)_28%,transparent)]',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_22%,var(--page-bg))] text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            aria-label="Ouvrir le dossier"
          >
            <span aria-hidden>📁</span>
          </button>
          <div
            className="min-w-0 flex-1"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('button, input')) return
              onOpen()
            }}
          >
            {typeof title === 'string' ? (
              <span className="block truncate text-sm font-extrabold text-[color:var(--fg)]">{title}</span>
            ) : (
              title
            )}
            {subtitle ? (
              <span className="mt-0.5 block line-clamp-1 text-[11px] text-[color:var(--muted)]">{subtitle}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 text-sm font-semibold text-[var(--brand)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
            aria-label="Ouvrir le dossier"
          >
            →
          </button>
          <CountBadges
            count={count}
            draftCount={draftCount}
            countTitle={countTitle}
            shareCount={shareCount}
            shareCountTitle={shareCountTitle}
            onCountClick={onCountClick}
            onShareCountClick={onShareCountClick}
          />
        </div>
        {footerActions ? (
          <div className="pointer-events-auto relative z-[5] flex justify-end" data-no-dnd data-folder-chrome>
            {footerActions}
          </div>
        ) : null}
      </div>

      {/* Pochette sm+ — click stage ouvre ; zones chrome (rename/actions) stoppent. */}
      <div
        className="doc-folder-real__stage relative hidden cursor-pointer sm:block"
        role="button"
        tabIndex={0}
        aria-label="Ouvrir le dossier"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-folder-chrome], button, a, input, select, textarea, label')) {
            return
          }
          onOpen()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpen()
          }
        }}
      >
        {corner ? (
          <div className="pointer-events-auto absolute right-2 top-2 z-[3]" data-folder-chrome>
            {corner}
          </div>
        ) : null}
        <span className="doc-folder-real__contact pointer-events-none" aria-hidden />

        <svg className="doc-folder-real__back pointer-events-none" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <linearGradient id={gBack} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="var(--folder-back-hi)" />
              <stop offset="100%" stopColor="var(--folder-back-lo)" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gBack})`}
            d="
              M 24 70
              C 24 42, 32 30, 48 30
              H 112
              L 146 54
              H 272
              C 288 54, 296 62, 296 78
              V 196
              C 296 208, 286 214, 274 214
              H 46
              C 34 214, 24 208, 24 196
              Z
            "
          />
        </svg>

        <span className="doc-folder-real__papers pointer-events-none" aria-hidden>
          <span className="doc-folder-real__sheet doc-folder-real__sheet--a" />
          <span className="doc-folder-real__sheet doc-folder-real__sheet--b" />
          <span className="doc-folder-real__sheet doc-folder-real__sheet--c" />
        </span>

        <svg className="doc-folder-real__front pointer-events-none" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet" aria-hidden>
          <defs>
            <linearGradient id={gFront} x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="var(--folder-front-hi)" />
              <stop offset="100%" stopColor="var(--folder-front-lo)" />
            </linearGradient>
          </defs>
          <path
            fill={`url(#${gFront})`}
            d="
              M 24 100
              C 24 86, 34 78, 48 78
              H 272
              C 286 78, 296 86, 296 100
              V 196
              C 296 208, 286 214, 274 214
              H 46
              C 34 214, 24 208, 24 196
              Z
            "
          />
        </svg>

        <span className="doc-folder-real__content pointer-events-none">
          <span className="doc-folder-real__text">
            <span className="doc-folder-real__eyebrow block font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Dossier
            </span>
            <span className="relative z-[3] mt-0.5 flex min-w-0 items-center gap-1">
              {typeof title === 'string' ? (
                <span className="doc-folder-real__title block min-w-0 truncate font-extrabold tracking-tight text-[color:var(--fg)]">
                  {title}
                </span>
              ) : (
                title
              )}
              {titleAccessory ? (
                <span className="pointer-events-auto shrink-0" data-folder-chrome>
                  {titleAccessory}
                </span>
              ) : null}
            </span>
            {subtitle ? (
              <span className="doc-folder-real__sub mt-0.5 block text-[color:var(--muted)]">{subtitle}</span>
            ) : null}
          </span>
          <span className="doc-folder-real__footer mt-auto flex items-center justify-between gap-2 pt-1.5">
            {footerActions ? (
              <>
                <span className="pointer-events-auto relative z-[2]" data-folder-chrome>
                  <CountBadges
                    count={count}
                    draftCount={draftCount}
                    countTitle={countTitle}
                    shareCount={shareCount}
                    shareCountTitle={shareCountTitle}
                    onCountClick={onCountClick}
                    onShareCountClick={onShareCountClick}
                  />
                </span>
                <span
                  className="pointer-events-auto relative z-[10] flex shrink-0 items-center gap-0.5"
                  data-no-dnd
                  data-folder-chrome
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {footerActions}
                </span>
              </>
            ) : (
              <>
                <span className="shrink-0 text-[12px] font-semibold text-[var(--brand)] transition group-hover:translate-x-0.5">
                  Ouvrir →
                </span>
                <span className="pointer-events-auto relative z-[2]" data-folder-chrome>
                  <CountBadges
                    count={count}
                    draftCount={draftCount}
                    countTitle={countTitle}
                    shareCount={shareCount}
                    shareCountTitle={shareCountTitle}
                    onCountClick={onCountClick}
                    onShareCountClick={onShareCountClick}
                  />
                </span>
              </>
            )}
          </span>
        </span>
      </div>
    </div>
  )
}
