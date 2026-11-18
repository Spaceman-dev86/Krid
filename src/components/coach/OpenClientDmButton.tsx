'use client'

import { ClientMessageDialog } from '@/src/components/chat/ClientMessageDialog'

type Props = {
  clientId: string
  clientLabel: string
}

/** Fiche client → popup Message DM 1:1 (`f-cli-msg`). */
export function OpenClientDmButton({ clientId, clientLabel }: Props) {
  return <ClientMessageDialog clientId={clientId} clientLabel={clientLabel} />
}
