import type { ReactNode } from 'react'

type IconProps = {
  children: ReactNode
  size?: number
  className?: string
}

export function Icon(props: IconProps) {
  const size = props.size ?? 22
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={props.className}
      style={{ display: 'block', overflow: 'visible' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  )
}

export function IconBack(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  )
}

export function IconNote(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
      <path d="M8 3v18" />
    </Icon>
  )
}

export function IconStats(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </Icon>
  )
}

export function IconPlus(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  )
}

export function IconMinus(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function IconDuplicate(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  )
}

export function IconSettings(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M4 6h10" />
      <path d="M18 6h2" />
      <path d="M14 6v0" />
      <path d="M4 12h2" />
      <path d="M10 12h10" />
      <path d="M6 12v0" />
      <path d="M4 18h8" />
      <path d="M16 18h4" />
      <path d="M12 18v0" />
      <circle cx="14" cy="6" r="2" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </Icon>
  )
}
