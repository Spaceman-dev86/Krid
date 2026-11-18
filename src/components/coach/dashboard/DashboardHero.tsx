import Image from 'next/image'

import { KridMark } from '@/src/components/brand/KridLogo'
import { PageTitle, Muted } from '@/src/components/ui'

export function DashboardHero({
  greetName,
  logoUrl,
  dateLabel,
}: {
  greetName: string | null
  logoUrl: string | null
  dateLabel: string
}) {
  return (
    <header className="coach-dash-in flex items-center gap-4" data-builder-chrome>
      <div className="coach-dash-logo-glow relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--brand)_18%,var(--accent))] ring-1 ring-[color-mix(in_srgb,var(--brand)_40%,var(--border))] shadow-da-brand">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={56}
            height={56}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <KridMark size="md" />
        )}
      </div>
      <div className="min-w-0">
        <PageTitle className="text-2xl">Bonjour{greetName ? `, ${greetName}` : ''}</PageTitle>
        <Muted className="mt-0.5">Suivi de ton activité · {dateLabel}</Muted>
      </div>
    </header>
  )
}
