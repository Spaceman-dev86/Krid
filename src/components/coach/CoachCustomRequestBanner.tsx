'use client'

import type { ReactNode } from 'react'

import {
  CoachCustomRequestButton,
  type CustomRequestKind,
} from './CoachCustomRequestButton'

const COPY: Record<
  CustomRequestKind,
  { title: string; subtitle: string; cta: string }
> = {
  logo: {
    title: 'Logo personnalisé pour ton app',
    subtitle: 'Création sur-mesure · couleurs & style de ta marque.',
    cta: 'Demander un logo',
  },
  site: {
    title: 'Site personnalisé, branché sur ton app',
    subtitle: 'Landing à ta image · showroom & offres · connecté à Krid.',
    cta: 'Demander mon site',
  },
}

/** Bandeau DA custom (logo / site) — même présentation partout. */
export function CoachCustomRequestBanner({
  kind,
  returnTo,
  children,
}: {
  kind: CustomRequestKind
  /** Page à garder après envoi du ticket. */
  returnTo: string
  children?: ReactNode
}) {
  const copy = COPY[kind]
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface))] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[color:var(--fg)]">{copy.title}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[color:var(--muted)]">
            {copy.subtitle}
          </p>
          {children}
        </div>
        <CoachCustomRequestButton
          kind={kind}
          returnTo={returnTo}
          variant="mist"
          size="sm"
          className="!shrink-0 !rounded-lg !px-3.5 !py-2 text-xs font-bold"
        >
          {copy.cta}
        </CoachCustomRequestButton>
      </div>
    </div>
  )
}
