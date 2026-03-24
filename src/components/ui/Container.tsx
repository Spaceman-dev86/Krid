import { ReactNode } from 'react'

import { cn } from '../../lib/cn'

type Props = {
  children: ReactNode
  className?: string
}

export default function Container(props: Props) {
  return <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-6', props.className)}>{props.children}</div>
}
