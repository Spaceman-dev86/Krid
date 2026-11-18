'use client'

import { useEffect, useRef, type TextareaHTMLAttributes } from 'react'

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number
}

/** Textarea qui grandit avec le contenu (pas de scroll interne). */
export function AutoGrowTextarea({
  minRows = 2,
  className = '',
  onInput,
  value,
  defaultValue,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    resize()
  }, [value, defaultValue, minRows])

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={minRows}
      value={value}
      defaultValue={defaultValue}
      className={`overflow-hidden ${className}`}
      onInput={(e) => {
        resize()
        onInput?.(e)
      }}
    />
  )
}
