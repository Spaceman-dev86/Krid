export function parseMmSsToSeconds(value: string): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length !== 2) return null
  const mm = Number.parseInt(parts[0] || '0', 10)
  const ss = Number.parseInt(parts[1] || '0', 10)
  if (!Number.isFinite(mm) || !Number.isFinite(ss)) return null
  if (mm < 0 || ss < 0) return null
  return mm * 60 + ss
}

/**
 * Saisie libre minuteur :
 * - "20" → 20:00 · "200" → 200:00 (minutes)
 * - "2000" → 20:00 (4 chiffres = mmss)
 * - "1:30" / "01:30" → mm:ss
 */
export function parseFlexibleTimeToSeconds(value: string): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (raw.includes(':')) return parseMmSsToSeconds(raw)
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 4) {
    const mm = Number.parseInt(digits.slice(0, 2), 10)
    const ss = Number.parseInt(digits.slice(2, 4), 10)
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss > 59) return null
    return mm * 60 + ss
  }
  const mm = Number.parseInt(digits, 10)
  if (!Number.isFinite(mm) || mm < 0) return null
  return mm * 60
}

export function formatSecondsToMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(clamped / 60)
  const ss = clamped % 60
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

export function stepNumberString(
  current: string,
  delta: number,
  opts?: { min?: number; max?: number }
): string {
  const n = Number.parseInt(String(current ?? '').trim() || '0', 10)
  const base = Number.isFinite(n) ? n : 0
  const nextRaw = base + delta
  const next = Math.max(opts?.min ?? -Infinity, Math.min(opts?.max ?? Infinity, nextRaw))
  return String(next)
}

export function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) ? n : null
}
