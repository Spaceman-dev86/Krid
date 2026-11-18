/** Transition instantanée — le shell admin (layout) reste monté. */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 py-8 md:px-6" aria-hidden>
      <div className="h-2.5 w-16 rounded bg-[var(--accent)]" />
      <div className="mt-3 h-8 w-52 rounded-md bg-[var(--accent)]" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-[var(--accent)]/70" />
      <div className="mt-8 grid gap-3">
        <div className="h-24 rounded-[var(--radius-lg)] bg-[var(--accent)]/80" />
        <div className="h-24 rounded-[var(--radius-lg)] bg-[var(--accent)]/60" />
        <div className="h-24 rounded-[var(--radius-lg)] bg-[var(--accent)]/50" />
      </div>
    </div>
  )
}
