import { ReactNode } from 'react'

type Props = {
  label?: ReactNode
  className?: string
}

export default function ImagePlaceholder(props: Props) {
  return (
    <div
      className={`grid place-items-center rounded-3xl bg-white/60 p-4 text-center text-xs font-semibold text-black/50 ring-1 ring-black/10 ${props.className ?? ''}`.trim()}
    >
      <div className="max-w-[22ch]">{props.label ?? 'Image placeholder'}</div>
    </div>
  )
}
