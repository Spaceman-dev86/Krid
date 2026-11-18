/** Skeleton builder programme — tokens DA (évite flash blanc hors thème). */
export default function ProgramEditorLoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--page-bg)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-6xl items-center gap-2 px-3 md:px-4">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-[var(--radius-sm)] bg-[var(--accent)]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-40 max-w-[50%] animate-pulse rounded-full bg-[var(--accent)]" />
            <div className="h-2.5 w-56 max-w-[70%] animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
          <div className="flex shrink-0 gap-1.5">
            <div className="h-7 w-14 animate-pulse rounded-full bg-[var(--accent)]" />
            <div className="h-7 w-16 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-2 px-4 py-3 md:px-6">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-da-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-6 w-6 animate-pulse rounded-[var(--radius-sm)] bg-[var(--accent)]" />
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
              <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
              <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
              <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
              <div className="h-7 w-16 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
            </div>
            <div className="h-7 w-36 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
        </section>

        <section className="min-h-[480px] flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-da-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--accent)]" />
            <div className="h-5 w-36 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
          <div className="grid min-h-[440px] gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                className="flex min-h-[140px] flex-col gap-1.5 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--page-bg)] p-2"
              >
                <div className="h-3 w-8 animate-pulse rounded-full bg-[var(--accent)]" />
                <div className="mt-1 h-16 animate-pulse rounded-[var(--radius-sm)] bg-[var(--accent)]" />
                {i < 3 ? (
                  <div className="h-12 animate-pulse rounded-[var(--radius-sm)] bg-[var(--accent)]" />
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
