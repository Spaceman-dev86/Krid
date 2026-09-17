import { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type Props = {
  children: ReactNode
  className?: string
}

export default function Card(props: Props) {
  return (
    <div
      className={cn(
        'bg-[var(--surface)] shadow-da-sm',
        props.className,
      )}
    >
      {props.children}
    </div>
  )
}
