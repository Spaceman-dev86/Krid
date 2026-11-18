/** Fuseau métier : les heures saisies par le coach (RDV, bilans) sont en heure de Paris. */
export const APP_TIME_ZONE = 'Europe/Paris'

function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * Heure murale (y/m/d h:m dans `timeZone`) → instant UTC.
 * Indépendant du fuseau du serveur (UTC sur Vercel). `null` si date invalide (ex. 31/02).
 */
export function zonedWallTimeToUtc(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
  timeZone: string = APP_TIME_ZONE,
): Date | null {
  const guess = Date.UTC(y, mo - 1, d, hh, mm, 0, 0)
  const check = new Date(guess)
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    check.getUTCHours() !== hh ||
    check.getUTCMinutes() !== mm
  ) {
    return null
  }
  const first = zoneOffsetMs(new Date(guess), timeZone)
  let ts = guess - first
  const second = zoneOffsetMs(new Date(ts), timeZone)
  if (second !== first) ts = guess - second
  return new Date(ts)
}

/** Valeur `<input type="datetime-local">` (YYYY-MM-DDTHH:mm) → instant UTC. */
export function parseDateTimeLocalInput(
  raw: string,
  timeZone: string = APP_TIME_ZONE,
): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  return zonedWallTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], timeZone)
}
