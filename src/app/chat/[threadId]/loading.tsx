export default function CoachChatThreadLoading() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] px-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]" />
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--accent)]" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <div className="ml-auto h-10 w-[55%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="h-10 w-[45%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="ml-auto h-14 w-[60%] animate-pulse rounded-2xl bg-[var(--accent)]" />
      </div>
    </div>
  )
}
