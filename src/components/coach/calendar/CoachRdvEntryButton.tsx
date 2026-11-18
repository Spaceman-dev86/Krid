'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/src/components/ui'
import { loadCoachCalendarEventsAction } from '@/src/app/calendar/actions'
import type { CalendarEventRow } from '@/src/lib/calendar/rdv'
import { CoachRdvProposeModal } from './CoachRdvProposeModal'
import type { ClientOpt, GroupOpt, PrestaOpt } from './calendarUi'

type Props = {
  clients: ClientOpt[]
  groups?: GroupOpt[]
  prestations?: PrestaOpt[]
  /** Si omis / vide → chargés à l’ouverture (plus rapide pour /chat). */
  events?: CalendarEventRow[]
  defaultAudience?: string
  returnTo: string
  label?: string
  size?: 'sm' | 'md'
  variant?: 'secondary' | 'link' | 'mist' | 'cta'
  nameMap?: Map<string, string>
}

/** Bouton + même pop-up RDV (fiche client / chat). */
export function CoachRdvEntryButton({
  clients,
  groups = [],
  prestations = [],
  events: eventsProp,
  defaultAudience = '',
  returnTo,
  label = 'Ajouter un RDV',
  size = 'sm',
  variant = 'secondary',
  nameMap,
}: Props) {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<CalendarEventRow[]>(eventsProp ?? [])

  useEffect(() => {
    if (eventsProp?.length) setEvents(eventsProp)
  }, [eventsProp])

  useEffect(() => {
    if (!open) return
    if (eventsProp && eventsProp.length > 0) return
    let cancelled = false
    void loadCoachCalendarEventsAction().then((rows) => {
      if (!cancelled) setEvents(rows)
    })
    return () => {
      cancelled = true
    }
  }, [open, eventsProp])

  return (
    <span className="inline-flex">
      <Button
        type="button"
        size={size}
        variant={variant}
        className="!rounded-[var(--radius-sm)]"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <CoachRdvProposeModal
        key={`entry-${defaultAudience}-${open}`}
        open={open}
        onClose={() => setOpen(false)}
        clients={clients}
        groups={groups}
        prestations={prestations}
        events={events}
        defaultAudience={defaultAudience}
        returnTo={returnTo}
        nameMap={nameMap}
      />
    </span>
  )
}
