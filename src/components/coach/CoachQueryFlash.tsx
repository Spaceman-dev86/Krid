'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

import { EphemeralFlash, type FlashItem } from '@/src/components/ui'

const MESSAGES: Record<string, { tone: FlashItem['tone']; message: string }> = {
  sent: { tone: 'success', message: 'Bilan(s) envoyé(s)' },
  created: { tone: 'success', message: 'Créé' },
  saved: { tone: 'success', message: 'Enregistré' },
  deleted: { tone: 'success', message: 'Supprimé' },
  archived: { tone: 'success', message: 'Archivé' },
  forked: { tone: 'success', message: 'Copié en brouillon' },
  linked: { tone: 'success', message: 'Lié à la presta' },
  assigned: { tone: 'success', message: 'Plan envoyé' },
  granted: { tone: 'success', message: 'Accès accordé' },
  ended: { tone: 'success', message: 'Accès terminé' },
  invited: { tone: 'success', message: 'Invitation créée' },
  unlinked: { tone: 'success', message: 'Compte délié' },
  rdv: { tone: 'success', message: 'RDV proposé' },
}

/** Hubs / fiche programmes : jamais de pill vert — erreurs seulement. */
export const PROGRAMS_OMIT_SUCCESS_FLASH = Object.keys(MESSAGES)

/** Soft flash 5s depuis query params CRM (tokens dark/light). */
export function CoachQueryFlash({
  overrides,
  /** Clés query à ignorer (ex. hubs programmes : jamais le pill « Enregistré »). */
  omitKeys,
}: {
  overrides?: Partial<Record<string, { tone: FlashItem['tone']; message: string } | null>>
  omitKeys?: string[]
} = {}) {
  const sp = useSearchParams()

  const items = useMemo(() => {
    const map: Record<string, { tone: FlashItem['tone']; message: string } | null | undefined> = {
      ...MESSAGES,
      ...overrides,
    }
    const omit = new Set(omitKeys ?? [])
    const list: FlashItem[] = []
    const err = sp.get('error')
    if (err && !omit.has('error')) {
      list.push({
        id: 'error',
        tone: 'danger',
        message:
          err === 'email'
            ? 'Email invalide'
            : err === 'name'
              ? 'Nom requis'
              : err === 'readonly'
                ? 'Groupe auto : lecture seule'
                : err,
      })
    }
    for (const [key, cfg] of Object.entries(map)) {
      if (key === 'error' || omit.has(key) || !cfg) continue
      if (sp.has(key)) list.push({ id: key, tone: cfg.tone, message: cfg.message })
    }
    return list
  }, [sp, overrides, omitKeys])

  return <EphemeralFlash items={items} />
}
