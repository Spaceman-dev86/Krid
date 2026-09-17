'use client'

import { useState, type ReactNode } from 'react'

type Props = {
  primaryColor: string
  children: ReactNode
  defaultOpen?: boolean
}

export function ClientHomeBookPlansToggle({ primaryColor, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-bold shadow-sm"
          style={{ color: primaryColor }}
          aria-expanded={open}
        >
          <span aria-hidden className="text-[11px] font-black tracking-wide">
            Book
          </span>
          {open ? 'Masquer' : 'Plans'}
        </button>
      </div>
      {open ? children : null}
    </div>
  )
}
