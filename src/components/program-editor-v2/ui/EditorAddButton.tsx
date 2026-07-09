'use client'

import { memo } from 'react'

import { EDITOR_PANEL_SHADOW_CLASS } from './editorInputStyles'

type Props = {
  children: string
  onClick: () => void
  panelShadow?: boolean
}

function EditorAddButtonInner({ children, onClick, panelShadow = false }: Props) {
  return (
    <button
      type="button"
      className={[
        'inline-flex h-10 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-extrabold text-[var(--brand)]',
        panelShadow ? EDITOR_PANEL_SHADOW_CLASS : 'shadow-sm shadow-black/10',
      ].join(' ')}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

export default memo(EditorAddButtonInner)
