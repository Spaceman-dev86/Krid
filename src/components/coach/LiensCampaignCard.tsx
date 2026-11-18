import type { ReactNode } from 'react'

import { TrackedLinkShareBlock } from './TrackedLinkShareBlock'

type Props = {
  label: string
  code: string
  targetLabel: string
  promoLabel: string | null
  isDefault: boolean
  clicks: number
  /** Soumissions « Je suis intéressé ». */
  interests: number
  paid: number
  url: string | null
  shareMessage: string | null
  linkId: string
  archiveAction: ReactNode
}

export function LiensCampaignCard({
  label,
  code,
  targetLabel,
  promoLabel,
  isDefault,
  clicks,
  interests,
  paid,
  url,
  shareMessage,
  linkId,
  archiveAction,
}: Props) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 shadow-da-sm sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-extrabold text-[color:var(--brand)]">{label}</h3>
            <span className="font-mono text-[10px] text-[color:var(--muted)]">{code}</span>
            {isDefault ? (
              <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                Défaut
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-md border border-[var(--border)] px-2 py-0.5">
              <span className="text-[color:var(--muted)]">Cible </span>
              <span className="font-semibold text-[color:var(--fg)]">{targetLabel}</span>
            </span>
            {promoLabel ? (
              <span className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-2 py-0.5 font-semibold text-[color:var(--fg)]">
                Promo {promoLabel}
              </span>
            ) : (
              <span className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[color:var(--muted)]">
                Pas de promo
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-center">
          {[
            { k: 'Clics', v: clicks },
            { k: 'Intérêts', v: interests },
            { k: 'Payés', v: paid },
          ].map((m) => (
            <div key={m.k} className="min-w-[2.75rem]">
              <p className="text-base font-extrabold tabular-nums leading-none text-[color:var(--fg)]">
                {m.v}
              </p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                {m.k}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--border)] pt-2.5">
        {url ? (
          <div className="min-w-0 flex-1">
            <TrackedLinkShareBlock linkId={linkId} url={url} shareMessage={shareMessage} />
          </div>
        ) : (
          <p className="flex-1 text-[11px] text-[color:var(--muted)]">
            Définis un slug showroom pour l’URL.
          </p>
        )}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{archiveAction}</div>
      </div>
    </article>
  )
}
