import type { TrackedChannel } from './trackedLinks'

export function normalizeInstagramHandle(raw: string | null | undefined) {
  let s = (raw ?? '').trim()
  if (!s) return null
  s = s.replace(/^@+/, '')
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  s = s.replace(/^instagram\.com\//i, '')
  s = s.split(/[/?#]/)[0]?.replace(/\/+$/, '') ?? ''
  s = s.toLowerCase()
  if (!/^[a-z0-9._]{1,30}$/.test(s)) return null
  return s
}

/** Digits only, keep leading country code (e.g. 336…). */
export function normalizeWhatsappPhone(raw: string | null | undefined) {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

export function normalizeFacebookPage(raw: string | null | undefined) {
  const s = (raw ?? '').trim().replace(/^https?:\/\/(www\.)?(m\.|www\.)?facebook\.com\//i, '')
  const cleaned = s.replace(/^m\.me\//i, '').split(/[?#]/)[0]?.replace(/\/+$/, '') ?? ''
  return cleaned || null
}

export function buildInterestMessage(opts: {
  appName?: string | null
  prestationName?: string | null
  campaignLabel?: string | null
}) {
  const offer = opts.prestationName?.trim() || opts.appName?.trim() || 'ton offre'
  const via = opts.campaignLabel?.trim()
  return via
    ? `Bonjour, je suis intéressé(e) par ${offer} (via ${via}).`
    : `Bonjour, je suis intéressé(e) par ${offer}.`
}

/**
 * @deprecated Plus d’ouverture messagerie après Envoyer — lead only partout.
 * Conservé pour d’éventuels appels legacy ; renvoie toujours null.
 */
export function buildCoachContactUrl(
  _channel: TrackedChannel | string,
  _contacts: {
    contact_instagram?: string | null
    contact_whatsapp?: string | null
    contact_facebook?: string | null
  },
  _message: string
): string | null {
  return null
}

export function contactForChannel(
  channel: TrackedChannel | string,
  contacts: {
    contact_instagram?: string | null
    contact_whatsapp?: string | null
    contact_facebook?: string | null
  }
) {
  if (channel === 'wa') return normalizeWhatsappPhone(contacts.contact_whatsapp)
  if (channel === 'ig') return normalizeInstagramHandle(contacts.contact_instagram)
  if (channel === 'fb') return normalizeFacebookPage(contacts.contact_facebook)
  return null
}

/** Canal = source de diffusion / attribution, plus de retour messagerie. */
export function channelReturnHint(channel: TrackedChannel | string) {
  if (channel === 'ig') return 'Story / bio Instagram'
  if (channel === 'wa') return 'Statut / diffusé WhatsApp'
  if (channel === 'fb') return 'Post / ads Facebook'
  return 'Autre diffusion'
}
