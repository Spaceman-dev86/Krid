import Link from 'next/link'

type Kpi = {
  href: string
  value: number
  label: string
  hint: string
}

export function DashboardKpiRow({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className="coach-dash-in coach-dash-kpi rounded-2xl border border-[var(--border)] p-4 shadow-da-sm"
          style={{ animationDelay: `${80 + i * 70}ms` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">
            {item.label}
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight text-[color:var(--fg)]">
            {item.value}
          </p>
          <p className="mt-1 text-xs font-semibold text-[color:var(--brand)]">{item.hint}</p>
        </Link>
      ))}
    </div>
  )
}
