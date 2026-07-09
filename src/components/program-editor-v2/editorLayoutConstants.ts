/** Hauteur du header global (layout root `pt-16`). */
export const APP_HEADER_PX = 64

/** Hauteur approximative du chrome éditeur (sticky header interne). */
export const EDITOR_CHROME_PX = 56

/** Fond page éditeur (gris un peu foncé). */
export const EDITOR_PAGE_BG = '#e8e8e8'

/** Fond cartes séance. */
export const EDITOR_SESSION_BG = '#f5f5f5'

/** ≤623px — téléphone (infos générales compactes, chrome minimal). */
export const EDITOR_PHONE_MAX_PX = 623

/** 768px–867px — tablette étroite : timeline compacte avec sidebars visibles. */
export const EDITOR_TABLET_COMPACT_MIN_PX = 768
export const EDITOR_TABLET_COMPACT_MAX_PX = 867

/** ≤1085px — 3 colonnes serrées : sidebars plus étroites + gap réduit. */
export const EDITOR_NARROW_LAYOUT_MAX_PX = 1085

/** Classes réutilisables (breakpoints arbitraires Tailwind). */
export const EDITOR_CLS = {
  phoneOnly: 'max-[623px]:block min-[624px]:hidden',
  phoneHidden: 'max-[623px]:hidden min-[624px]:block',
  phoneFlex: 'max-[623px]:flex min-[624px]:hidden',
  toolbarOverflow:
    'hidden max-[623px]:block min-[768px]:max-[867px]:block min-[868px]:hidden',
  toolbarFull:
    'hidden shrink-0 items-center min-[624px]:max-[767px]:flex min-[868px]:flex',
  timelineCompactPx:
    'px-3 py-3 min-[624px]:max-[767px]:px-4 min-[768px]:max-[867px]:px-3 min-[868px]:px-4',
  gridStackUntil868: 'grid-cols-1 min-[868px]:grid-cols-3',
  gridPairUntil868:
    'grid-cols-1 gap-1 min-[868px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] min-[868px]:items-center min-[868px]:gap-0',
  gridAddFooterUntil868: 'grid-cols-1 min-[868px]:grid-cols-[180px_1fr]',
} as const

export const EDITOR_SHELL_CLASS =
  'fixed inset-x-0 bottom-0 z-10 flex min-h-0 flex-col overflow-hidden bg-[#e8e8e8] top-0'

export const EDITOR_SIDEBAR_MAX_H = `max-h-[calc(100dvh-${EDITOR_CHROME_PX}px)]`
