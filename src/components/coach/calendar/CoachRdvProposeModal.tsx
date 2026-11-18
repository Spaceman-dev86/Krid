'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconCalendar, IconClock, daFieldClass, daSelectClass } from '@/src/components/ui'
import {
  findCoachConflicts,
  formatRdvWhen,
  parseLocalDateTime,
  type CalendarEventRow,
} from '@/src/lib/calendar/rdv'
import {
  createCoachRdvAction,
  type CreateCoachRdvResult,
} from '@/src/app/calendar/actions'
import { toIsoDate } from '@/src/lib/client-portal/weekCalendar'
import type { ClientOpt, GroupOpt, PrestaOpt } from './calendarUi'

type Props = {
  open: boolean
  onClose: () => void
  clients: ClientOpt[]
  groups: GroupOpt[]
  prestations?: PrestaOpt[]
  events: CalendarEventRow[]
  /** Date préremplie YYYY-MM-DD */
  defaultDate?: string
  /** Préselection client:xxx | group:xxx | presta:xxx */
  defaultAudience?: string
  returnTo?: string
  nameMap?: Map<string, string>
}

function ProposeSubmitButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      size="sm"
      className="inline-flex items-center gap-2 justify-self-start !rounded-[var(--radius-sm)]"
      disabled={blocked || pending}
    >
      {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
      {pending ? 'Envoi…' : 'Envoyer au destinataire'}
    </Button>
  )
}

export function CoachRdvProposeModal({
  open,
  onClose,
  clients,
  groups,
  prestations = [],
  events,
  defaultDate,
  defaultAudience = '',
  returnTo = '/calendar',
  nameMap,
}: Props) {
  const todayIso = toIsoDate(new Date())
  const [date, setDate] = useState(defaultDate || todayIso)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState('60')
  const [confirmConflict, setConfirmConflict] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)

  const [state, formAction] = useActionState<CreateCoachRdvResult | null, FormData>(
    createCoachRdvAction,
    null,
  )

  useEffect(() => {
    if (!state || state.ok) return
    if (state.reason === 'conflict') {
      setConfirmConflict(false)
      setFormError(null)
      return
    }
    setFormError(state.message)
  }, [state])

  function openPicker(el: HTMLInputElement | null) {
    if (!el) return
    try {
      el.showPicker?.()
    } catch {
      el.focus()
      el.click()
    }
  }

  const conflicts = useMemo(() => {
    const starts = parseLocalDateTime(date, time)
    if (!starts) return []
    const ends = new Date(starts)
    ends.setMinutes(ends.getMinutes() + (Number(duration) || 60))
    return findCoachConflicts(events, starts, ends.toISOString())
  }, [date, time, duration, events])

  const showConflict =
    conflicts.length > 0 || (state?.ok === false && state.reason === 'conflict')
  const blocked = showConflict && !confirmConflict

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-[1] max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-extrabold text-[color:var(--fg)]">Proposer un RDV</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            Fermer
          </button>
        </div>

        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="return_to" value={returnTo} />
          {confirmConflict ? <input type="hidden" name="confirm_conflict" value="1" /> : null}

          {returnTo !== '/calendar' ? (
            <div className="flex justify-end">
              <a
                href="/calendar"
                className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)] hover:text-[color:var(--brand)]"
              >
                Voir le calendrier →
              </a>
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--danger)]">
              {formError}
            </div>
          ) : null}

          <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Destinataire
            <select name="audience" required className={daSelectClass} defaultValue={defaultAudience}>
              <option value="" disabled>
                Client, groupe ou presta…
              </option>
              {clients.length ? (
                <optgroup label="Clients">
                  {clients.map((c) => (
                    <option key={c.id} value={`client:${c.id}`}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {groups.length ? (
                <optgroup label="Groupes">
                  {groups.map((g) => (
                    <option key={g.id} value={`group:${g.id}`}>
                      {g.label} ({g.memberIds.length})
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {prestations.length ? (
                <optgroup label="Prestations">
                  {prestations.map((p) => (
                    <option key={p.id} value={`presta:${p.id}`}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>

          <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Titre
            <input name="title" defaultValue="RDV" className={daFieldClass} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
              Date
              <span className="relative block">
                <input
                  ref={dateRef}
                  name="date"
                  type="date"
                  required
                  min={todayIso}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setConfirmConflict(false)
                    setFormError(null)
                  }}
                  className={`${daFieldClass} da-datetime-field w-full pr-10`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Choisir la date"
                  onClick={() => openPicker(dateRef.current)}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--fg)] hover:bg-[var(--accent)]"
                >
                  <IconCalendar size={16} />
                </button>
              </span>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
              Heure
              <span className="relative block">
                <input
                  ref={timeRef}
                  name="time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => {
                    setTime(e.target.value)
                    setConfirmConflict(false)
                    setFormError(null)
                  }}
                  className={`${daFieldClass} da-datetime-field w-full pr-10`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Choisir l’heure"
                  onClick={() => openPicker(timeRef.current)}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-[color:var(--fg)] hover:bg-[var(--accent)]"
                >
                  <IconClock size={16} />
                </button>
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
              Durée
              <select
                name="duration_min"
                value={duration}
                onChange={(e) => {
                  setDuration(e.target.value)
                  setConfirmConflict(false)
                  setFormError(null)
                }}
                className={daSelectClass}
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
              Modalité
              <select name="modality" required defaultValue="" className={daSelectClass}>
                <option value="" disabled>
                  Modalité…
                </option>
                <option value="physique">Physique</option>
                <option value="visio">Visio</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Lieu / lien
            <input name="location" placeholder="Lieu ou lien visio" className={daFieldClass} />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Notes
            <textarea name="notes" rows={2} className={daFieldClass} placeholder="Optionnel" />
          </label>

          {showConflict ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--warning-border)] bg-[var(--warning-bg)] p-3 text-xs text-[color:var(--fg)]">
              <p className="font-bold text-[color:var(--warning)]">Conflit d’horaire</p>
              {conflicts.length ? (
                <ul className="mt-1 list-inside list-disc text-[color:var(--muted)]">
                  {conflicts.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      {c.title} · {nameMap?.get(c.client_id) ?? 'Client'} · {formatRdvWhen(c.starts_at)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[color:var(--muted)]">
                  Ce créneau chevauche déjà un RDV. Confirme pour envoyer quand même.
                </p>
              )}
              {!confirmConflict ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="mt-2 !rounded-[var(--radius-sm)]"
                  onClick={() => setConfirmConflict(true)}
                >
                  Proposer quand même
                </Button>
              ) : (
                <p className="mt-2 font-semibold text-[color:var(--warning)]">Confirmé — tu peux envoyer.</p>
              )}
            </div>
          ) : null}

          <ProposeSubmitButton blocked={blocked} />
        </form>
      </div>
    </div>
  )
}
