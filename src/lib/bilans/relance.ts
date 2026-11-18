import type { BilanInstanceRow } from './bilans'

/** Relançable = encore ouvert côté client (pas rempli, pas « sans réponse »). */
export function canRelaunchBilan(status: BilanInstanceRow['status'] | string): boolean {
  return status === 'waiting' || status === 'in_progress'
}

/** Supprimable = le client n’a pas (encore) rempli. */
export function canDeleteBilan(status: BilanInstanceRow['status'] | string): boolean {
  return status === 'waiting' || status === 'in_progress' || status === 'no_response'
}

/** Corps du message (sans URL — le lien est joint à l’envoi). */
export function bilanRelanceDraft(title: string): string {
  const t = title.trim() || 'bilan'
  return `Salut ! Pense à remplir ton bilan « ${t} » quand tu peux.`
}

/** Assemble message + lien bilan (si absent du corps). */
export function bilanRelanceMessage(body: string, bilanUrl?: string | null): string {
  const text = body.trim()
  const link = (bilanUrl ?? '').trim()
  if (!link) return text
  if (text.includes(link)) return text
  return `${text}\n\n➡️ ${link}`
}

export function clientBilanPath(slug: string, instanceId: string): string {
  return `/c/${slug}/profil/bilans/${instanceId}`
}
