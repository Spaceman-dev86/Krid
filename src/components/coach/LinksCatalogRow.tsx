'use client'

import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'

type Props = {
  label: string
  cells: ReactNode
  detail: ReactNode
  colSpan: number
}

/** Ligne catalogue liens : clic pour déplier partage / leads / actions. */
export function LinksCatalogRow({ label, cells, detail, colSpan }: Props) {
  const [open, setOpen] = useState(false)

  function toggle() {
    setOpen((v) => !v)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
  }

  function stop(e: MouseEvent) {
    e.stopPropagation()
  }

  return (
    <>
      <tr
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={label}
        onClick={toggle}
        onKeyDown={onKeyDown}
        className="cursor-pointer hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] focus-visible:bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]"
      >
        {cells}
      </tr>
      {open ? (
        <tr className="bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]">
          <td colSpan={colSpan} className="px-5 py-3" onClick={stop}>
            {detail}
          </td>
        </tr>
      ) : null}
    </>
  )
}
