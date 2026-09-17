export function buildTrackedUrl(opts: {
  origin: string
  slug: string
  code: string
  /** Ignored for l’URL publique — résolu via /go/[code] */
  targetKind?: 'showroom' | 'prestation'
  prestationId?: string | null
}) {
  return new URL(`/c/${opts.slug}/go/${encodeURIComponent(opts.code)}`, opts.origin).toString()
}

export function buildTrackedDestinationPath(opts: {
  slug: string
  code: string
  targetKind: 'showroom' | 'prestation'
  prestationId?: string | null
}) {
  const base =
    opts.targetKind === 'prestation' && opts.prestationId
      ? `/c/${opts.slug}/showroom/${opts.prestationId}`
      : `/c/${opts.slug}/showroom`
  return withRef(base, opts.code)
}

export const TRACKED_REF_COOKIE = 'tl_ref'

export const TRACKED_CHANNELS = [
  { id: 'ig', label: 'Instagram', leadHint: '@handle' },
  { id: 'wa', label: 'WhatsApp', leadHint: 'Téléphone' },
  { id: 'fb', label: 'Facebook', leadHint: 'Prénom + nom' },
  { id: 'other', label: 'Autre', leadHint: 'Coordonnées' },
] as const

export type TrackedChannel = (typeof TRACKED_CHANNELS)[number]['id']

export function channelLabel(channel: string) {
  return TRACKED_CHANNELS.find((c) => c.id === channel)?.label ?? channel
}

export function withRef(path: string, ref: string | null | undefined) {
  if (!ref) return path
  const [pathname, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('ref')) params.set('ref', ref)
  const q = params.toString()
  return q ? `${pathname}?${q}` : pathname
}

export function randomRefCode(prefix = 'r') {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let body = ''
  for (let i = 0; i < 6; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)]
  return `${prefix}${body}`
}
