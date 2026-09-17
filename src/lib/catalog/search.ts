export type CatalogKind = 'exercises' | 'blocks'
export type FitnessKind = 'programs' | 'sessions'

/** Build list URL preserving kind / view / search / coach. */
export function catalogListHref(
  base: string,
  opts: {
    kind?: CatalogKind | FitnessKind
    view?: string
    q?: string
    mode?: 'trainly' | 'coach'
    coach?: string
    sport?: string
    type?: string
  } = {},
): string {
  const params = new URLSearchParams()
  if (opts.kind === 'blocks' || opts.kind === 'sessions') params.set('kind', opts.kind)
  if (opts.mode === 'coach' || opts.view === 'coach') params.set('view', 'coach')
  else if (opts.view && opts.view !== 'all') params.set('view', opts.view)
  const q = opts.q?.trim()
  if (q) params.set('q', q)
  const coach = opts.coach?.trim()
  if (coach) params.set('coach', coach)
  const sport = opts.sport?.trim()
  if (sport) params.set('sport', sport)
  const type = opts.type?.trim()
  if (type) params.set('type', type)
  const s = params.toString()
  return s ? `${base}?${s}` : base
}

export function sanitizeSearch(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/[%_,]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

export function parseCatalogMode(raw: unknown): 'trainly' | 'coach' {
  return String(raw ?? '') === 'coach' ? 'coach' : 'trainly'
}

export function parseCatalogKind(raw: unknown): CatalogKind {
  return String(raw ?? '') === 'blocks' ? 'blocks' : 'exercises'
}

export function parseFitnessKind(raw: unknown): FitnessKind {
  return String(raw ?? '') === 'sessions' ? 'sessions' : 'programs'
}
