import Link from 'next/link'
import { ButtonHTMLAttributes, ReactNode } from 'react'

import { cn } from '../../lib/cn'

/**
 * Boutons DA Trainly (verrou /admin/design)
 *
 * Officiels :
 * - Black : mist · beam
 * - White : cta · secondary
 * - Communs : ghost · danger · link
 *
 * Alias legacy → mappés pour ne pas casser l’app pendant la migration.
 */
export type ButtonVariant =
  | 'mist'
  | 'beam'
  | 'cta'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'link'
  /* legacy aliases */
  | 'primary'
  | 'gradient'
  | 'solid'
  | 'soft'
  | 'outline'
  | 'halo'
  | 'lift'
  | 'mirror'
  | 'chip'
  | 'aurora'
  | 'flat'
  | 'line'
  | 'ink'
  | 'slash'
  | 'nova'
  | 'prism'

export type ButtonSize = 'sm' | 'md' | 'lg'

type CommonProps = {
  children: ReactNode
  className?: string
  variant?: ButtonVariant
  size?: ButtonSize
}

type LinkProps = CommonProps & { href: string }
type NativeButtonProps = CommonProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>
type Props = LinkProps | NativeButtonProps

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-5 py-2 text-sm',
  md: 'px-8 py-3.5 text-base',
  lg: 'px-10 py-4 text-base',
}

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page-bg)] disabled:pointer-events-none disabled:opacity-45'

/** Styles officiels */
const OFFICIAL: Record<'mist' | 'beam' | 'cta' | 'secondary' | 'ghost' | 'danger' | 'link', string> = {
  mist: 'bg-gradient-to-r from-[#d6c4e8] to-[#9b6bb8] text-[#1a1a1e] shadow-none hover:brightness-110',
  beam: 'bg-gradient-to-b from-[#2a2a30] to-[#121214] text-[#d6c4e8] ring-1 ring-[#d6c4e8]/50 shadow-none hover:ring-[#d6c4e8]',
  cta: 'bg-gradient-to-r from-[#c4a8dc] via-[#9b6bb8] to-[#7a4f9a] text-white shadow-[0_10px_28px_rgba(155,107,184,0.35)] hover:opacity-95',
  secondary:
    'bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-fg)] ring-1 ring-[var(--btn-secondary-ring)] hover:bg-[var(--btn-secondary-hover)]',
  ghost: 'bg-transparent text-[color:var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]',
  danger: 'bg-[#991b1b] text-white shadow-none hover:bg-[#7f1616]',
  link: 'rounded-none bg-transparent px-0 py-0 text-[color:var(--brand)] underline-offset-4 hover:underline focus-visible:ring-0 focus-visible:ring-offset-0',
}

/**
 * Default sans variant : suit le mode
 * - light → cta (texte blanc)
 * - dark → mist (texte encre #1a1a1e)
 */
const AUTO_DEFAULT =
  'bg-gradient-to-r from-[#d6c4e8] to-[#9b6bb8] text-[#1a1a1e] shadow-none hover:brightness-110 [[data-theme=light]_&]:from-[#c4a8dc] [[data-theme=light]_&]:via-[#9b6bb8] [[data-theme=light]_&]:to-[#7a4f9a] [[data-theme=light]_&]:text-white [[data-theme=light]_&]:shadow-[0_10px_28px_rgba(155,107,184,0.35)] [[data-theme=light]_&]:hover:opacity-95 [[data-theme=light]_&]:hover:brightness-100'

/** Alias → officiel (migration progressive) */
const ALIAS: Record<string, keyof typeof OFFICIAL> = {
  primary: 'cta',
  gradient: 'cta',
  solid: 'cta',
  soft: 'cta',
  outline: 'secondary',
  halo: 'secondary',
  lift: 'secondary',
  mirror: 'secondary',
  chip: 'beam',
  aurora: 'mist',
  flat: 'mist',
  line: 'beam',
  ink: 'beam',
  slash: 'beam',
  nova: 'beam',
  prism: 'mist',
}

function resolveVariant(variant: ButtonVariant | undefined): keyof typeof OFFICIAL | 'auto' {
  if (!variant) return 'auto'
  if (variant in OFFICIAL) return variant as keyof typeof OFFICIAL
  return ALIAS[variant] ?? 'auto'
}

export default function Button(props: Props) {
  const resolved = resolveVariant(props.variant)
  const size = props.size ?? 'md'
  const className = cn(
    BASE,
    resolved === 'link' ? '' : SIZE[size],
    resolved === 'auto' ? AUTO_DEFAULT : OFFICIAL[resolved],
    props.className,
  )

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={className}>
        {props.children}
      </Link>
    )
  }

  const { children, className: _c, variant: _v, size: _s, ...rest } = props
  return (
    <button {...rest} className={className}>
      {children}
    </button>
  )
}
