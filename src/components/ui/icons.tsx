import type { ReactNode } from 'react'

type IconProps = {
  children: ReactNode
  size?: number
  className?: string
}

export function Icon(props: IconProps) {
  const size = props.size ?? 22
  // Prefer explicit `size`; avoid width/height attrs fighting Tailwind `h-*`/`w-*` classes.
  const sizedByClass = Boolean(props.className && /\b(?:h|w)-/.test(props.className))
  return (
    <svg
      viewBox="0 0 24 24"
      width={sizedByClass ? undefined : size}
      height={sizedByClass ? undefined : size}
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

export function IconNoteValidated(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M7 3h10a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h5" />
      <path d="M8 3v18" />
      <path d="M16.5 5.5l1.6 1.6 3.6-4" />
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
      <rect x="9" y="9" width="11" height="11" rx="3" />
      <path d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
    </Icon>
  )
}

export function IconSearch(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  )
}

export function IconFilter(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </Icon>
  )
}

export function IconUser(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M20 21a8 8 0 1 0-16 0" />
      <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
    </Icon>
  )
}

export function IconEdit(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </Icon>
  )
}

export function IconTrash(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Icon>
  )
}

export function IconCheck(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M20 6L9 17l-5-5" />
    </Icon>
  )
}

export function IconLink(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M10 13a5 5 0 0 1 0-7l.5-.5a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-.5.5a5 5 0 0 1-7-7l1-1" />
    </Icon>
  )
}

export function IconOpen(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M7 17L17 7" />
      <path d="M10 7h7v7" />
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

/** Sidebar / panel gauche — toggle repli. */
export function IconPanelLeft(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M3 4h6v16H3z" fill="currentColor" stroke="none" opacity="0.35" />
    </Icon>
  )
}

export function IconHome(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6 10v9h12v-9" />
    </Icon>
  )
}

export function IconUsers(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-2.8 2.2-5 6-5s6 2.2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 19c1.5-.4 3-1.6 3-4" />
    </Icon>
  )
}

export function IconChat(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Icon>
  )
}

export function IconCalendar(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M4 10h16" />
    </Icon>
  )
}

export function IconList(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M8 7h12" />
      <path d="M8 12h12" />
      <path d="M8 17h12" />
      <path d="M4 7h.01" />
      <path d="M4 12h.01" />
      <path d="M4 17h.01" />
    </Icon>
  )
}

export function IconFolder(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M3 8a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
    </Icon>
  )
}

export function IconBook(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z" />
      <path d="M5 4a3 3 0 0 0-3 3v13" />
    </Icon>
  )
}

export function IconWallet(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3V7z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h11" />
      <circle cx="16.5" cy="13.5" r="1.2" />
    </Icon>
  )
}

export function IconKey(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <circle cx="8" cy="14" r="3.5" />
      <path d="M11 14h9v3" />
      <path d="M17 14v3" />
    </Icon>
  )
}

export function IconPalette(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12" />
      <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="11" r="1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconDumbbell(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M6 9v6" />
      <path d="M18 9v6" />
      <path d="M6 12h12" />
      <path d="M3 10v4" />
      <path d="M21 10v4" />
      <path d="M8 8v8" />
      <path d="M16 8v8" />
    </Icon>
  )
}

/** Pause / repos entre items. */
export function IconRest(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </Icon>
  )
}

export function IconClose(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Icon>
  )
}

export function IconMenu(props: { size?: number; className?: string }) {
  return (
    <Icon size={props.size} className={props.className}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Icon>
  )
}
