import { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export default function Card(props: Props) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5 ${props.className ?? ''}`.trim()}
    >
      {props.children}
    </div>
  )
}
