type Step = {
  title: string
  description?: string
}

type Props = {
  steps: Step[]
  className?: string
}

export default function Timeline(props: Props) {
  return (
    <div className={`grid gap-4 ${props.className ?? ''}`.trim()}>
      {props.steps.map((step, i) => (
        <div key={`${i}-${step.title}`} className="grid grid-cols-[28px_1fr] gap-4">
          <div className="grid place-items-start">
            <div className="grid h-7 w-7 place-items-center rounded-full bg-[#341c44] text-xs font-extrabold text-white">
              {i + 1}
            </div>
            {i < props.steps.length - 1 ? <div className="ml-[13px] mt-2 h-full w-px bg-black/10" /> : null}
          </div>
          <div className="pt-1">
            <div className="text-sm font-extrabold text-[#341c44]">{step.title}</div>
            {step.description ? <div className="mt-1 text-sm text-black/70">{step.description}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
