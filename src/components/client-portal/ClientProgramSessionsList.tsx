import Link from 'next/link'

import type { PreviewSessionRow, PreviewWeekRow } from '../../lib/fetchProgramPreviewStructure'

type Props = {
  slug: string
  primaryColor: string
  weeks: PreviewWeekRow[]
  sessions: PreviewSessionRow[]
  planStarted: boolean
}

export function ClientProgramSessionsList({ slug, primaryColor, weeks, sessions, planStarted }: Props) {
  const sortedWeeks = weeks.slice().sort((a, b) => (a.week_order ?? 0) - (b.week_order ?? 0))

  if (!sessions.length) {
    return <p className="mt-3 text-sm text-black/45">Ce programme n’a pas encore de séances.</p>
  }

  return (
    <div className="mt-3 grid gap-4">
      {sortedWeeks.map((week) => {
        const weekSessions = sessions
          .filter((s) => s.week_id === week.id)
          .sort((a, b) => (a.session_order ?? 0) - (b.session_order ?? 0))

        if (!weekSessions.length) return null

        return (
          <div key={week.id}>
            <p className="text-xs font-extrabold uppercase tracking-wide text-black/40">
              {week.title?.trim() || `Semaine ${(week.week_order ?? 0) + 1}`}
            </p>
            <ul className="mt-2 divide-y divide-black/5 rounded-xl border border-black/10 bg-white">
              {weekSessions.map((session) => {
                const title = session.title?.trim() || `Séance ${(session.session_order ?? 0) + 1}`
                const href = `/c/${slug}/programme/seance/${session.id}`

                if (!planStarted) {
                  return (
                    <li key={session.id} className="px-3 py-3">
                      <p className="font-semibold text-[#1a1220]">{title}</p>
                      <p className="text-xs text-black/40">Démarre le plan pour ouvrir les séances.</p>
                    </li>
                  )
                }

                return (
                  <li key={session.id}>
                    <Link
                      href={href}
                      className="flex items-center justify-between gap-3 px-3 py-3 text-sm transition hover:bg-black/[0.02]"
                    >
                      <span className="font-semibold text-[#1a1220]">{title}</span>
                      <span className="text-xs font-bold" style={{ color: primaryColor }}>Voir →</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
