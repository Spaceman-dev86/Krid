import Link from 'next/link'

import { Button } from '@/src/components/ui'
import { catalogListHref } from '@/src/lib/catalog/search'

/** Bascule Catalogue plateforme ↔ Biblio coaches (preview client). */
export function CatalogScopeToggle({
  base,
  mode,
  q,
  coach,
}: {
  base: string
  mode: 'trainly' | 'coach'
  q?: string
  coach?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        href={catalogListHref(base, { mode: 'trainly', q })}
        variant={mode === 'trainly' ? undefined : 'secondary'}
        size="sm"
      >
        Trainly
      </Button>
      <Button
        href={catalogListHref(base, { mode: 'coach', q, coach })}
        variant={mode === 'coach' ? undefined : 'secondary'}
        size="sm"
      >
        Coach
      </Button>
      <span className="self-center text-[11px] text-[color:var(--muted)]">
        {mode === 'trainly'
          ? 'Catalogue plateforme · éditer / publier'
          : 'Biblio coaches · preview client (lecture seule)'}
      </span>
    </div>
  )
}

export function CatalogBackLink() {
  return (
    <p className="text-sm text-[color:var(--muted)]">
      <Link className="font-semibold text-[var(--brand)]" href="/admin/catalog">
        ← Catalogue
      </Link>
    </p>
  )
}
