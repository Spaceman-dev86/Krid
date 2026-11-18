'use client'

import { useEffect, useRef } from 'react'

type Props = {
  /** Stable key to reset editor when switching entity */
  entityId: string
  initialHtml?: string
  /** data-* attribute for DOM sync on save */
  dataAttr: string
  dataValue: string
  label?: string
  className?: string
  onInput?: () => void
}

/** Notes / questions — tokens warning (lisible dark + light). */
export function CritiqueAside({
  entityId,
  initialHtml,
  dataAttr,
  dataValue,
  label = 'Notes & questions',
  className,
  onInput,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialHtml?.trim() ? initialHtml : '<p></p>'
    }
    // Reset only when switching entity — avoid wiping in-progress edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  return (
    <aside
      className={
        className ??
        'sticky top-24 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 shadow-da-sm'
      }
    >
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--warning)]">
        {label}
      </p>
      <div
        ref={ref}
        {...{ [dataAttr]: dataValue }}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onInput?.()}
        className="min-h-[3.5rem] rounded-md border border-dashed border-[var(--warning-border)] bg-[var(--surface)]/85 px-2 py-1.5 text-xs leading-relaxed text-[color:var(--fg)] outline-none focus:border-[var(--warning)] [&_p]:mb-1.5 [&_p:last-child]:mb-0"
      />
    </aside>
  )
}
