'use client'

import { useEffect, useRef, useState } from 'react'

import { IconButton } from '@/src/components/ui'
import { Icon } from '@/src/components/ui/icons'

function toTelHref(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return null
  // Garde + et chiffres ; enlève espaces / points / tirets
  const normalized = trimmed.replace(/[^\d+]/g, '')
  if (normalized.replace(/\D/g, '').length < 6) return null
  return `tel:${normalized}`
}

function IconPhone({ size = 18 }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.75.32 1.54.55 2.35.68A2 2 0 0 1 22 16.92z" />
    </Icon>
  )
}

type Props = {
  phone?: string | null
  /** Lien fiche client pour compléter le numéro */
  clientHref?: string | null
  /** Texte si pas de numéro (défaut: client) */
  emptyTitle?: string
  emptyBody?: string
}

/** Appel téléphone natif (`tel:`) — DM coach ↔ client. */
export function ChatCallPhoneButton({
  phone,
  clientHref,
  emptyTitle = 'Pas de numéro client',
  emptyBody = 'Renseigne le téléphone sur la fiche pour pouvoir appeler.',
}: Props) {
  const [hint, setHint] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const href = phone ? toTelHref(phone) : null

  useEffect(() => {
    if (!hint) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setHint(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [hint])

  if (href) {
    return (
      <a
        href={href}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--fg)] ring-1 ring-[var(--border)] transition hover:bg-[var(--accent)]"
        aria-label="Appeler"
        title={phone?.trim() || 'Appeler'}
      >
        <IconPhone />
      </a>
    )
  }

  return (
    <span ref={rootRef} className="relative inline-flex">
      <IconButton
        type="button"
        size="sm"
        tone="ghost"
        label="Appeler"
        className="!h-8 !w-8"
        onClick={() => setHint((v) => !v)}
      >
        <IconPhone />
      </IconButton>
      {hint ? (
        <div
          role="status"
          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-da-md"
        >
          <p className="font-semibold text-[color:var(--fg)]">{emptyTitle}</p>
          <p className="mt-0.5 text-[color:var(--muted)]">{emptyBody}</p>
          {clientHref ? (
            <a
              href={clientHref}
              className="mt-1.5 inline-block text-[11px] font-bold text-[color:var(--brand)] hover:underline"
            >
              Ouvrir la fiche →
            </a>
          ) : null}
          <button
            type="button"
            className="mt-1 block text-[10px] font-bold text-[color:var(--muted)]"
            onClick={() => setHint(false)}
          >
            Fermer
          </button>
        </div>
      ) : null}
    </span>
  )
}
