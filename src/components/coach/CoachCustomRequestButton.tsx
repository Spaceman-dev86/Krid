'use client'

import { useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { createSupportTicketAction } from '@/src/app/settings/support/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconButton, IconClose } from '@/src/components/ui'

export type CustomRequestKind = 'logo' | 'site'

const PRESETS: Record<
  CustomRequestKind,
  { subject: string; title: string; blurb: string; bodyPlaceholder: string; cta: string }
> = {
  logo: {
    subject: 'Demande logo personnalisé',
    title: 'Demander un logo personnalisé',
    blurb: 'Décris le style, les couleurs, ou les refs que tu as en tête. L’équipe Krid te répond.',
    bodyPlaceholder: 'Ex. Initiales SR, style minimal, fond sombre, violet lavande…',
    cta: 'Demander un logo personnalisé',
  },
  site: {
    subject: 'Demande site personnalisé connecté à mon app Krid',
    title: 'Site personnalisé',
    blurb:
      'Landing / site à ta image, branché sur ton app Krid (showroom, offres). L’équipe te répond.',
    bodyPlaceholder: 'Ex. Nom de domaine souhaité, pages (accueil, offres, contact), refs visuelles…',
    cta: 'Demander mon site personnalisé',
  },
}

function SubmitRequest({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          Envoi…
        </span>
      ) : (
        label
      )}
    </Button>
  )
}

/** Ouvre un mini formulaire → ticket SAV (catégorie produit). */
export function CoachCustomRequestButton({
  kind,
  returnTo,
  variant = 'secondary',
  size = 'sm',
  className,
  children,
}: {
  kind: CustomRequestKind
  /** Après envoi, rester sur cette page (?request_sent=1). */
  returnTo?: string
  variant?: 'secondary' | 'ghost' | 'mist' | 'beam'
  size?: 'sm' | 'md'
  className?: string
  children?: ReactNode
}) {
  const preset = PRESETS[kind]
  const titleId = useId()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className ?? '!rounded-lg !px-3 !py-1.5 text-xs font-bold'}
        onClick={() => setOpen(true)}
      >
        {children ?? preset.cta}
      </Button>

      {open ? (
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
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-md sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id={titleId} className="text-base font-extrabold text-[color:var(--fg)]">
                {preset.title}
              </h2>
              <IconButton
                type="button"
                label="Fermer"
                tone="soft"
                size="sm"
                onClick={() => setOpen(false)}
              >
                <IconClose size={16} />
              </IconButton>
            </div>
            <p className="mb-3 text-sm text-[color:var(--muted)]">{preset.blurb}</p>
            <form action={createSupportTicketAction} className="grid gap-3">
              <input type="hidden" name="subject" value={preset.subject} />
              <input type="hidden" name="category" value="produit" />
              {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
              <label className="grid gap-1 text-sm">
                <span className="font-semibold text-[color:var(--fg)]">Précisions</span>
                <textarea
                  name="body"
                  rows={4}
                  required
                  placeholder={preset.bodyPlaceholder}
                  className="rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2 text-sm text-[color:var(--fg)]"
                  defaultValue={
                    kind === 'logo'
                      ? 'Bonjour, je souhaite un logo personnalisé pour mon app Krid.'
                      : 'Bonjour, je souhaite un site personnalisé connecté à mon app Krid.'
                  }
                />
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!rounded-lg !px-3 !py-1.5 text-xs"
                  onClick={() => setOpen(false)}
                >
                  Annuler
                </Button>
                <SubmitRequest label="Envoyer à l’équipe" />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
