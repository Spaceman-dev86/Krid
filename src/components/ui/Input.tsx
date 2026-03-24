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
        'h-14 w-full rounded-[var(--radius-md)] bg-[var(--surface)] px-6 text-base text-[var(--text)] ring-1 ring-[var(--border)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]',
        className,
      )}
    />
  )
}
