/**
 * Affiche « Charge (kg) » sans doubler si le label contient déjà l’abrégé
 * (ex. « Calories (cal) » + short « Cal » → pas « Calories (cal)(Cal) »).
 */
export function formatUnitLabel(
  label: string | null | undefined,
  shortLabel?: string | null,
): string {
  const l = String(label ?? '').trim()
  const s = String(shortLabel ?? '').trim()
  if (!l) return s
  if (!s) return l

  const lower = l.toLowerCase()
  const shortLower = s.toLowerCase()
  if (lower === shortLower) return l
  if (lower.includes(`(${shortLower})`)) return l
  // Abrégé déjà dans le libellé (ex. « Calories (cal) » vs « Cal »)
  const paren = l.match(/\(([^)]+)\)\s*$/)
  if (paren && paren[1].trim().toLowerCase() === shortLower) return l
  if (/\([^)]+\)\s*$/.test(l)) return l

  return `${l} (${s})`
}
