import Link from 'next/link'
import { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { appUrl } from '../../lib/urls'

type Variant = 'primary' | 'secondary' | 'ghost' | 'gradient' | 'mirror'

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

function resolveHref(href: string): { external: boolean; href: string } {
  if (/^https?:\/\//i.test(href)) return { external: true, href }
  // Product-app routes live on APP_URL, not the marketing site.
  if (
    href === '/login' ||
    href.startsWith('/login?') ||
    href === '/home' ||
    href.startsWith('/home/') ||
    href === '/dashboard' ||
    href.startsWith('/dashboard/') ||
    href === '/admin' ||
    href.startsWith('/admin/')
  ) {
    return { external: true, href: appUrl(href) }
  }
  return { external: false, href }
}

export default function Button(props: Props) {
  const variant = props.variant ?? 'primary'

  const base =
    'inline-flex items-center justify-center rounded-full px-8 py-4 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-[var(--brand)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-60 disabled:pointer-events-none'

  const styles =
    variant === 'primary'
      ? 'bg-[var(--brand)] text-white shadow-da-sm hover:opacity-90'
      : variant === 'secondary'
        ? 'bg-[var(--surface)] text-[var(--brand)] ring-1 ring-[var(--brand)] hover:bg-[var(--accent)]'
        : variant === 'ghost'
          ? 'bg-transparent text-[var(--brand)] hover:bg-[var(--accent)]'
          : ''

  const ctaStyles =
    variant === 'gradient'
      ? 'bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] hover:opacity-95 focus:ring-[#341c44]'
      : variant === 'mirror'
        ? 'bg-white ring-1 ring-[#d6c4e8] bg-clip-text text-transparent bg-gradient-to-r from-[#9b6bb8] to-[#341c44] hover:bg-[#faf7ff] focus:ring-[#341c44]'
        : null

  const finalStyles = ctaStyles ?? styles

  if ('href' in props && props.href !== undefined) {
    const resolved = resolveHref(props.href)
    const className = cn(base, finalStyles, props.className)
    if (resolved.external) {
      return (
        <a href={resolved.href} className={className}>
          {props.children}
        </a>
      )
    }
    return (
      <Link href={resolved.href} className={className}>
        {props.children}
      </Link>
    )
  }

  const { className, children, ...rest } = props

  return (
    <button {...rest} className={cn(base, finalStyles, className)}>
      {children}
    </button>
  )
}
