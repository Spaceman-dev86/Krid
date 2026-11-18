import { DEFAULT_CLIENT_PRIMARY_COLOR } from './defaultClientPrimaryColor'

export type ClientThemeMode = 'dark' | 'light'
export type ClientBgStyle = 'carbon' | 'solid'

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null
  return {
    r: Number.parseInt(h.slice(1, 3), 16),
    g: Number.parseInt(h.slice(3, 5), 16),
    b: Number.parseInt(h.slice(5, 7), 16),
  }
}

/** Secondaire soft si le coach n’en a pas défini. */
export function deriveSecondaryColor(primary: string): string {
  const rgb = parseHex(primary)
  if (!rgb) return '#6b7280'
  const mix = (c: number) => Math.round(c * 0.55 + 140 * 0.45)
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return `#${to(mix(rgb.r))}${to(mix(rgb.g))}${to(mix(rgb.b))}`
}

/** Encre sur fond brand : blanc si brand sombre, encre si brand claire. */
export function contrastBrandFg(brandHex: string): '#ffffff' | '#1a1a1e' {
  const rgb = parseHex(brandHex)
  if (!rgb) return '#ffffff'
  // Luminance relative (WCAG approx)
  const lum = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return lum > 0.62 ? '#1a1a1e' : '#ffffff'
}

export function resolveClientBrandColors(opts: {
  primaryColor?: string | null
  secondaryColor?: string | null
}) {
  const primary = opts.primaryColor?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const secondary = opts.secondaryColor?.trim() || deriveSecondaryColor(primary)
  return { primary, secondary, brandFg: contrastBrandFg(primary) }
}

export function normalizeThemeMode(raw: string | null | undefined): ClientThemeMode {
  return raw === 'light' ? 'light' : 'dark'
}

export function normalizeBgStyle(raw: string | null | undefined): ClientBgStyle {
  return raw === 'solid' ? 'solid' : 'carbon'
}
