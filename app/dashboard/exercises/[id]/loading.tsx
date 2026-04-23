export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-3 w-20 rounded-full bg-black/10" />
          <div className="mt-2 h-6 w-56 rounded-full bg-black/10" />
        </div>
        <div className="h-10 w-10 rounded-full bg-black/10" />
      </div>

      <div className="mt-4 grid gap-4">
        <div className="h-80 w-full rounded-2xl bg-black/10" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 rounded-2xl bg-black/10" />
          <div className="h-16 rounded-2xl bg-black/10" />
        </div>
        <div className="h-12 rounded-2xl bg-black/10" />
        <div className="h-24 rounded-2xl bg-black/10" />
        <div className="h-28 rounded-2xl bg-black/10" />
      </div>
    </main>
  )
}
