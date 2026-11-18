import Link from 'next/link'

import type { DashboardRdvItem } from '@/src/lib/coach/loadCoachHomeStats'

export function TodayPanel({
  rdvs,
  rdvTotal,
  chatUnread,
  leadsMonth,
  bilansUnread,
}: {
  rdvs: DashboardRdvItem[]
  rdvTotal: number
  chatUnread: number
  leadsMonth: number
  bilansUnread: number
}) {
  return (
    <section
      className="coach-dash-in coach-dash-panel flex h-full flex-col rounded-2xl border border-[var(--border)] shadow-da-sm"
      style={{ animationDelay: '140ms' }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Aujourd’hui
        </h2>
        <Link
          href="/calendar"
          className="text-xs font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--brand)]"
        >
          Calendrier →
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3 py-3">
        {rdvs.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[color:var(--muted)]">Aucun RDV aujourd’hui</p>
        ) : (
          <ul className="grid gap-1">
            {rdvs.map((r) => (
              <li key={r.id}>
                <Link
                  href="/calendar"
                  className="flex items-baseline gap-3 rounded-xl px-2 py-2 transition hover:bg-[color-mix(in_srgb,var(--brand)_10%,var(--accent))]"
                >
                  <span className="relative w-12 shrink-0 pl-2 text-xs font-bold tabular-nums text-[color:var(--brand)]">
                    <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--brand)] shadow-[0_0_8px_var(--brand)]" />
                    {r.timeLabel}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[color:var(--fg)]">
                      {r.title}
                    </span>
                    <span className="block truncate text-xs text-[color:var(--muted)]">
                      {r.clientLabel}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rdvTotal > rdvs.length ? (
          <Link
            href="/calendar"
            className="px-2 text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]"
          >
            +{rdvTotal - rdvs.length} autre{rdvTotal - rdvs.length > 1 ? 's' : ''}
          </Link>
        ) : null}
      </div>

      <div className="mt-auto grid gap-0.5 border-t border-[var(--border)] p-2">
        <QuickRow href="/chat" label="Chat" value={chatUnread} unit="non lu" hot={chatUnread > 0} />
        <QuickRow href="/profile/liens" label="Leads" value={leadsMonth} unit="ce mois" />
        <QuickRow
          href="/clients/bilans"
          label="Bilans"
          value={bilansUnread}
          unit="à lire"
          hot={bilansUnread > 0}
        />
      </div>
    </section>
  )
}

function QuickRow({
  href,
  label,
  value,
  unit,
  hot = false,
}: {
  href: string
  label: string
  value: number
  unit: string
  hot?: boolean
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl px-3 py-2 text-sm transition hover:bg-[color-mix(in_srgb,var(--brand)_10%,var(--accent))]"
    >
      <span className="font-semibold text-[color:var(--fg)]">{label}</span>
      <span className="text-xs font-semibold text-[color:var(--muted)]">
        <span
          className={`tabular-nums ${
            hot ? 'text-[color:var(--brand)]' : 'text-[color:var(--brand)]'
          }`}
        >
          {value}
        </span>{' '}
        {unit}
      </span>
    </Link>
  )
}
