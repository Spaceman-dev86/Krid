'use client'

import { useMemo } from 'react'

import { EphemeralFlash, type FlashItem } from '@/src/components/ui'

type Props = {
  rdvCreated?: boolean
  clientCreated?: boolean
  templateCreated?: boolean
  saved?: boolean
  assigned?: boolean
  granted?: boolean
  ended?: boolean
  sent?: boolean
  deleted?: boolean
  error?: string | null
}

/** Flash one-shot fiche client (RDV + actions CRM). */
export function ClientFicheFlash({
  rdvCreated,
  clientCreated,
  templateCreated,
  saved,
  assigned,
  granted,
  ended,
  sent,
  deleted,
  error,
}: Props) {
  const items = useMemo(() => {
    const list: FlashItem[] = []
    if (error === 'already_linked') {
      list.push({
        id: 'already_linked',
        tone: 'warning',
        message: 'Ce client a déjà un compte lié.',
      })
    } else if (error === 'email') {
      list.push({ id: 'email', tone: 'danger', message: 'Email invalide.' })
    } else if (error) {
      list.push({ id: 'error', tone: 'danger', message: error })
    }
    if (rdvCreated) {
      list.push({
        id: 'rdv',
        tone: 'success',
        message: 'RDV proposé — en attente du client.',
      })
    }
    if (clientCreated) {
      list.push({ id: 'created', tone: 'success', message: 'Client créé.' })
    }
    if (templateCreated) {
      list.push({ id: 'template_created', tone: 'success', message: 'Template créé — tu peux l’envoyer.' })
    }
    if (saved) list.push({ id: 'saved', tone: 'success', message: 'Enregistré.' })
    if (assigned) {
      list.push({
        id: 'assigned',
        tone: 'success',
        message: 'Plan envoyé (En attente — le client démarre côté portail).',
      })
    }
    if (granted) {
      list.push({
        id: 'granted',
        tone: 'success',
        message: 'Accès accordé (ledger Payé + grant actif).',
      })
    }
    if (ended) list.push({ id: 'ended', tone: 'success', message: 'Grant terminé.' })
    if (sent) list.push({ id: 'sent', tone: 'success', message: 'Bilan(s) envoyé(s)' })
    if (deleted) list.push({ id: 'deleted', tone: 'success', message: 'Bilan supprimé' })
    return list
  }, [rdvCreated, clientCreated, templateCreated, saved, assigned, granted, ended, sent, deleted, error])

  return <EphemeralFlash items={items} />
}
