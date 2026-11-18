'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'

import { addPlanSessionCoachCommentAction } from '@/src/app/programs/plans/actions'
import {
  ClientBilanSendDialog,
  type ClientBilanRecapItem,
} from '@/src/components/bilans/ClientBilanSendDialog'
import { ClientMessageDialog } from '@/src/components/chat/ClientMessageDialog'
import { IconEdit, IconSend } from '@/src/components/ui'
import {
  complianceDotClass,
  complianceLabel,
  complianceTextClass,
  type ComplianceLevel,
  type PlanFicheBlockView,
  type PlanFicheCoachComment,
  type PlanFicheData,
  type PlanFicheExerciseView,
  type PlanFicheRealizedLine,
  type PlanFicheSessionView,
} from '@/src/lib/programs/loadPlanFiche'

function statusPill(status: string) {
  if (status === 'started') return 'En cours'
  if (status === 'waiting') return 'En attente'
  if (status === 'paused') return 'En pause'
  if (status === 'done' || status === 'archived' || status === 'completed' || status === 'ended') {
    return 'Passé'
  }
  return status
}

function formatCommentDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function LevelDot({ level }: { level: ComplianceLevel }) {
  if (level === 'neutre') return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${complianceTextClass(level)}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${complianceDotClass(level)}`} />
      {complianceLabel(level)}
    </span>
  )
}

function DemandRealizedStack({
  demand,
  realized,
}: {
  demand: { text: string; coachNote?: string | null }
  realized: PlanFicheRealizedLine
}) {
  return (
    <div className="mt-1 space-y-0.5">
      <p className="whitespace-pre-line text-xs italic text-[color:var(--muted)]">{demand.text}</p>
      {demand.coachNote ? (
        <p className="text-xs italic text-[color:var(--muted)]">{demand.coachNote}</p>
      ) : null}

      {realized.summary ? (
        <p className="text-xs font-bold text-[color:var(--fg)]">{realized.summary}</p>
      ) : null}

      {realized.rows.length ? (
        <ul className="space-y-0.5">
          {realized.rows.map((row, i) => (
            <li key={i} className="text-xs font-bold text-[color:var(--fg)]">
              {row.text}
            </li>
          ))}
        </ul>
      ) : !realized.summary ? (
        <p className="text-xs font-bold text-[color:var(--fg)]">—</p>
      ) : null}
    </div>
  )
}

function ExerciseBlock({ item }: { item: PlanFicheExerciseView }) {
  return (
    <div className="border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-bold text-[color:var(--brand)]">
          {item.name}
        </p>
        <LevelDot level={item.realized.level} />
      </div>
      <DemandRealizedStack demand={item.demand} realized={item.realized} />
    </div>
  )
}

function BlockCard({ item }: { item: PlanFicheBlockView }) {
  return (
    <div className="my-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--page-bg)]/40 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[color:var(--brand)]">
          {item.title}
          {item.type ? (
            <span className="ml-2 text-[11px] font-semibold text-[color:var(--muted)]">
              {item.type}
            </span>
          ) : null}
        </p>
        <LevelDot level={item.level} />
      </div>
      {item.coachNotes ? (
        <p className="mt-1 text-[11px] text-[color:var(--muted)]">{item.coachNotes}</p>
      ) : null}
      <div className="mt-1">
        {item.exercises.map((ex) => (
          <div key={ex.id} className="border-t border-[var(--border)] py-2 first:border-t-0">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-[color:var(--brand)]">
                {ex.name}
              </p>
              <LevelDot level={ex.realized.level} />
            </div>
            <DemandRealizedStack demand={ex.demand} realized={ex.realized} />
          </div>
        ))}
      </div>
      {item.blockNote ? (
        <p className="mt-2 text-[11px] italic text-[color:var(--muted)]">{item.blockNote}</p>
      ) : null}
    </div>
  )
}

function sessionEditHref(
  programId: string,
  sessionId: string,
  planId: string,
  weekIndex: number,
) {
  const returnTo = `/programs/plans/${planId}?w=${weekIndex}&sid=${sessionId}`
  const q = new URLSearchParams({ returnTo })
  return `/programs/${programId}/sessions/${sessionId}/edit?${q.toString()}`
}

function SessionDetail({
  session,
  planId,
  programId,
  weekIndex,
  comments,
  onCommentsChange,
}: {
  session: PlanFicheSessionView
  planId: string
  programId: string | null
  weekIndex: number
  comments: PlanFicheCoachComment[]
  onCommentsChange: (next: PlanFicheCoachComment[]) => void
}) {
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const dateLabel = session.actualDate || session.scheduledDate
  const dateFmt = dateLabel
    ? new Date(dateLabel.length === 10 ? `${dateLabel}T12:00:00` : dateLabel).toLocaleDateString(
        'fr-FR',
        { weekday: 'short', day: '2-digit', month: 'short' },
      )
    : null

  const canEdit =
    Boolean(programId && session.sessionId && session.isFuture)

  function submit() {
    const trimmed = text.trim()
    if (!trimmed || !session.runId) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('run_id', session.runId!)
      fd.set('plan_id', planId)
      fd.set('text', trimmed)
      const res = await addPlanSessionCoachCommentAction(fd)
      if (!res.ok) {
        setError(res.error === 'missing' ? 'Commentaire vide' : res.error)
        return
      }
      if (res.comment) onCommentsChange([...comments, res.comment])
      setText('')
    })
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-[color:var(--fg)]">{session.title}</h2>
          {dateFmt ? (
            <p className="text-[11px] text-[color:var(--muted)]">
              {dateFmt}
              {session.actualDate &&
              session.scheduledDate &&
              session.actualDate !== session.scheduledDate
                ? ` · prévu ${session.scheduledDate}`
                : null}
              {session.isFuture ? ' · à venir' : null}
            </p>
          ) : session.isFuture ? (
            <p className="text-[11px] text-[color:var(--muted)]">À venir</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LevelDot level={session.level} />
          {canEdit && programId && session.sessionId ? (
            <Link
              href={sessionEditHref(programId, session.sessionId, planId, weekIndex)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[color:var(--brand)]"
              title="Modifier la séance"
              aria-label="Modifier la séance"
            >
              <IconEdit size={14} />
            </Link>
          ) : null}
        </div>
      </div>

      {session.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[color:var(--muted)]">
          {session.isFuture ? 'Pas encore de détail snapshot.' : 'Aucun exercice.'}
        </p>
      ) : (
        <div>
          {session.items.map((item) =>
            item.kind === 'exercise' ? (
              <ExerciseBlock key={item.id} item={item} />
            ) : (
              <BlockCard key={item.id} item={item} />
            ),
          )}
        </div>
      )}

      {session.sessionComment ? (
        <p className="mt-3 rounded-md bg-[var(--page-bg)] px-3 py-2 text-xs italic text-[color:var(--muted)]">
          Note séance client : {session.sessionComment}
        </p>
      ) : null}

      {comments.length ? (
        <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-[var(--border)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] px-3 py-2"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--brand)]">
                Coach · {formatCommentDate(c.createdAt)}
              </p>
              <p className="mt-0.5 text-sm text-[color:var(--fg)]">{c.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <p className="mb-1 text-xs font-semibold text-[color:var(--fg)]">
          Commentaire coach
          <span className="ml-1 font-normal text-[color:var(--muted)]">
            (notif client bientôt)
          </span>
        </p>
        <div
          className={`flex w-full items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--page-bg)] py-1 pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-[var(--brand)] ${
            !session.runId || pending ? 'opacity-60' : ''
          }`}
        >
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              session.runId
                ? 'Écrire un retour sur cette séance…'
                : 'Disponible une fois la séance réalisée'
            }
            disabled={!session.runId || pending}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm font-normal text-[color:var(--fg)] outline-none focus:ring-0"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              if (!pending && text.trim() && session.runId) submit()
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || !session.runId || pending}
            aria-label="Envoyer"
            title="Envoyer"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--brand)] transition hover:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] disabled:pointer-events-none disabled:opacity-35"
          >
            <IconSend size={20} />
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  )
}

type BilanTemplateOpt = { id: string; title: string }

export function ProgramsPlanFicheClient({
  data,
  bilanTemplates = [],
  recentBilans = [],
  initialWeekIndex = null,
  initialSessionId = null,
}: {
  data: PlanFicheData
  bilanTemplates?: BilanTemplateOpt[]
  recentBilans?: ClientBilanRecapItem[]
  initialWeekIndex?: number | null
  initialSessionId?: string | null
}) {
  const firstWeekWithSession = useMemo(() => {
    if (initialSessionId) {
      const bySid = data.weeks.findIndex((w) =>
        w.sessions.some((s) => s.sessionId === initialSessionId),
      )
      if (bySid >= 0) return bySid
    }
    if (
      typeof initialWeekIndex === 'number' &&
      initialWeekIndex >= 0 &&
      initialWeekIndex < data.weeks.length
    ) {
      return initialWeekIndex
    }
    const i = data.weeks.findIndex((w) => w.sessions.length > 0)
    return i >= 0 ? i : 0
  }, [data.weeks, initialWeekIndex, initialSessionId])

  const [weekIndex, setWeekIndex] = useState(firstWeekWithSession)
  const week = data.weeks[weekIndex] ?? data.weeks[0]
  const sessions = week?.sessions ?? []

  const defaultSession = useMemo(() => {
    if (initialSessionId) {
      const bySid = sessions.findIndex((s) => s.sessionId === initialSessionId)
      if (bySid >= 0) return bySid
    }
    const done = sessions.findIndex((s) => !s.isFuture)
    return done >= 0 ? done : 0
  }, [sessions, initialSessionId])

  const [sessionIndex, setSessionIndex] = useState(defaultSession)
  const [commentsByRun, setCommentsByRun] = useState<Record<string, PlanFicheCoachComment[]>>(() => {
    const map: Record<string, PlanFicheCoachComment[]> = {}
    for (const w of data.weeks) {
      for (const s of w.sessions) {
        if (s.runId) map[s.runId] = s.coachComments
      }
    }
    return map
  })

  const safeSessionIndex =
    sessions.length === 0 ? 0 : Math.min(sessionIndex, sessions.length - 1)
  const open = sessions[safeSessionIndex] ?? null

  function goWeek(delta: number) {
    const next = Math.min(data.weeks.length - 1, Math.max(0, weekIndex + delta))
    setWeekIndex(next)
    setSessionIndex(0)
  }

  function goSession(delta: number) {
    if (!sessions.length) return
    setSessionIndex((i) => Math.min(sessions.length - 1, Math.max(0, i + delta)))
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/programs/encours"
            className="text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--brand)]"
          >
            ← En cours
          </Link>
          <h1 className="mt-1 text-xl font-extrabold text-[color:var(--fg)]">
            {data.programTitle}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            <Link
              href={`/clients/${data.clientId}`}
              className="font-semibold text-[color:var(--brand)] underline-offset-2 hover:underline"
            >
              {data.clientLabel}
            </Link>
            <span className="mx-1.5">·</span>
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold">
              {statusPill(data.status)}
            </span>
            <span className="mx-1.5">·</span>
            Début {data.startLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <ClientMessageDialog clientId={data.clientId} clientLabel={data.clientLabel} />
          <ClientBilanSendDialog
            clientId={data.clientId}
            clientLabel={data.clientLabel}
            templates={bilanTemplates}
            recentBilans={recentBilans}
            returnTo={`/programs/plans/${data.planId}`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--brand)] disabled:opacity-30"
          disabled={weekIndex <= 0}
          onClick={() => goWeek(-1)}
          aria-label="Semaine précédente"
        >
          ‹
        </button>
        <div className="flex flex-wrap gap-1">
          {data.weeks.map((w, i) => (
            <button
              key={w.weekIndex}
              type="button"
              onClick={() => {
                setWeekIndex(i)
                setSessionIndex(0)
              }}
              className={[
                'rounded-md px-2.5 py-1 text-xs font-bold',
                i === weekIndex
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]',
              ].join(' ')}
            >
              {w.label.startsWith('S') || w.label.startsWith('Sem')
                ? w.label.replace(/^Semaine\s+/i, 'S')
                : `S${i + 1}`}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--brand)] disabled:opacity-30"
          disabled={weekIndex >= data.weeks.length - 1}
          onClick={() => goWeek(1)}
          aria-label="Semaine suivante"
        >
          ›
        </button>
        <span className="ml-auto flex items-center gap-3 text-[10px] text-[color:var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--status-ok)]" /> conforme
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--status-warn)]" /> adapté
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--status-bad)]" /> non fait
          </span>
        </span>
      </div>

      {sessions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--brand)] disabled:opacity-30"
            disabled={safeSessionIndex <= 0}
            onClick={() => goSession(-1)}
            aria-label="Séance précédente"
          >
            ‹
          </button>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {sessions.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSessionIndex(i)}
                className={[
                  'inline-flex max-w-[10rem] items-center gap-1.5 truncate rounded-md px-2 py-1 text-[11px] font-bold',
                  i === safeSessionIndex
                    ? 'bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[color:var(--brand)]'
                    : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]',
                ].join(' ')}
              >
                {s.level !== 'neutre' ? (
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${complianceDotClass(s.level)}`} />
                ) : (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-[var(--border)]" />
                )}
                <span className="truncate">{s.title}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:text-[color:var(--brand)] disabled:opacity-30"
            disabled={safeSessionIndex >= sessions.length - 1}
            onClick={() => goSession(1)}
            aria-label="Séance suivante"
          >
            ›
          </button>
        </div>
      ) : null}

      {open ? (
        <SessionDetail
          key={open.key}
          session={open}
          planId={data.planId}
          programId={data.programId}
          weekIndex={weekIndex}
          comments={open.runId ? (commentsByRun[open.runId] ?? open.coachComments) : []}
          onCommentsChange={(next) => {
            if (!open.runId) return
            setCommentsByRun((m) => ({ ...m, [open.runId!]: next }))
          }}
        />
      ) : (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          Aucune séance dans cette semaine.
        </p>
      )}
    </div>
  )
}
