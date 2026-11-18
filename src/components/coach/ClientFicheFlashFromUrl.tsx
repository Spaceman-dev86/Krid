'use client'

import { useSearchParams } from 'next/navigation'

import { ClientFicheFlash } from './ClientFicheFlash'

/** Lit les flash query params (layout fiche n’a pas searchParams). */
export function ClientFicheFlashFromUrl() {
  const sp = useSearchParams()
  return (
    <ClientFicheFlash
      rdvCreated={sp.has('rdv')}
      clientCreated={sp.has('created')}
      templateCreated={sp.has('template_created')}
      saved={sp.has('saved')}
      assigned={sp.has('assigned')}
      granted={sp.has('granted')}
      ended={sp.has('ended')}
      sent={sp.has('sent')}
      deleted={sp.has('deleted')}
      error={sp.get('error')}
    />
  )
}
