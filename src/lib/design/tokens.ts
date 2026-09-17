/**
 * Deux DA — sync `src/app/globals.css` + `/admin/design` + `@/components/ui`.
 */

export const DA_BLACK = {
  id: 'dark',
  label: 'Black mode',
  summary:
    'Carbon sombre. Brand #d6c4e8. Sidebar #0c0c0e + ombre claire. Boutons mist (CTA) / beam. Défaut produit.',
  brand: {
    principal: '#d6c4e8',
    mid: '#9b6bb8',
    soft: '#e8dff2',
  },
  surfaces: {
    page: 'carbon rail sombre',
    surface: '#161618',
    accent: '#1f1f22',
    shell: '#0c0c0e (quasi-noir + ombre)',
  },
  text: {
    text: '#f4f4f5',
    muted: 'rgba(244,244,245,0.72)',
    border: 'rgba(255,255,255,0.12)',
    onBrand: '#1a1a1e (--brand-fg)',
  },
} as const

export const DA_WHITE = {
  id: 'light',
  label: 'White mode',
  summary:
    'Traits soft + flou fond. Brand #9b6bb8. Sidebar #f5f5f7 + ombre intérieure. Boutons cta / secondary.',
  brand: {
    principal: '#9b6bb8',
    mid: '#9b6bb8',
    soft: '#d6c4e8',
  },
  surfaces: {
    page: 'traits soft + flou fond',
    surface: '#ffffff',
    accent: '#f4f4f5',
    shell: '#f5f5f7 (gris très clair)',
  },
  text: {
    text: '#111827',
    muted: 'rgba(17,24,39,0.72)',
    border: 'rgba(17,24,39,0.12)',
  },
} as const

export const DESIGN_TOKENS = {
  brand: {
    brand: {
      css: '--brand',
      dark: DA_BLACK.brand.principal,
      light: DA_WHITE.brand.principal,
      usage: 'Couleur principale (titres, focus, liens actifs)',
    },
    brandMid: {
      css: '--brand-mid',
      dark: DA_BLACK.brand.mid,
      light: DA_WHITE.brand.mid,
      usage: 'Secondaire / dégradés',
    },
    brandSoft: {
      css: '--brand-soft',
      dark: DA_BLACK.brand.soft,
      light: DA_WHITE.brand.soft,
      usage: 'Anneaux / dégradé clair',
    },
    brandFg: { css: '--brand-fg', value: '#ffffff', usage: 'Texte sur fill fort' },
  },
  surfaces: {
    pageBg: { css: '--page-bg', usage: 'Black: carbon · White: traits soft' },
    bg: { css: '--bg', usage: 'Fond document' },
    surface: { css: '--surface', usage: 'Cartes' },
    accent: { css: '--accent', usage: 'Tuiles / hover' },
    shell: { css: '--shell', usage: 'Dark #0c0c0e · Light #f5f5f7' },
  },
  text: {
    text: { css: '--fg', usage: 'Corps (pas --text : conflit Tailwind)' },
    muted: { css: '--muted', usage: 'Secondaire' },
    border: { css: '--border', usage: 'Séparateurs' },
  },
  feedback: {
    success: { css: '--success', bg: '--success-bg', border: '--success-border', usage: 'OK' },
    danger: { css: '--danger', bg: '--danger-bg', border: '--danger-border', usage: 'Erreur' },
    warning: { css: '--warning', bg: '--warning-bg', border: '--warning-border', usage: 'Attention' },
  },
  radius: {
    sm: { css: '--radius-sm', value: '12px' },
    md: { css: '--radius-md', value: '16px' },
    lg: { css: '--radius-lg', value: '24px' },
    pill: { css: '--radius-pill', value: '9999px' },
  },
  shadow: {
    sm: { css: '--shadow-sm' },
    md: { css: '--shadow-md' },
    brand: { css: '--shadow-brand' },
  },
} as const

export const DESIGN_RULES = [
  'Scope : admin + coach = Black/White (dark défaut). Client V1 = DA coach basée sur dark Trainly.',
  'Contraste black : brand lavande → texte --brand-fg (#1a1a1e). Jamais text-white sur bg brand.',
  'Boutons : 2/mode — Black mist/beam · White cta/secondary. Secondary = --btn-secondary-*.',
  'Utilitaire .on-brand = bg brand + color brand-fg. Ombres = shadow-da-*.',
  'UI : @/src/components/ui · tokens CSS · pas de hex hors DA.',
] as const
