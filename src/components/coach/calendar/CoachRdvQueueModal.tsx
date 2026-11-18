'use client'

import { Button } from '@/src/components/ui'
import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
} from '@/src/lib/calendar/rdv'
import { respondCoachRdvAction } from '@/src/app/calendar/actions'
import type { CoachCalEvent } from './calendarUi'

type Props = {
  open: boolean
  events: CoachCalEvent[]
  onClose: () => void
}

export function CoachRdvQueueModal({ open, events, onClose }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-[1] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-[color:var(--fg)]">
            À traiter ({events.length})
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            Fermer
          </button>
        </div>

        {!events.length ? (
          <p className="text-sm text-[color:var(--muted)]">Aucune demande en attente.</p>
        ) : (
          <ul className="grid gap-2">
            {events.map((ev) => {
              const mins = durationMinutes(ev.starts_at, ev.ends_at)
              return (
                <li
                  key={ev.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3"
                >
                  <p className="text-sm font-extrabold text-[color:var(--fg)]">{ev.title}</p>
                  <p className="text-xs text-[color:var(--muted)]">{ev.clientName}</p>
                  <p className="mt-1 text-xs font-semibold text-[color:var(--fg)]">
                    {[
                      formatRdvWhen(ev.starts_at),
                      formatRdvDuration(mins),
                      ev.modality ? RDV_MODALITY_LABELS[ev.modality] : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide text-[color:var(--warning)]">
                    {RDV_STATUS_LABELS.requested}
                  </span>
                  <div className="mt-2 flex gap-2">
                    <form action={respondCoachRdvAction} className="flex-1">
                      <input type="hidden" name="event_id" value={ev.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <Button type="submit" size="sm" className="w-full !rounded-[var(--radius-sm)]">
                        Accepter
                      </Button>
                    </form>
                    <form action={respondCoachRdvAction} className="flex-1">
                      <input type="hidden" name="event_id" value={ev.id} />
                      <input type="hidden" name="decision" value="refused" />
                      <Button type="submit" variant="secondary" size="sm" className="w-full !rounded-[var(--radius-sm)]">
                        Refuser
                      </Button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
