type Item = {
  q: string
  a: string
}

type Props = {
  items: Item[]
  className?: string
}

export default function FaqAccordion(props: Props) {
  return (
    <div className={`grid gap-3 ${props.className ?? ''}`.trim()}>
      {props.items.map((item) => (
        <details key={item.q} className="group rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-extrabold text-[#9b6bb8]">
            <span className="select-none">{item.q}</span>
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white">
              <span className="text-sm font-extrabold leading-none group-open:hidden">+</span>
              <span className="text-sm font-extrabold leading-none hidden group-open:inline">—</span>
            </span>
          </summary>
          <div className="mt-2 text-sm text-black/70">{item.a}</div>
        </details>
      ))}
    </div>
  )
}
