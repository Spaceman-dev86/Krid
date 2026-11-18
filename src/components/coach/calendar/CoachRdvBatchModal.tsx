'use client'

import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button } from '@/src/components/ui'
import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
} from '@/src/lib/calendar/rdv'
import { cancelCoachRdvAction, nudgeBatchPendingAction } from '@/src/app/calendar/actions'
import {
  batchAcceptRateLabel,
  batchCounts,
  type CoachCalEvent,
} from './calendarUi'

type Props = {
  open: boolean
  events: CoachCalEvent[]
  groupLabel: string
  onClose: () => void
  returnTo?: string
}

function NudgeSubmitButton({
  label,
  variant = 'secondary',
  fullWidth,
}: {
  label: string
  variant?: 'secondary' | 'default'
  fullWidth?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="sm"
      variant={variant === 'default' ? undefined : 'secondary'}
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 !rounded-[var(--radius-sm)] ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {pending ? (
        <FluidSpinner
          size={12}
          className={variant === 'default' ? 'text-[var(--brand-fg)]' : 'text-[color:var(--fg)]'}
        />
      ) : null}
      {pending ? (label.includes('auto') ? 'Envoi…' : 'Ouverture…') : label}
    </Button>
  )
}

export function CoachRdvBatchModal({
  open,
  events,
  groupLabel,
  onClose,
  returnTo = '/calendar',
}: Props) {
  if (!open || !events.length) return null

  const lead = events[0]
  const batchId = lead.batch_id
  const mins = durationMinutes(lead.starts_at, lead.ends_at)
  const counts = batchCounts(events)
  const pendingMembers = events.filter((e) => e.status === 'pending')

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-[1] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-[color:var(--fg)]">{lead.title}</p>
            <p className="text-xs text-[color:var(--muted)]">{groupLabel}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--fg)]">
              {[
                formatRdvWhen(lead.starts_at),
                formatRdvDuration(mins),
                lead.modality ? RDV_MODALITY_LABELS[lead.modality] : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              {batchAcceptRateLabel(events)} · {counts.pending} attente · {counts.refused} refus
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

        <ul className="grid gap-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className={`rounded-[var(--radius-sm)] border p-3 ${
                ev.status === 'refused'
                  ? 'border-[var(--danger-border)] bg-[var(--danger-bg)]'
                  : 'border-[var(--border)] bg-[var(--page-bg)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[color:var(--fg)]">{ev.clientName}</p>
                <span className="shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] ring-1 ring-[var(--border)]">
                  {RDV_STATUS_LABELS[ev.status]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {ev.status === 'pending' && batchId ? (
                  <form action={nudgeBatchPendingAction}>
                    <input type="hidden" name="batch_id" value={batchId} />
                    <input type="hidden" name="client_id" value={ev.client_id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <NudgeSubmitButton label="Relancer" />
                  </form>
                ) : null}
                {ev.status === 'pending' || ev.status === 'accepted' || ev.status === 'refused' ? (
                  <form action={cancelCoachRdvAction}>
                    <input type="hidden" name="event_id" value={ev.id} />
                    <input type="hidden" name="return_to" value={returnTo} />
                    <Button type="submit" variant="link" size="sm" className="!text-[var(--danger)]">
                      {ev.status === 'refused' ? 'Supprimer' : 'Annuler'}
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {pendingMembers.length > 1 && batchId ? (
          <form action={nudgeBatchPendingAction} className="mt-4">
            <input type="hidden" name="batch_id" value={batchId} />
            <input type="hidden" name="return_to" value={returnTo} />
            <NudgeSubmitButton
              label={`Relancer auto les ${pendingMembers.length} en attente`}
              variant="default"
              fullWidth
            />
          </form>
        ) : pendingMembers.length === 1 && batchId ? (
          <form action={nudgeBatchPendingAction} className="mt-4">
            <input type="hidden" name="batch_id" value={batchId} />
            <input type="hidden" name="client_id" value={pendingMembers[0].client_id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <NudgeSubmitButton label="Relancer (chat)" variant="default" fullWidth />
          </form>
        ) : null}
      </div>
    </div>
  )
}
