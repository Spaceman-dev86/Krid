'use client'

import { memo, useCallback, useEffect, useState } from 'react'

import { EDITOR_TEXT_INPUT_X, EDITOR_TEXT_INPUT_X_DENSE } from './editorInputStyles'
import { handleMultilineTextKeyDown, handleSingleLineTextKeyDown } from './textFieldKeyboard'

type Props = {
  value: string
  onCommit: (value: string) => void
  /** Appelé après validation (Entrée / blur), même si la valeur n'a pas changé. */
  onDismiss?: () => void
  placeholder?: string
  multiline?: boolean
  className?: string
  inputClassName?: string
  disabled?: boolean
  dense?: boolean
  brandBorder?: boolean
  plain?: boolean
}

function InlineCommitFieldInner({
  value,
  onCommit,
  onDismiss,
  placeholder,
  multiline = false,
  className = '',
  inputClassName = '',
  disabled = false,
  dense = false,
  plain = false,
  brandBorder = false,
}: Props) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const finish = useCallback(() => {
    const trimmed = draft.trim()
    if (trimmed !== value.trim()) {
      onCommit(trimmed)
    }
    onDismiss?.()
  }, [draft, onCommit, onDismiss, value])

  const radius = dense ? 'rounded-lg' : 'rounded-xl'
  const pad = dense ? `${EDITOR_TEXT_INPUT_X_DENSE} py-1.5` : `${EDITOR_TEXT_INPUT_X} py-2`
  const text = dense ? 'text-xs' : 'text-sm'
  const border = brandBorder
    ? 'border border-[var(--brand)]/30 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15'
    : 'border border-gray-200 focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/15'
  const shared = plain
    ? `w-full border-0 bg-transparent ${pad} ${text} font-medium text-gray-900 outline-none transition placeholder:text-black/35 focus:ring-0 disabled:opacity-50 rounded-none`
    : `w-full ${border} bg-white ${pad} ${text} font-medium text-gray-900 outline-none transition placeholder:text-black/35 disabled:opacity-50 ${radius}`

  if (multiline) {
    return (
      <div className={className}>
        <textarea
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          rows={dense ? 2 : 3}
          className={`${shared} ${dense ? 'min-h-[52px]' : 'min-h-[72px]'} resize-y ${inputClassName}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) =>
            handleMultilineTextKeyDown(e, {
              onEscape: () => setDraft(value),
            })
          }
        />
      </div>
    )
  }

  return (
    <div className={className}>
      <input
        type="text"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        className={`${shared} ${dense ? 'h-8' : 'h-9'} ${inputClassName}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={(e) =>
          handleSingleLineTextKeyDown(e, {
            onEscape: () => {
              setDraft(value)
              onDismiss?.()
            },
          })
        }
      />
    </div>
  )
}

export default memo(InlineCommitFieldInner)
