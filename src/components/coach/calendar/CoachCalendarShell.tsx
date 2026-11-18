'use client'

import { useMemo, useRef, useState } from 'react'

import { Button, EphemeralFlash, type FlashItem } from '@/src/components/ui'
import { isActionableRequest, type CalendarEventRow } from '@/src/lib/calendar/rdv'
import { CoachCalendarBoard } from './CoachCalendarBoard'
import { CoachRdvDayModal } from './CoachRdvDayModal'
import { CoachRdvProposeModal } from './CoachRdvProposeModal'
import { CoachRdvQueueModal } from './CoachRdvQueueModal'
import {
  eventsByDay,
  type ClientOpt,
  type CoachCalEvent,
  type GroupOpt,
  type PrestaOpt,
} from './calendarUi'

type Flash = {
  error?: string | null
  /** Succès proposition RDV (`?rdv=1`) */
  rdvCreated?: boolean
  accepted?: boolean
  refused?: boolean
  loadError?: string | null
}

type Props = {
  events: CoachCalEvent[]
  clients: ClientOpt[]
  groups: GroupOpt[]
  prestations?: PrestaOpt[]
  flash?: Flash
  openQueueOnMount?: boolean
  nameMap?: Map<string, string>
}

function buildFlashItems(flash?: Flash): FlashItem[] {
  if (!flash) return []
  const items: FlashItem[] = []
  if (flash.error || flash.loadError) {
    items.push({
      id: 'error',
      tone: 'danger',
      message: flash.error || flash.loadError,
    })
  }
  if (flash.rdvCreated) {
    items.push({
      id: 'rdv',
      tone: 'success',
      message: 'RDV proposé — en attente du client.',
    })
  }
  if (flash.accepted) {
    items.push({
      id: 'accepted',
      tone: 'success',
      message: 'RDV accepté — visible côté client.',
    })
  }
  if (flash.refused) {
    items.push({
      id: 'refused',
      tone: 'warning',
      message: 'Demande refusée (contour rouge sur le calendrier).',
    })
  }
  return items
}

export function CoachCalendarShell({
  events,
  clients,
  groups,
  prestations = [],
  flash,
  openQueueOnMount = false,
  nameMap,
}: Props) {
  const byDay = useMemo(() => eventsByDay(events), [events])
  const requests = useMemo(() => events.filter((e) => isActionableRequest(e)), [events])
  const flashItems = useMemo(() => buildFlashItems(flash), [flash])
  const dismissFlash = useRef<(() => void) | null>(null)

  const [dayIso, setDayIso] = useState<string | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [proposeDate, setProposeDate] = useState<string | undefined>()
  const [queueOpen, setQueueOpen] = useState(openQueueOnMount)

  const dayEvents = dayIso ? byDay[dayIso] ?? [] : []

  function bump() {
    dismissFlash.current?.()
  }

  function openDay(iso: string) {
    bump()
    setDayIso(iso)
    setProposeOpen(false)
  }

  function openProposeFromDay() {
    bump()
    setProposeDate(dayIso ?? undefined)
    setProposeOpen(true)
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-5xl gap-4 pb-4 sm:gap-5 sm:pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Planning
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--fg)] sm:text-3xl md:text-4xl">
            Calendrier
          </h1>
        </div>
        <Button
          type="button"
          variant={requests.length ? undefined : 'secondary'}
          size="sm"
          className={`!rounded-[var(--radius-pill)] ${requests.length ? 'shadow-da-brand' : 'shadow-da-sm'}`}
          onClick={() => {
            bump()
            setQueueOpen(true)
          }}
        >
          À traiter{requests.length ? ` (${requests.length})` : ''}
        </Button>
      </div>

      <EphemeralFlash items={flashItems} onDismissRef={dismissFlash} />

      <CoachCalendarBoard events={events} onDayClick={openDay} />

      <CoachRdvDayModal
        open={Boolean(dayIso) && !proposeOpen}
        dateIso={dayIso ?? ''}
        events={dayEvents}
        onClose={() => {
          bump()
          setDayIso(null)
        }}
        onPropose={openProposeFromDay}
      />

      <CoachRdvProposeModal
        key={`propose-${proposeDate ?? 'x'}-${proposeOpen}`}
        open={proposeOpen}
        onClose={() => {
          bump()
          setProposeOpen(false)
        }}
        clients={clients}
        groups={groups}
        prestations={prestations}
        events={events as CalendarEventRow[]}
        defaultDate={proposeDate}
        returnTo="/calendar"
        nameMap={nameMap}
      />

      <CoachRdvQueueModal
        open={queueOpen}
        events={requests}
        onClose={() => {
          bump()
          setQueueOpen(false)
        }}
      />
    </div>
  )
}
