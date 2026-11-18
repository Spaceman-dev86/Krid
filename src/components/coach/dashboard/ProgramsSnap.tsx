import Link from 'next/link'

export function ProgramsSnap({
  encours,
  paused,
}: {
  encours: number
  paused: number
}) {
  return (
    <section
      className="coach-dash-in coach-dash-panel flex h-full flex-col rounded-2xl border border-[var(--border)] p-5 shadow-da-sm"
      style={{ animationDelay: '300ms' }}
    >
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">
        Programmes en cours
      </h2>
      <p className="mt-4 bg-gradient-to-br from-[var(--brand-soft)] via-[var(--brand)] to-[var(--brand-mid)] bg-clip-text text-4xl font-extrabold tabular-nums tracking-tight text-transparent">
        {encours}
      </p>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        plans actifs
        {paused > 0 ? (
          <>
            {' '}
            · <span className="font-semibold text-[color:var(--fg)]">{paused}</span> en pause
          </>
        ) : null}
      </p>
      <Link
        href="/programs/encours"
        className="mt-auto inline-flex w-fit items-center gap-1 rounded-xl bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] px-3 py-2 text-sm font-bold text-[color:var(--brand)] ring-1 ring-[color-mix(in_srgb,var(--brand)_30%,transparent)] transition hover:bg-[color-mix(in_srgb,var(--brand)_26%,transparent)]"
      >
        Voir En cours →
      </Link>
    </section>
  )
}
