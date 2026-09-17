import {
  formatSetLine,
  type SessionRunRealized,
  type SessionRunSnapshot,
  type SnapshotItem,
} from '../../lib/client-portal/sessionRuns'

function statusLabel(status: string) {
  if (status === 'fait') return 'Fait'
  if (status === 'partiel') return 'Partiel'
  if (status === 'non_fait') return 'Non fait'
  return 'À faire'
}

function statusClass(status: string) {
  if (status === 'fait') return 'bg-emerald-50 text-emerald-800 ring-emerald-100'
  if (status === 'partiel') return 'bg-sky-50 text-sky-900 ring-sky-100'
  if (status === 'non_fait') return 'bg-amber-50 text-amber-900 ring-amber-100'
  return 'bg-black/5 text-black/50 ring-black/10'
}

function ItemCard({
  item,
  realized,
}: {
  item: SnapshotItem
  realized: SessionRunRealized | null
}) {
  const entry = realized?.items?.[item.id]
  const status = entry?.status ?? 'pending'

  if (item.kind === 'exercise') {
    const sets = entry?.sets ?? []
    return (
      <li className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-[#1a1220]">{item.name}</p>
            <p className="mt-0.5 text-xs text-black/45">
              {[
                item.sets != null && item.sets !== '' ? `${item.sets} séries` : null,
                item.reps != null && item.reps !== '' ? `${item.reps} reps` : null,
                item.load,
              ]
                .filter(Boolean)
                .join(' · ') || 'Exercice'}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(status)}`}
          >
            {statusLabel(status)}
          </span>
        </div>
        {sets.length > 0 ? (
          <ul className="mt-2 space-y-1 border-t border-black/5 pt-2">
            {sets.map((set, idx) => (
              <li key={idx} className="flex justify-between gap-2 text-xs text-black/60">
                <span>
                  Série {idx + 1}
                  {set.done && formatSetLine(set) ? ` · ${formatSetLine(set)}` : ''}
                  {set.note ? ` · ${set.note}` : ''}
                </span>
                <span className={set.done ? 'font-bold text-emerald-700' : 'text-black/35'}>
                  {set.done ? 'OK' : '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {entry?.note ? <p className="mt-2 text-xs text-black/55">Note : {entry.note}</p> : null}
      </li>
    )
  }

  return (
    <li className="rounded-xl border border-black/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[#1a1220]">{item.title}</p>
          <p className="mt-0.5 text-xs text-black/45">
            Bloc{item.type ? ` · ${item.type}` : ''} · {item.exercises.length} exo
            {item.exercises.length > 1 ? 's' : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(status)}`}
        >
          {statusLabel(status)}
        </span>
      </div>
      {item.exercises.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-black/5 pt-2">
          {item.exercises.map((ex) => {
            const st = entry?.blockExercises?.[ex.id]?.status ?? 'pending'
            return (
              <li key={ex.id} className="flex justify-between gap-2 text-xs text-black/60">
                <span className="font-semibold text-[#1a1220]">{ex.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusClass(st)}`}
                >
                  {statusLabel(st)}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

export function ClientRunHistoryDetail({
  snapshot,
  realized,
}: {
  snapshot: SessionRunSnapshot | null
  realized: SessionRunRealized | null
}) {
  if (!snapshot?.items?.length) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 bg-white/70 p-4 text-sm text-black/50">
        Pas de snapshot pour cette séance (run ancienne ou vide).
      </p>
    )
  }

  return (
    <ul className="grid gap-3">
      {snapshot.items.map((item) => (
        <ItemCard key={item.id} item={item} realized={realized} />
      ))}
    </ul>
  )
}
