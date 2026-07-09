import Link from 'next/link'
import { ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'gradient' | 'mirror'

type Props = {
  href: string
  children: ReactNode
  variant?: Variant
  className?: string
}

export default function Button(props: Props) {
  const variant = props.variant ?? 'primary'

  const base =
    'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:px-6'

  const styles =
    variant === 'gradient'
      ? 'bg-gradient-to-r from-[#d6c4e8] via-[#9b6bb8] to-[#341c44] text-white shadow-[0_8px_24px_rgba(52,28,68,0.28)] hover:opacity-95 focus:ring-[#341c44]'
      : variant === 'mirror'
        ? 'bg-white ring-1 ring-[#d6c4e8] bg-clip-text text-transparent bg-gradient-to-r from-[#9b6bb8] to-[#341c44] hover:bg-[#faf7ff] focus:ring-[#341c44]'
        : variant === 'primary'
          ? 'bg-[#341c44] text-white hover:opacity-90 focus:ring-[#341c44]'
          : 'bg-white text-[#341c44] ring-1 ring-[#341c44]/15 hover:bg-[#f5f5f5] focus:ring-[#341c44]'

  return (
    <Link href={props.href} className={`${base} ${styles} ${props.className ?? ''}`.trim()}>
      {props.children}
    </Link>
  )
}
