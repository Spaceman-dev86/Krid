/** Whitelist relative coach return paths (open redirect safe). */
export function safeReturnTo(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//')) return fallback
  if (value.includes('://')) return fallback
  if (!(value.startsWith('/exercises') || value.startsWith('/programs'))) return fallback
  return value
}

/** Tout chemin interne à l’app (pas d’URL externe, pas de `//` ni `/\`). */
export function safeInternalPath(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.includes('://') || value.includes('\\')) return fallback
  return value
}

/** Ajoute / remplace des query params sur un chemin interne. */
export function withQueryParams(path: string, params: Record<string, string>): string {
  const u = new URL(path, 'http://local.invalid')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return `${u.pathname}${u.search}`
}

export function withReturnTo(href: string, returnTo?: string | null): string {
  const base = href.trim()
  const rt = String(returnTo ?? '').trim()
  if (!rt) return base
  const safe = safeReturnTo(rt, '')
  if (!safe) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}returnTo=${encodeURIComponent(safe)}`
}

export function returnToBackLabel(returnTo: string, fallback: string): string {
  if (returnTo.startsWith('/exercises/blocks')) {
    return returnTo.includes('/brouillon') ? '← Blocs brouillon' : '← Blocs'
  }
  if (returnTo.startsWith('/exercises/mine') || returnTo.startsWith('/exercises/brouillon')) {
    return returnTo.includes('/brouillon') ? '← Exercices brouillon' : '← Exercices'
  }
  if (returnTo.startsWith('/programs/sessions')) {
    return returnTo.includes('/brouillon') ? '← Séances brouillon' : '← Séances'
  }
  return fallback
}
