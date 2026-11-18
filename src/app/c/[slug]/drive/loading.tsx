/** Transition portail Drive — shell client reste monté. */
export default function ClientDriveLoading() {
  return (
    <div className="grid animate-pulse gap-5" aria-hidden>
      <div>
        <div className="h-8 w-24 rounded-md bg-black/10" />
        <div className="mt-2 h-4 w-56 rounded bg-black/5" />
      </div>
      <div className="grid gap-2">
        <div className="h-14 rounded-2xl bg-black/5" />
        <div className="h-14 rounded-2xl bg-black/5" />
        <div className="h-14 rounded-2xl bg-black/5" />
      </div>
    </div>
  )
}
