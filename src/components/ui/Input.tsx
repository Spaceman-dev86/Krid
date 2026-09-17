import { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  className?: string
}

export default function Input(props: Props) {
  const { className, ...rest } = props

  return (
    <input
      {...rest}
      className={cn(
        'h-14 w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-6 text-base text-[color:var(--fg)] ring-1 ring-[var(--border)] placeholder:text-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] disabled:opacity-50',
        className,
      )}
    />
  )
}
