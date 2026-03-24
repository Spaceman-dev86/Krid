import Link from 'next/link'
import { ReactNode } from 'react'

type Variant = 'primary' | 'secondary'

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
    variant === 'primary'
      ? 'bg-[#341c44] text-white hover:opacity-90 focus:ring-[#341c44]'
      : 'bg-white text-[#341c44] ring-1 ring-[#341c44]/15 hover:bg-[#f5f5f5] focus:ring-[#341c44]'

  return (
    <Link href={props.href} className={`${base} ${styles} ${props.className ?? ''}`.trim()}>
      {props.children}
    </Link>
  )
}
