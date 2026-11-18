/** Transition Drive — CoachAppShell (layout) reste monté. */
export default function DriveLoading() {
  return (
    <div className="mx-auto grid min-w-0 max-w-4xl animate-pulse gap-4 pb-4 sm:gap-5 sm:pb-6" aria-hidden>
      <div>
        <div className="h-2.5 w-16 rounded bg-[var(--accent)]" />
        <div className="mt-3 h-8 w-40 rounded-md bg-[var(--accent)]" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-[var(--accent)]/70" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="h-28 rounded-[var(--radius-lg)] bg-[var(--accent)]/80" />
        <div className="h-28 rounded-[var(--radius-lg)] bg-[var(--accent)]/60" />
        <div className="h-28 rounded-[var(--radius-lg)] bg-[var(--accent)]/50" />
        <div className="h-28 rounded-[var(--radius-lg)] bg-[var(--accent)]/40" />
      </div>
    </div>
  )
}
