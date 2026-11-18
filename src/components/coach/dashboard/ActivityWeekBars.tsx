import type { DashboardWeekDay } from '@/src/lib/coach/loadCoachHomeStats'

export function ActivityWeekBars({ days }: { days: DashboardWeekDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))

  return (
    <section
      className="coach-dash-in coach-dash-panel rounded-2xl border border-[var(--border)] p-5 shadow-da-sm"
      style={{ animationDelay: '240ms' }}
    >
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
        Activité clients · 7 j
      </h2>
      <p className="mt-1 text-xs text-[color:var(--muted)]">Séances réalisées par jour</p>

      <div className="mt-5 flex h-28 items-end gap-2">
        {days.map((d, i) => {
          const h = Math.max(d.count > 0 ? 14 : 6, Math.round((d.count / max) * 100))
          return (
            <div key={d.iso} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className="coach-dash-bar w-full max-w-[2rem] rounded-t-xl"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${280 + i * 55}ms`,
                  }}
                  title={`${d.count} séance${d.count > 1 ? 's' : ''}`}
                />
              </div>
              <span className="text-[10px] font-semibold uppercase text-[color:var(--muted)]">
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
