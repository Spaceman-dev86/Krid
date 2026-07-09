export default function ProgramEditorLoadingSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1800px] px-4 pb-12 md:px-8">
      <header className="sticky top-16 z-30 -mx-4 border-b border-gray-200 bg-white/95 px-4 py-3 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
          <div className="min-w-0 flex-1">
            <div className="h-3 w-28 animate-pulse rounded-full bg-black/10" />
            <div className="mt-2 h-8 w-64 max-w-full animate-pulse rounded-xl bg-black/10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-28 animate-pulse rounded-xl bg-black/10" />
            <div className="h-10 w-10 animate-pulse rounded-xl bg-black/10" />
          </div>
        </div>
      </header>

      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div className="h-16 animate-pulse rounded-xl bg-black/10 md:col-span-1" />
          <div className="h-9 animate-pulse rounded-xl bg-black/10" />
          <div className="h-9 animate-pulse rounded-xl bg-black/10" />
          <div className="h-9 animate-pulse rounded-xl bg-black/10" />
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(360px,2fr)_minmax(320px,1fr)]">
        <div className="hidden space-y-3 lg:block">
          <div className="h-24 animate-pulse rounded-2xl bg-black/10" />
          <div className="h-24 animate-pulse rounded-2xl bg-black/10" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded-full bg-black/10" />
          <div className="h-28 animate-pulse rounded-2xl bg-black/10" />
          <div className="h-20 animate-pulse rounded-2xl bg-black/10" />
          <div className="h-20 animate-pulse rounded-2xl bg-black/10" />
        </div>

        <div className="hidden space-y-3 lg:block">
          <div className="h-12 animate-pulse rounded-2xl bg-black/10" />
          <div className="h-48 animate-pulse rounded-2xl bg-black/10" />
          <div className="h-32 animate-pulse rounded-2xl bg-black/10" />
        </div>
      </section>
    </main>
  )
}
