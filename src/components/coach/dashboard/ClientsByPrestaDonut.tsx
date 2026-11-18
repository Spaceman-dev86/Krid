import Link from 'next/link'

import type { DashboardPrestaSlice } from '@/src/lib/coach/loadCoachHomeStats'

/** Camembert 100 % famille Krid (lavande → orchid → plum). */
const SLICE_COLORS = [
  'var(--dash-lavender, var(--brand))',
  'var(--dash-orchid, var(--brand-mid))',
  'var(--dash-mist, var(--brand-soft))',
  'var(--dash-violet)',
  'var(--dash-lilac)',
  'var(--dash-plum)',
]

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
) {
  const large = endAngle - startAngle > 180 ? 1 : 0
  const so = polar(cx, cy, rOuter, startAngle)
  const eo = polar(cx, cy, rOuter, endAngle)
  const si = polar(cx, cy, rInner, endAngle)
  const ei = polar(cx, cy, rInner, startAngle)
  return [
    `M ${so.x} ${so.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${eo.x} ${eo.y}`,
    `L ${si.x} ${si.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ei.x} ${ei.y}`,
    'Z',
  ].join(' ')
}

export function ClientsByPrestaDonut({
  slices,
  clientsActive,
  clientsNewMonth,
  bilansUnread,
}: {
  slices: DashboardPrestaSlice[]
  clientsActive: number
  clientsNewMonth: number
  bilansUnread: number
}) {
  const total = slices.reduce((s, x) => s + x.count, 0) || clientsActive
  const gap = slices.length > 1 ? 2.8 : 0
  let angle = 0
  const arcs =
    total > 0 && slices.length > 0
      ? slices.map((slice, i) => {
          const span = (slice.count / total) * 360
          const start = angle + gap / 2
          const end = angle + span - gap / 2
          angle += span
          const safeEnd = end > start ? end : start + 0.01
          return {
            ...slice,
            color: SLICE_COLORS[i % SLICE_COLORS.length],
            d: arcPath(50, 50, 44, 27, start, safeEnd),
          }
        })
      : []

  return (
    <section
      className="coach-dash-in coach-dash-panel flex h-full flex-col rounded-2xl border border-[var(--border)] shadow-da-sm"
      style={{ animationDelay: '180ms' }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
          Clients par presta
        </h2>
        <Link
          href="/profile/prestations"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[color:var(--brand)] ring-1 ring-[color-mix(in_srgb,var(--brand)_35%,var(--border))] transition hover:bg-[color-mix(in_srgb,var(--brand)_28%,transparent)]"
          aria-label="Voir les prestations"
        >
          →
        </Link>
      </div>

      <div className="grid flex-1 gap-4 p-5 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,11rem)] sm:items-center">
        <div className="grid gap-3 text-sm">
          <Snap value={clientsActive} label="Actifs" />
          <Snap value={clientsNewMonth} label="Nouveaux mois" />
          <Snap value={bilansUnread} label="Bilans à lire" accent={bilansUnread > 0} />
        </div>

        <div className="coach-dash-donut relative mx-auto aspect-square w-full max-w-[12rem]">
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="35.5"
              fill="color-mix(in srgb, var(--brand) 8%, var(--surface))"
            />
            {arcs.length === 0 ? (
              <circle
                cx="50"
                cy="50"
                r="35.5"
                fill="none"
                stroke="color-mix(in srgb, var(--brand) 35%, var(--border))"
                strokeWidth="16"
              />
            ) : (
              arcs.map((a) => (
                <path
                  key={a.id}
                  d={a.d}
                  fill={a.color}
                  className="origin-center transition-opacity duration-200 hover:opacity-90"
                />
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-extrabold tabular-nums text-[color:var(--fg)]">{total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand)]">
              clients
            </p>
          </div>
        </div>

        <ul className="grid gap-2.5">
          {slices.length === 0 ? (
            <li className="text-sm text-[color:var(--muted)]">Aucune presta active</li>
          ) : (
            slices.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2.5 text-sm">
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full shadow-[0_0_10px_color-mix(in_srgb,var(--brand)_35%,transparent)]"
                  style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }}
                />
                <span className="min-w-0 flex-1 truncate text-[color:var(--muted)]">{s.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-[color:var(--fg)]">
                  {s.count}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}

function Snap({
  value,
  label,
  accent = false,
}: {
  value: number
  label: string
  accent?: boolean
}) {
  return (
    <div>
      <p
        className={`text-lg font-extrabold tabular-nums ${
          accent ? 'text-[color:var(--brand)]' : 'text-[color:var(--fg)]'
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] text-[color:var(--muted)]">{label}</p>
    </div>
  )
}
