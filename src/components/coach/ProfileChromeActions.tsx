'use client'

import Link from 'next/link'

/** Actions chrome Profil public (tous onglets). */
export function ProfileChromeActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/profile/rendu"
        className="rounded-lg border border-[color-mix(in_srgb,var(--brand)_20%,transparent)] bg-[var(--surface)] px-3 py-1.5 text-sm font-bold text-[color:var(--brand)] shadow-da-sm hover:bg-[color-mix(in_srgb,var(--brand)_5%,transparent)]"
      >
        Voir le rendu
      </Link>
      <Link
        href="/clients/codes"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-semibold text-[color:var(--muted)] hover:bg-[var(--accent)]"
      >
        Codes promo
      </Link>
    </div>
  )
}
