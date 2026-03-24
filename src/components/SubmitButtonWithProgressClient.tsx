'use client'

import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'

type Props = {
  label: string
  style?: React.CSSProperties
  icon?: ReactNode
  iconOnly?: boolean
}

export default function SubmitButtonWithProgressClient({ label, style, icon, iconOnly }: Props) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pending ? 0.85 : 1,
      }}
      aria-busy={pending}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
    >
      {pending ? (
        <svg width="16" height="16" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="31.4 31.4"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 25 25"
              to="360 25 25"
              dur="0.9s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      ) : icon ? (
        <span aria-hidden="true">{icon}</span>
      ) : null}
      {!iconOnly ? <span>{pending ? `${label}…` : label}</span> : null}
    </button>
  )
}
