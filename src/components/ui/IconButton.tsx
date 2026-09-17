import Link from 'next/link'
import { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

/**
 * Pastille icône ronde — DA /admin/design
 * soft = claire / charcoal · solid = fill brand
 */
export type IconButtonTone = 'soft' | 'solid'

type CommonProps = {
  children: ReactNode
  className?: string
  tone?: IconButtonTone
  size?: 'sm' | 'md' | 'lg'
  /** Accessible name (obligatoire) */
  label: string
}

type LinkProps = CommonProps & { href: string }
type NativeProps = CommonProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>
type Props = LinkProps | NativeProps

const SIZE = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
} as const

const TONE: Record<IconButtonTone, string> = {
  soft: 'bg-[var(--icon-soft-bg)] text-[var(--icon-soft-fg)] ring-1 ring-[var(--icon-soft-ring)]',
  solid: 'bg-[var(--icon-solid-bg)] text-[var(--icon-solid-fg)]',
}

export default function IconButton(props: Props) {
  const tone = props.tone ?? 'soft'
  const size = props.size ?? 'md'
  const className = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2 focus:ring-offset-[var(--page-bg)] disabled:pointer-events-none disabled:opacity-45',
    SIZE[size],
    TONE[tone],
    props.className,
  )

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={className} aria-label={props.label} title={props.label}>
        {props.children}
      </Link>
    )
  }

  const { children, label, className: _c, tone: _t, size: _s, ...rest } = props
  return (
    <button type="button" {...rest} className={className} aria-label={label} title={label}>
      {children}
    </button>
  )
}
