import Link from 'next/link'

import { DaBanner } from '@/src/components/ui'

type Props = {
  quotaGo?: string | null
  plan?: string | null
}

/** Rappel quand Récupérer échoue faute d’espace Drive (quota plan). */
export function DocQuotaFullBanner({ quotaGo, plan }: Props) {
  const go = quotaGo || '?'
  const tier = plan || 'ton offre'
  return (
    <DaBanner tone="danger" className="mt-4">
      <p className="font-bold">Espace Drive plein</p>
      <p className="mt-1">
        Ton plan <span className="capitalize">{tier}</span> autorise {go} Go. Archive des fichiers ou
        passe à une offre supérieure pour récupérer ce document.
      </p>
      <p className="mt-2">
        <Link href="/settings/storage" className="font-semibold underline underline-offset-2">
          Voir mon stockage →
        </Link>
      </p>
    </DaBanner>
  )
}
