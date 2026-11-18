'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button } from '@/src/components/ui'
import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  isActionableRequest,
  isRdvPast,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
} from '@/src/lib/calendar/rdv'
import {
  cancelCoachRdvAction,
  nudgePendingRdvAction,
  respondCoachRdvAction,
} from '@/src/app/calendar/actions'
import { CoachRdvBatchModal } from './CoachRdvBatchModal'
import {
  batchAcceptRateLabel,
  batchDotClass,
  formatDayTitle,
  slotsForDay,
  type CoachCalEvent,
  type DaySlot,
} from './calendarUi'

type Props = {
  open: boolean
  dateIso: string
  events: CoachCalEvent[]
  onClose: () => void
  onPropose: () => void
  returnTo?: string
}

function RelanceSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="sm"
      variant="secondary"
      disabled={pending}
      className="inline-flex items-center gap-2 !rounded-[var(--radius-sm)]"
    >
      {pending ? <FluidSpinner size={12} className="text-[color:var(--fg)]" /> : null}
      {pending ? 'Ouverture…' : 'Relancer (chat)'}
    </Button>
  )
}

export function CoachRdvDayModal({
  open,
  dateIso,
  events,
  onClose,
  onPropose,
  returnTo = '/calendar',
}: Props) {
  const slots = useMemo(() => slotsForDay(events), [events])
  const [batchSlot, setBatchSlot] = useState<Extract<DaySlot, { kind: 'batch' }> | null>(null)

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
        <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Fermer" onClick={onClose} />
        <div className="relative z-[1] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold capitalize text-[color:var(--fg)]">{formatDayTitle(dateIso)}</p>
              <p className="text-xs text-[color:var(--muted)]">
                {slots.length} créneau{slots.length > 1 ? 'x' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-2 py-1 text-xs font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
            >
              Fermer
            </button>
          </div>

          {!slots.length ? (
            <p className="text-sm text-[color:var(--muted)]">Aucun RDV ce jour-là.</p>
          ) : (
            <ul className="grid gap-2">
              {slots.map((slot) => {
                if (slot.kind === 'batch') {
                  const lead = slot.events[0]
                  const mins = durationMinutes(lead.starts_at, lead.ends_at)
                  return (
                    <li key={slot.key}>
                      <button
                        type="button"
                        onClick={() => setBatchSlot(slot)}
                        className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] p-3 text-left transition hover:border-[var(--brand)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${batchDotClass(slot.events)}`} />
                              <p className="truncate text-sm font-extrabold text-[color:var(--fg)]">{slot.title}</p>
                            </div>
                            <p className="mt-0.5 text-xs text-[color:var(--muted)]">{slot.groupLabel}</p>
                            <p className="mt-1 text-xs font-semibold text-[color:var(--fg)]">
                              {[
                                formatRdvWhen(lead.starts_at),
                                formatRdvDuration(mins),
                                lead.modality ? RDV_MODALITY_LABELS[lead.modality] : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                            {batchAcceptRateLabel(slot.events)}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-[color:var(--brand)]">Voir les réponses →</p>
                      </button>
                    </li>
                  )
                }

                const ev = slot.event
                const mins = durationMinutes(ev.starts_at, ev.ends_at)
                const refused = ev.status === 'refused'
                const past = isRdvPast(ev)
                const actionable = isActionableRequest(ev)
                return (
                  <li
                    key={slot.key}
                    className={`rounded-[var(--radius-sm)] border p-3 ${
                      refused
                        ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]'
                        : 'border-[var(--border)] bg-[var(--page-bg)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
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
                        {ev.client_message ? (
                          <p className="mt-1 text-xs text-[color:var(--muted)]">{ev.client_message}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                        {past && (ev.status === 'requested' || ev.status === 'pending')
                          ? 'Expiré'
                          : RDV_STATUS_LABELS[ev.status]}
                      </span>
                    </div>

                    {actionable ? (
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
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {ev.status === 'pending' && !past ? (
                        <form action={nudgePendingRdvAction}>
                          <input type="hidden" name="event_id" value={ev.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <RelanceSubmitButton />
                        </form>
                      ) : null}
                      {ev.status === 'accepted' ||
                      ev.status === 'pending' ||
                      ev.status === 'refused' ||
                      (ev.status === 'requested' && past) ? (
                        <form action={cancelCoachRdvAction}>
                          <input type="hidden" name="event_id" value={ev.id} />
                          <input type="hidden" name="return_to" value={returnTo} />
                          <Button type="submit" variant="link" size="sm" className="!text-[var(--danger)]">
                            {ev.status === 'refused' || (ev.status === 'requested' && past)
                              ? 'Supprimer'
                              : 'Annuler'}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <Button type="button" size="sm" className="mt-4 w-full !rounded-[var(--radius-sm)]" onClick={onPropose}>
            Proposer un RDV
          </Button>
        </div>
      </div>

      <CoachRdvBatchModal
        open={Boolean(batchSlot)}
        events={batchSlot?.events ?? []}
        groupLabel={batchSlot?.groupLabel ?? 'Groupe'}
        onClose={() => setBatchSlot(null)}
      />
    </>
  )
}
