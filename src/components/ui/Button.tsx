import Link from 'next/link'
import { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost'

type CommonProps = {
  children: ReactNode
  className?: string
  variant?: Variant
}

type LinkProps = CommonProps & {
  href: string
}

type NativeButtonProps = CommonProps & {
  href?: undefined
} & ButtonHTMLAttributes<HTMLButtonElement>

type Props = LinkProps | NativeButtonProps

export default function Button(props: Props) {
  const variant = props.variant ?? 'primary'

  const base =
    'inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-60 disabled:pointer-events-none'

  const styles =
    variant === 'primary'
      ? 'bg-[var(--brand)] text-white shadow-[var(--shadow-sm)] hover:opacity-90'
      : variant === 'secondary'
        ? 'bg-[var(--surface)] text-[var(--brand)] ring-1 ring-[var(--brand)] hover:bg-[var(--accent)]'
        : 'bg-transparent text-[var(--brand)] hover:bg-[var(--accent)]'

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={cn(base, styles, props.className)}>
        {props.children}
      </Link>
    )
  }

  const { className, children, ...rest } = props

  return (
    <button {...rest} className={cn(base, styles, className)}>
      {children}
    </button>
  )
}
