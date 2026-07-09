'use client'

import { memo } from 'react'

type Props = {
  label: string
  meta?: string
}

function TimelineDragPreviewInner({ label, meta }: Props) {
  return (
    <div className="pointer-events-none w-[min(320px,calc(100vw-2rem))] rounded-xl border border-[var(--brand)]/25 bg-white px-3 py-2.5 shadow-xl shadow-black/15 ring-2 ring-[var(--brand)]/20">
      <div className="text-sm font-extrabold text-[var(--brand)]">{label}</div>
      {meta ? <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-black/40">{meta}</div> : null}
    </div>
  )
}

export default memo(TimelineDragPreviewInner)
