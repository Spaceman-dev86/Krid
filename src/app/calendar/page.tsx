import { redirect } from 'next/navigation'

import { Button, PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import {
  CoachWeekCalendar,
  type CoachCalendarEvent,
} from '../../components/coach/CoachWeekCalendar'
import { canAccessCoachApp } from '../../lib/auth/roles'
import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  listCoachEvents,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
  type CalendarEventRow,
} from '../../lib/calendar/rdv'
import { clientDisplayName } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { startOfWeekMonday, toIsoDate } from '../../lib/client-portal/weekCalendar'
import { createClient } from '../../lib/supabase/server'
import {
  cancelCoachRdvAction,
  createCoachRdvAction,
  respondCoachRdvAction,
} from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        created?: string
        accepted?: string
        refused?: string
        week?: string
      }>
    | {
        error?: string
        created?: string
        accepted?: string
        refused?: string
        week?: string
      }
}

function RequestCard({ ev, clientName }: { ev: CalendarEventRow; clientName: string }) {
  const mins = durationMinutes(ev.starts_at, ev.ends_at)
  return (
    <li className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-da-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-extrabold text-[color:var(--brand)]">{ev.title}</p>
          <p className="text-sm text-[color:var(--muted)]">{clientName}</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--fg)]">
            {[
              formatRdvWhen(ev.starts_at),
              formatRdvDuration(mins),
              ev.modality ? RDV_MODALITY_LABELS[ev.modality] : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {ev.client_message ? (
            <p className="mt-2 rounded-lg bg-[var(--surface)]/80 px-3 py-2 text-xs text-[color:var(--muted)]">
              {ev.client_message}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-900">
          {RDV_STATUS_LABELS.requested}
        </span>
      </div>
      <div className="mt-3 flex gap-2 border-t border-amber-100 pt-3">
        <form action={respondCoachRdvAction} className="flex-1">
          <input type="hidden" name="event_id" value={ev.id} />
          <input type="hidden" name="decision" value="accepted" />
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-bold text-white"
          >
            Accepter
          </button>
        </form>
        <form action={respondCoachRdvAction} className="flex-1">
          <input type="hidden" name="event_id" value={ev.id} />
          <input type="hidden" name="decision" value="refused" />
          <button
            type="submit"
            className="w-full rounded-xl border border-red-300 bg-[var(--surface)] px-3 py-2.5 text-sm font-bold text-red-800"
          >
            Refuser
          </button>
        </form>
      </div>
    </li>
  )
}

export default async function CoachCalendarPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let events: CalendarEventRow[] = []
  let loadError: string | null = null
  try {
    events = await listCoachEvents(supabase, user.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur chargement'
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })
    .limit(100)

  const names = new Map<string, string>()
  for (const c of clients ?? []) {
    names.set(
      c.id,
      clientDisplayName({
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
      })
    )
  }

  const withNames: CoachCalendarEvent[] = events.map((ev) => ({
    ...ev,
    clientName: names.get(ev.client_id) ?? 'Client',
  }))

  const requests = events.filter((e) => e.status === 'requested')
  const pendingClient = events.filter((e) => e.status === 'pending')
  const refused = events.filter((e) => e.status === 'refused')

  const weekStartIso = q.week?.trim() || toIsoDate(startOfWeekMonday(new Date()))
  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Calendrier" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-6">
        <div>
          <PageTitle className="text-2xl">Calendrier RDV</PageTitle>
          <Muted className="mt-1">Demandes clients à accepter · vue semaine · refus en contour rouge</Muted>
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}
        {q.created ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            RDV proposé — en attente du client.
          </div>
        ) : null}
        {q.accepted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            RDV accepté — visible sur Accueil client.
          </div>
        ) : null}
        {q.refused ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Demande refusée (contour rouge sur la semaine).
          </div>
        ) : null}

        <CoachWeekCalendar events={withNames} initialWeekStartIso={weekStartIso} />

        {requests.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
              À traiter ({requests.length})
            </h2>
            <ul className="grid gap-3">
              {requests.map((ev) => (
                <RequestCard
                  key={ev.id}
                  ev={ev}
                  clientName={names.get(ev.client_id) ?? 'Client'}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
          <h2 className="text-sm font-extrabold text-[color:var(--brand)]">Proposer un RDV</h2>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Créneau envoyé au client — il accepte ou refuse.
          </p>
          <form action={createCoachRdvAction} className="mt-3 grid gap-3">
            <select
              name="client_id"
              required
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Choisir un client…
              </option>
              {(clients ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {clientDisplayName({
                    first_name: c.first_name,
                    last_name: c.last_name,
                    email: c.email,
                  })}
                </option>
              ))}
            </select>
            <input
              name="title"
              placeholder="Titre (ex. Bilan)"
              defaultValue="RDV"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input
                name="date"
                type="date"
                required
                min={todayIso}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <input
                name="time"
                type="time"
                defaultValue="10:00"
                required
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <select
                name="duration_min"
                defaultValue="60"
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
              </select>
              <select
                name="modality"
                required
                defaultValue=""
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Modalité…
                </option>
                <option value="physique">Physique</option>
                <option value="visio">Visio</option>
              </select>
            </div>
            <input
              name="location"
              placeholder="Lieu ou lien visio"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <textarea
              name="notes"
              rows={2}
              placeholder="Notes coach (optionnel)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <Button type="submit" className="!rounded-lg !px-4 !py-2 text-sm font-bold justify-self-start">Envoyer au client</Button>
          </form>
        </section>

        {pendingClient.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-sky-800">
              En attente client ({pendingClient.length})
            </h2>
            <ul className="grid gap-2">
              {pendingClient.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[color:var(--brand)]">{ev.title}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      {names.get(ev.client_id) ?? 'Client'} · {formatRdvWhen(ev.starts_at)}
                    </p>
                  </div>
                  <form action={cancelCoachRdvAction}>
                    <input type="hidden" name="event_id" value={ev.id} />
                    <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
                      Annuler
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {refused.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-red-800">
              Refusés ({refused.length})
            </h2>
            <ul className="grid gap-2">
              {refused.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-xl border border-red-300 bg-red-50/50 px-4 py-3 text-sm ring-1 ring-red-100"
                >
                  <p className="font-semibold text-[color:var(--brand)]">{ev.title}</p>
                  <p className="text-xs text-[color:var(--muted)]">
                    {names.get(ev.client_id) ?? 'Client'} · {formatRdvWhen(ev.starts_at)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </CoachAppShell>
  )
}
