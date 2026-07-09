'use client'

import { memo, useEffect, useRef, useState, type ReactNode } from 'react'

import { EDITOR_CLS } from '../editorLayoutConstants'

export type ToolbarOverflowAction = {
  label: string
  onClick: () => void
  danger?: boolean
  icon?: ReactNode
}

type Props = {
  actions: ToolbarOverflowAction[]
  /** 'brand' when on dark header (open week) */
  variant?: 'brand' | 'inverted'
}

function EditorToolbarOverflowInner({ actions, variant = 'brand' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const el = ref.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const triggerClass =
    variant === 'inverted'
      ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--brand)] shadow-sm ring-1 ring-white/40 transition hover:bg-white/90'
      : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90'

  return (
    <div
      className={['relative shrink-0', EDITOR_CLS.toolbarOverflow].join(' ')}
      ref={ref}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={triggerClass}
        aria-label="Actions"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-base font-bold leading-none" aria-hidden>
          ⋯
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg shadow-black/15">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={[
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-[#f5f5f5]',
                action.danger ? 'text-red-600' : 'text-[var(--brand)]',
              ].join(' ')}
              onClick={() => {
                action.onClick()
                setOpen(false)
              }}
            >
              {action.icon ? <span className="shrink-0">{action.icon}</span> : null}
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default memo(EditorToolbarOverflowInner)
