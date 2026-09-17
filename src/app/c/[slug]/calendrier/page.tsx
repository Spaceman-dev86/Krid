import Link from 'next/link'

import { ClientPortalShell } from '../../../../components/client-portal/ClientPortalShell'
import {
  durationMinutes,
  formatRdvDuration,
  formatRdvWhen,
  listClientEvents,
  RDV_MODALITY_LABELS,
  RDV_STATUS_LABELS,
  type CalendarEventRow,
} from '../../../../lib/calendar/rdv'
import { requireClientPortal } from '../../../../lib/client-portal/context'
import { createClient } from '../../../../lib/supabase/server'
import { cancelClientRdvAction, requestRdvAction, respondRdvAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{
        error?: string
        requested?: string
        accepted?: string
        refused?: string
        cancelled?: string
      }>
    | {
        error?: string
        requested?: string
        accepted?: string
        refused?: string
        cancelled?: string
      }
}

function RdvMeta({ ev }: { ev: CalendarEventRow }) {
  const mins = durationMinutes(ev.starts_at, ev.ends_at)
  const bits = [
    formatRdvWhen(ev.starts_at),
    formatRdvDuration(mins),
    ev.modality ? RDV_MODALITY_LABELS[ev.modality] : null,
    ev.location,
  ].filter(Boolean)
  return <p className="mt-0.5 text-sm font-semibold text-[#1a1220]">{bits.join(' · ')}</p>
}

function RdvRow({
  ev,
  slug,
  primaryColor,
  mode,
}: {
  ev: CalendarEventRow
  slug: string
  primaryColor: string
  mode?: 'respond' | 'cancel'
}) {
  return (
    <li
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        ev.status === 'refused' ? 'border-red-400 ring-1 ring-red-200' : 'border-black/10'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-extrabold" style={{ color: primaryColor }}>
            {ev.title}
          </p>
          <RdvMeta ev={ev} />
          {ev.client_message ? (
            <p className="mt-2 text-xs text-black/50">{ev.client_message}</p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black/50">
          {RDV_STATUS_LABELS[ev.status]}
        </span>
      </div>

      {mode === 'respond' ? (
        <div className="mt-3 flex gap-2 border-t border-black/5 pt-3">
          <form action={respondRdvAction} className="flex-1">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event_id" value={ev.id} />
            <input type="hidden" name="decision" value="accepted" />
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Accepter
            </button>
          </form>
          <form action={respondRdvAction} className="flex-1">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="event_id" value={ev.id} />
            <input type="hidden" name="decision" value="refused" />
            <button
              type="submit"
              className="w-full rounded-xl border border-red-300 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-800"
            >
              Refuser
            </button>
          </form>
        </div>
      ) : null}

      {mode === 'cancel' ? (
        <form action={cancelClientRdvAction} className="mt-3 border-t border-black/5 pt-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="event_id" value={ev.id} />
          <button type="submit" className="text-xs font-semibold text-red-700 hover:underline">
            Annuler la demande
          </button>
        </form>
      ) : null}
    </li>
  )
}

export default async function ClientCalendrierPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  let events: CalendarEventRow[] = []
  let loadError: string | null = null
  try {
    events = await listClientEvents(supabase, ctx.client.id)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur chargement'
  }

  const awaitingCoach = events.filter((e) => e.status === 'requested')
  const toRespond = events.filter((e) => e.status === 'pending')
  const upcoming = events.filter((e) => e.status === 'accepted')
  const closed = events.filter((e) => e.status === 'refused' || e.status === 'cancelled')

  const todayIso = new Date().toISOString().slice(0, 10)

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            RDV
          </h1>
          <p className="mt-1 text-sm text-black/55">
            Propose un créneau — ton coach accepte ou refuse. Agenda confirmé sur{' '}
            <Link href={`/c/${ctx.slug}/home`} className="font-semibold underline">
              Accueil
            </Link>
            .
          </p>
        </div>

        {q.error || loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error || loadError}
          </div>
        ) : null}
        {q.requested ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Demande envoyée — en attente de ton coach.
          </div>
        ) : null}
        {q.accepted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            RDV accepté — visible sur Accueil.
          </div>
        ) : null}
        {q.refused ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            RDV refusé.
          </div>
        ) : null}
        {q.cancelled ? (
          <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-black/60">
            Demande annulée.
          </div>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-extrabold" style={{ color: ctx.primaryColor }}>
            Proposer un RDV
          </h2>
          <p className="mt-1 text-xs text-black/45">
            Date, heure, durée, lieu (physique / visio) et un message optionnel.
          </p>
          <form action={requestRdvAction} className="mt-3 grid gap-3">
            <input type="hidden" name="slug" value={ctx.slug} />
            <input
              name="title"
              placeholder="Titre (ex. Bilan)"
              defaultValue="RDV"
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="date"
                type="date"
                required
                min={todayIso}
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
              <input
                name="time"
                type="time"
                defaultValue="10:00"
                required
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="duration_min"
                defaultValue="60"
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">1 h</option>
                <option value="90">1 h 30</option>
                <option value="120">2 h</option>
              </select>
              <select
                name="modality"
                required
                defaultValue=""
                className="rounded-xl border border-black/10 px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Physique ou Visio…
                </option>
                <option value="physique">Physique</option>
                <option value="visio">Visio</option>
              </select>
            </div>
            <textarea
              name="message"
              rows={3}
              placeholder="Message pour ton coach (optionnel)"
              className="rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: ctx.primaryColor }}
            >
              Envoyer la demande
            </button>
          </form>
        </section>

        {toRespond.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-sky-800">
              Proposition coach — à répondre ({toRespond.length})
            </h2>
            <ul className="grid gap-3">
              {toRespond.map((ev) => (
                <RdvRow
                  key={ev.id}
                  ev={ev}
                  slug={ctx.slug}
                  primaryColor={ctx.primaryColor}
                  mode="respond"
                />
              ))}
            </ul>
          </section>
        ) : null}

        {awaitingCoach.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-amber-800">
              En attente du coach
            </h2>
            <ul className="grid gap-3">
              {awaitingCoach.map((ev) => (
                <RdvRow
                  key={ev.id}
                  ev={ev}
                  slug={ctx.slug}
                  primaryColor={ctx.primaryColor}
                  mode="cancel"
                />
              ))}
            </ul>
          </section>
        ) : null}

        {upcoming.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
              Confirmés
            </h2>
            <ul className="grid gap-3">
              {upcoming.map((ev) => (
                <RdvRow key={ev.id} ev={ev} slug={ctx.slug} primaryColor={ctx.primaryColor} />
              ))}
            </ul>
          </section>
        ) : null}

        {closed.length ? (
          <section className="grid gap-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/40">
              Refusés / annulés
            </h2>
            <ul className="grid gap-3">
              {closed.map((ev) => (
                <RdvRow key={ev.id} ev={ev} slug={ctx.slug} primaryColor={ctx.primaryColor} />
              ))}
            </ul>
          </section>
        ) : null}

        <Link
          href={`/c/${ctx.slug}/coach`}
          className="text-center text-sm font-semibold"
          style={{ color: ctx.primaryColor }}
        >
          ← Retour Coach
        </Link>
      </div>
    </ClientPortalShell>
  )
}
