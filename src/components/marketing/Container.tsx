import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export default function Container(props: Props) {
  return (
    <div className={`mx-auto w-full min-w-0 max-w-6xl px-5 sm:px-6 ${props.className ?? ''}`.trim()}>{props.children}</div>
  )
}
