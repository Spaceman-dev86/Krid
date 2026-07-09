'use client'

import { memo } from 'react'

import { IconEdit } from './EditorIcons'

type Props = {
  label: string
  onClick: () => void
  inverted?: boolean
}

function TitleEditButtonInner({ label, onClick, inverted = false }: Props) {
  return (
    <button
      type="button"
      className={
        inverted
          ? 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[var(--brand)] shadow-sm ring-1 ring-white/40 transition hover:bg-white/90'
          : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-sm ring-1 ring-black/10 transition hover:opacity-90'
      }
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
    >
      <IconEdit size={14} />
    </button>
  )
}

export default memo(TitleEditButtonInner)
