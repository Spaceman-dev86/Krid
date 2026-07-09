'use client'

import { memo, useEffect } from 'react'

import { useProgramDocumentStore } from '../../store/program-editor/documentStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest('[contenteditable="true"]'))
}

function ProgramEditorUndoKeyboardInner() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      if (isEditableTarget(event.target)) return

      const store = useProgramDocumentStore.getState()
      if (!store.document) return

      const key = event.key.toLowerCase()

      if (key === 'z' && !event.shiftKey) {
        if (!store.canUndo()) return
        event.preventDefault()
        store.undo()
        return
      }

      if (key === 'y' || (key === 'z' && event.shiftKey)) {
        if (!store.canRedo()) return
        event.preventDefault()
        store.redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}

export default memo(ProgramEditorUndoKeyboardInner)
