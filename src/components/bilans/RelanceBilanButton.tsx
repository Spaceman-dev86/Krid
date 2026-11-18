'use client'

import { RelanceBilanDialog } from './RelanceBilanDialog'

type Props = {
  clientId: string
  instanceId: string
  bilanTitle: string
  bilanUrl: string
  label?: string
  className?: string
}

/** Relance chat via popup (reste dans bilans). */
export function RelanceBilanButton(props: Props) {
  return <RelanceBilanDialog {...props} />
}
