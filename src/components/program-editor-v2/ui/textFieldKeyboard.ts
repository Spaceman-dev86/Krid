import type { KeyboardEvent } from 'react'

type Options = {
  onEscape?: () => void
}

/** Entrée = quitter le champ ; Maj+Entrée = nouvelle ligne (textarea). */
export function handleMultilineTextKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>,
  options?: Options
) {
  e.stopPropagation()
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    e.currentTarget.blur()
    return
  }
  if (e.key === 'Escape') {
    options?.onEscape?.()
    e.currentTarget.blur()
  }
}

/** Entrée ou Échap = quitter le champ. */
export function handleSingleLineTextKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  options?: Options
) {
  e.stopPropagation()
  if (e.key === 'Enter') {
    e.preventDefault()
    e.currentTarget.blur()
    return
  }
  if (e.key === 'Escape') {
    options?.onEscape?.()
    e.currentTarget.blur()
  }
}
