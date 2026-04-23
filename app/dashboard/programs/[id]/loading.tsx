export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="h-8 w-56 rounded-full bg-black/10" />
        <div className="h-10 w-10 rounded-full bg-black/10" />
      </div>

      <div className="mt-6 grid gap-4">
        <div className="h-40 rounded-2xl bg-black/10" />
        <div className="h-40 rounded-2xl bg-black/10" />
        <div className="h-40 rounded-2xl bg-black/10" />
      </div>
    </main>
  )
}
