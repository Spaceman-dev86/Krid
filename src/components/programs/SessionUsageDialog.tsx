'use client'

import Link from 'next/link'

import { IconButton, IconClose } from '@/src/components/ui'
import { withReturnTo } from '@/src/lib/navigation/safeReturnTo'
import type { SessionUsageBundle, SessionUsageRef } from '@/src/lib/sessions/templateUsage'

function kindLabel(ref: SessionUsageRef) {
  return 'Programme (copie)'
}

function UsageList({
  title,
  hint,
  items,
  returnTo,
}: {
  title: string
  hint?: string
  items: SessionUsageRef[]
  returnTo?: string
}) {
  if (!items.length) return null
  return (
    <div className="grid gap-2">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
          {title}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{hint}</p> : null}
      </div>
      <ul className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
        {items.map((ref) => (
          <li key={`${ref.kind}-${ref.id}`} className="border-b border-[var(--border)] last:border-b-0">
            <Link
              href={withReturnTo(ref.href, returnTo)}
              className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[color:var(--brand)]">
                  {ref.name}
                </span>
                <span className="mt-0.5 block text-[11px] text-[color:var(--muted)]">
                  {kindLabel(ref)}
                  {ref.subtitle ? ` · ${ref.subtitle}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-bold text-[color:var(--muted)]">
                Ouvrir
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Props = {
  sessionName: string
  usage: SessionUsageBundle
  returnTo?: string
  onClose: () => void
}

export function SessionUsageDialog({ sessionName, usage, returnTo, onClose }: Props) {
  const titleId = 'session-usage-title'
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-extrabold text-[color:var(--fg)]">
              Utilisations
            </h2>
            <p className="mt-0.5 truncate text-sm text-[color:var(--muted)]">{sessionName}</p>
          </div>
          <IconButton type="button" label="Fermer" tone="soft" size="sm" onClick={onClose}>
            <IconClose size={16} />
          </IconButton>
        </div>
        <div className="da-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {!usage.templates.length && !usage.programs.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucune utilisation trouvée.</p>
          ) : null}
          <UsageList
            title="Programmes (copie — safe)"
            hint="Photocopie : archiver la séance modèle ne vide pas ces programmes."
            items={usage.programs}
            returnTo={returnTo}
          />
        </div>
      </div>
    </div>
  )
}
