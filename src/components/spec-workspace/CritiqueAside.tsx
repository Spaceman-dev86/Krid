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

/** Notes / questions column — sits outside the content card. */
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
        'sticky top-24 rounded-xl border border-amber-300/80 bg-amber-50/90 p-3 shadow-sm'
      }
    >
      <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-900/80">
        {label}
      </p>
      <div
        ref={ref}
        {...{ [dataAttr]: dataValue }}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onInput?.()}
        className="min-h-[3.5rem] rounded-md border border-dashed border-amber-400/70 bg-white/80 px-2 py-1.5 text-xs leading-relaxed text-amber-950 outline-none focus:border-amber-600 [&_p]:mb-1.5 [&_p:last-child]:mb-0"
      />
    </aside>
  )
}
