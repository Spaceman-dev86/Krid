import type { ShowroomWeekPreview } from '@/src/lib/prestations/loadShowroomWeekPreview'

type Props = {
  week: ShowroomWeekPreview
  brandColor: string
  /** Compact (fiche téléphone). */
  compact?: boolean
}

/** Aperçu semaine — uniquement les jours avec séances, empilés. */
export function ShowroomWeekPreviewBlock({ week, brandColor, compact = false }: Props) {
  const activeDays = week.days.filter((d) => d.sessions.length > 0)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p
          className={`font-extrabold uppercase tracking-wide ${compact ? 'text-[9px]' : 'text-xs'}`}
          style={{ color: brandColor }}
        >
          Aperçu d’une semaine
        </p>
        <p
          className={`font-semibold text-[color:var(--muted)] ${
            compact ? 'text-[9px]' : 'text-[11px]'
          }`}
        >
          {week.title}
          {activeDays.length
            ? ` · ${activeDays.length} jour${activeDays.length > 1 ? 's' : ''}`
            : ''}
        </p>
      </div>

      {activeDays.length ? (
        <ul className={`mt-2 grid ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {activeDays.map((day) => (
            <li
              key={day.dayIndex}
              className={`rounded-xl ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
              style={{
                background: `${brandColor}14`,
                boxShadow: `inset 0 0 0 1px ${brandColor}33`,
              }}
            >
              <p
                className={`font-extrabold uppercase tracking-wide ${compact ? 'text-[9px]' : 'text-[10px]'}`}
                style={{ color: brandColor }}
              >
                {day.label}
              </p>
              <ul className={compact ? 'mt-0.5 space-y-0.5' : 'mt-1 space-y-0.5'}>
                {day.sessions.map((s) => (
                  <li
                    key={s.id}
                    className={`font-semibold leading-snug text-[color:var(--fg)] ${
                      compact ? 'text-[10px]' : 'text-[11px]'
                    }`}
                  >
                    {s.title}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={`mt-2 text-[color:var(--muted)] ${
            compact ? 'text-[10px]' : 'text-[11px]'
          }`}
        >
          Aucune séance sur cette semaine.
        </p>
      )}

      <p
        className={`mt-2 text-[color:var(--muted)] ${compact ? 'text-[9px]' : 'text-[11px]'}`}
      >
        Exemple — le programme complet s’ouvre après accès.
      </p>
    </div>
  )
}
