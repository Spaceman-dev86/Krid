import type { BilanSchema } from '@/src/lib/bilans/bilans'

/** Détail de ce qui a été demandé (pas les réponses). */
export function BilanRequestedSchema({ schema }: { schema: BilanSchema }) {
  const empty =
    !schema.photos && !schema.measurements.length && !schema.questions.length

  if (empty) {
    return <p className="text-sm text-[color:var(--muted)]">Aucun contenu demandé.</p>
  }

  return (
    <div className="grid gap-3">
      {schema.measurements.length ? (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Mensurations
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {schema.measurements.map((m) => (
              <li
                key={m.id}
                className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--fg)]"
              >
                {m.label}
                {m.unit ? ` (${m.unit})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {schema.questions.length ? (
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
            Questions
          </p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-sm text-[color:var(--fg)]">
            {schema.questions.map((q) => (
              <li key={q.id}>{q.label}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {schema.photos ? (
        <p className="text-sm font-semibold text-[color:var(--fg)]">Photos demandées</p>
      ) : null}
    </div>
  )
}
