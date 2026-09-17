/** Config minuteur de bloc (admin → client). Stockée en JSON dans `timer_note`. */

export const BLOCK_TIMER_KINDS = ['countdown', 'stopwatch', 'circuit'] as const
export type BlockTimerKind = (typeof BLOCK_TIMER_KINDS)[number]

export const BLOCK_TIMER_KIND_LABEL: Record<BlockTimerKind, string> = {
  countdown: 'Minuteur',
  stopwatch: 'Timer',
  circuit: 'Circuit',
}

/** Alerte périodique (ex. toutes les 3 min). */
export type BlockTimerAlert = { every_seconds: number }

export type BlockTimerConfig =
  | {
      kind: 'countdown'
      duration_seconds: number
      /** Si défini (>0) : bip / alerte toutes les X secondes. */
      alert_every_seconds?: number | null
    }
  | {
      kind: 'stopwatch'
      alert_every_seconds?: number | null
    }
  | { kind: 'circuit'; rounds: number; work_seconds: number; rest_seconds: number }

const DEFAULT_ALERT_SECONDS = 3 * 60

export function defaultTimerConfig(kind: BlockTimerKind = 'countdown'): BlockTimerConfig {
  switch (kind) {
    case 'stopwatch':
      return { kind: 'stopwatch', alert_every_seconds: null }
    case 'circuit':
      return { kind: 'circuit', rounds: 8, work_seconds: 20, rest_seconds: 10 }
    case 'countdown':
    default:
      return { kind: 'countdown', duration_seconds: 20 * 60, alert_every_seconds: null }
  }
}

export function defaultAlertSeconds(): number {
  return DEFAULT_ALERT_SECONDS
}

function clampNonNegInt(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(v) || v < 0) return fallback
  return Math.floor(v)
}

function parseAlertEvery(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === false) return null
  const n = clampNonNegInt(raw, 0)
  return n > 0 ? n : null
}

function formatDurationLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m && r) return `${m} min ${r} s`
  if (m) return `${m} min`
  return `${r} s`
}

export function parseTimerConfig(raw: string | null | undefined): BlockTimerConfig | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  try {
    const parsed = JSON.parse(s) as Record<string, unknown> & { kind?: string }
    if (!parsed || typeof parsed !== 'object' || !parsed.kind) return null
    if (parsed.kind === 'stopwatch') {
      return {
        kind: 'stopwatch',
        alert_every_seconds: parseAlertEvery(parsed.alert_every_seconds),
      }
    }
    if (parsed.kind === 'countdown') {
      const hasLegacy =
        Object.prototype.hasOwnProperty.call(parsed, 'minutes') ||
        Object.prototype.hasOwnProperty.call(parsed, 'seconds')
      const duration = hasLegacy
        ? clampNonNegInt(parsed.minutes, 0) * 60 + clampNonNegInt(parsed.seconds, 0)
        : clampNonNegInt(parsed.duration_seconds, 20 * 60)
      return {
        kind: 'countdown',
        duration_seconds: duration || 20 * 60,
        alert_every_seconds: parseAlertEvery(parsed.alert_every_seconds),
      }
    }
    if (parsed.kind === 'circuit') {
      return {
        kind: 'circuit',
        rounds: clampNonNegInt(parsed.rounds, 8) || 1,
        work_seconds: clampNonNegInt(parsed.work_seconds, 20),
        rest_seconds: clampNonNegInt(parsed.rest_seconds, 10),
      }
    }
    // Legacy emom → ignoré (type retiré)
  } catch {
    // Texte libre legacy → pas de config structurée
  }
  return null
}

export function serializeTimerConfig(config: BlockTimerConfig | null): string {
  if (!config) return ''
  if (config.kind === 'countdown' || config.kind === 'stopwatch') {
    const alert =
      config.alert_every_seconds != null && config.alert_every_seconds > 0
        ? config.alert_every_seconds
        : null
    return JSON.stringify({ ...config, alert_every_seconds: alert })
  }
  return JSON.stringify(config)
}

export function summarizeTimerConfig(config: BlockTimerConfig | null): string {
  if (!config) return 'Aucun minuteur'
  const alertSuffix =
    (config.kind === 'countdown' || config.kind === 'stopwatch') &&
    config.alert_every_seconds &&
    config.alert_every_seconds > 0
      ? ` · alerte ${formatDurationLabel(config.alert_every_seconds)}`
      : ''
  switch (config.kind) {
    case 'stopwatch':
      return `Timer (chrono libre)${alertSuffix}`
    case 'countdown':
      return `Minuteur · ${formatDurationLabel(config.duration_seconds)}${alertSuffix}`
    case 'circuit':
      return `Circuit · ${config.rounds} rounds · ${formatDurationLabel(config.work_seconds)} / ${formatDurationLabel(config.rest_seconds)}`
  }
}
