'use client'

import { useState } from 'react'

import { CopyCodeButton } from './CopyCodeButton'
import { channelLabel } from '../../lib/tracking/trackedLinks'

export type LinkLeadItem = {
  id: string
  channel: string
  handle: string | null
  phone: string | null
  first_name: string | null
  last_name: string | null
  created_at: string
  contact: string
  whenLabel: string
}

export function LinkLeadsCollapse({
  leads,
  captureOn,
}: {
  leads: LinkLeadItem[]
  captureOn: boolean
}) {
  const [open, setOpen] = useState(true)

  if (!captureOn && leads.length === 0) return null

  if (leads.length === 0) {
    return <p className="mt-2 text-[11px] text-[color:var(--muted)]">Aucun lead sur ce lien.</p>
  }

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]"
        aria-expanded={open}
      >
        <span
          className={`inline-block text-[10px] transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        >
          ▸
        </span>
        {leads.length} lead{leads.length > 1 ? 's' : ''}
      </button>

      {open ? (
        <ul className="mt-1.5 space-y-1 border-l-2 border-[color-mix(in_srgb,var(--brand)_15%,transparent)] pl-3">
          {leads.map((lead) => (
            <li key={lead.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--fg)]">{lead.contact}</p>
                <p className="text-[11px] text-[color:var(--muted)]">
                  {channelLabel(lead.channel)} · {lead.whenLabel}
                </p>
              </div>
              {lead.phone ? (
                <CopyCodeButton code={lead.phone} label="Tél." />
              ) : lead.handle ? (
                <CopyCodeButton code={lead.handle} label="Copier" />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
