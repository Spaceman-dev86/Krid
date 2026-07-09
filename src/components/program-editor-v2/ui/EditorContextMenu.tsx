'use client'

import { memo, useEffect } from 'react'

import { useProgramEditorUiStore } from '../../../store/program-editor/uiStore'

function EditorContextMenuInner() {
  const menu = useProgramEditorUiStore((s) => s.contextMenu)
  const closeContextMenu = useProgramEditorUiStore((s) => s.closeContextMenu)

  useEffect(() => {
    if (!menu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    const onPointer = () => closeContextMenu()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [closeContextMenu, menu])

  if (!menu) return null

  return (
    <div
      role="menu"
      className="fixed z-[80] min-w-[180px] overflow-hidden rounded-xl border border-black/10 bg-white py-1 shadow-lg shadow-black/15"
      style={{ left: menu.x, top: menu.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {menu.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          className={[
            'flex w-full items-center px-3 py-2 text-left text-sm font-semibold transition hover:bg-[#f5f5f5]',
            item.danger ? 'text-red-700 hover:bg-red-50' : 'text-gray-900',
            item.disabled ? 'cursor-not-allowed opacity-40' : '',
          ].join(' ')}
          onClick={() => {
            if (item.disabled) return
            item.onSelect()
            closeContextMenu()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default memo(EditorContextMenuInner)
