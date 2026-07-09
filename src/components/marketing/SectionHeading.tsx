type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  className?: string
  eyebrowClassName?: string
  titleClassName?: string
}

export default function SectionHeading(props: Props) {
  return (
    <div className={`grid gap-2 ${props.className ?? ''}`.trim()}>
      {props.eyebrow ? (
        <div className={`text-xs font-bold uppercase tracking-wide ${props.eyebrowClassName ?? 'text-[#9b6bb8]'}`.trim()}>
          {props.eyebrow}
        </div>
      ) : null}
      <h2
        className={`text-2xl font-extrabold tracking-tight sm:text-3xl ${props.titleClassName ?? 'text-[#9b6bb8]'}`.trim()}
      >
        {props.title}
      </h2>
      {props.subtitle ? <p className="text-sm text-black/70 sm:text-base">{props.subtitle}</p> : null}
    </div>
  )
}
