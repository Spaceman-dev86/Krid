import type { ShowroomMonthStats } from '@/src/lib/tracking/loadShowroomMonthStats'

export function ShowroomMonthStatsStrip({ stats }: { stats: ShowroomMonthStats }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-da-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Showroom
        </h2>
        <span className="text-[11px] font-semibold text-[color:var(--muted)]">{stats.monthLabel}</span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <StatCell
          value={stats.allClickPeople}
          label={stats.allClickPeople > 1 ? 'clics' : 'clic'}
          hint="Toutes campagnes"
        />
        <StatCell
          value={stats.prestaClickPeople}
          label={stats.prestaClickPeople > 1 ? 'clics fiche' : 'clic fiche'}
          hint="Campagnes → presta"
        />
        <StatCell
          value={stats.showroomBuyers}
          label={stats.showroomBuyers > 1 ? 'achats' : 'achat'}
          hint="Payés ce mois"
        />
      </div>
    </section>
  )
}

function StatCell({
  value,
  label,
  hint,
}: {
  value: number
  label: string
  hint: string
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-[color:var(--fg)] sm:text-3xl">
        {value}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-[color:var(--brand)]">{label}</p>
      <p className="mt-0.5 text-[11px] text-[color:var(--muted)]">{hint}</p>
    </div>
  )
}
