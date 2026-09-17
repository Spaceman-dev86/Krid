/** Couleurs partagées arbre des routes ↔ timeline (même niveau = même teinte). */

export type SpecLevelStyle = {
  badgeClass: string
  border: string
  rail: string
  card: string
  label: string
}

export const SPEC_MENU_STYLE = {
  badge: 'Menu',
  badgeClass: 'bg-[var(--brand)] text-white',
  border: 'border-l-[var(--brand)]',
  rail: 'border-l-4 border-[var(--brand)]',
} as const

/** Index 0 = N1, 1 = N2, … — aligné arbre + timeline */
const FEATURE_LEVELS: SpecLevelStyle[] = [
  {
    badgeClass: 'bg-orange-500 text-white',
    border: 'border-l-orange-500',
    rail: 'border-l-4 border-orange-500',
    card: 'rounded-xl border-2 border-orange-300 bg-orange-50/40 p-4 shadow-sm',
    label: 'N1 · Action',
  },
  {
    badgeClass: 'bg-sky-500 text-white',
    border: 'border-l-sky-500',
    rail: 'border-l-4 border-sky-500',
    card: 'rounded-lg border-2 border-sky-300 bg-sky-50/40 p-3',
    label: 'N2 · Sous-action',
  },
  {
    badgeClass: 'bg-violet-500 text-white',
    border: 'border-l-violet-500',
    rail: 'border-l-4 border-violet-500',
    card: 'rounded-lg border-2 border-violet-300 bg-violet-50/40 p-3',
    label: 'N3 · Détail',
  },
  {
    badgeClass: 'bg-emerald-600 text-white',
    border: 'border-l-emerald-600',
    rail: 'border-l-4 border-emerald-600',
    card: 'rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-3',
    label: 'N4+',
  },
]

/** @param zeroBasedDepth 0 = N1 (timeline FeatureNode), 1 = N2, … */
export function specFeatureStyle(zeroBasedDepth: number): SpecLevelStyle & { badge: string } {
  const level = Math.max(0, zeroBasedDepth)
  const style = FEATURE_LEVELS[Math.min(level, FEATURE_LEVELS.length - 1)]
  const n = level + 1
  return {
    ...style,
    badge: `N${n}`,
    label: n <= 3 ? style.label : `N${n}`,
  }
}

/** Arbre : depth 1 = N1 sous un menu */
export function specTreeDepthMeta(kind: 'menu' | 'feature', depth: number) {
  if (kind === 'menu') {
    return {
      badge: SPEC_MENU_STYLE.badge,
      badgeClass: SPEC_MENU_STYLE.badgeClass,
      border: SPEC_MENU_STYLE.border,
    }
  }
  const s = specFeatureStyle(Math.max(0, depth - 1))
  return { badge: s.badge, badgeClass: s.badgeClass, border: s.border }
}
