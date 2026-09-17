import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ClientPortalShell } from '../../../../../../components/client-portal/ClientPortalShell'
import { ClientSessionPlayerClient } from '../../../../../../components/client-portal/ClientSessionPlayerClient'
import { ClientSessionPreviewClient } from '../../../../../../components/client-portal/ClientSessionPreviewClient'
import { startSessionRunAction } from '../../../session-run-actions'
import { requireClientPortal } from '../../../../../../lib/client-portal/context'
import {
  isActivePlanStatus,
  type ClientFitnessPlanRow,
} from '../../../../../../lib/client-portal/fitnessPlans'
import {
  emptyRealized,
  RUN_STYLE_LABELS,
  type SessionRunRealized,
  type SessionRunRow,
  type SessionRunSnapshot,
  type SessionRunStyle,
} from '../../../../../../lib/client-portal/sessionRuns'
import { fetchProgramPreviewStructure } from '../../../../../../lib/fetchProgramPreviewStructure'
import { createClient } from '../../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; sessionId: string }> | { slug: string; sessionId: string }
  searchParams?:
    | Promise<{
        run?: string
        run_error?: string
        run_done?: string
        style?: string
      }>
    | {
        run?: string
        run_error?: string
        run_done?: string
        style?: string
      }
}

export default async function ClientProgramSessionPage({ params, searchParams }: Props) {
  const { slug, sessionId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: session } = await supabase
    .from('sessions')
    .select('id, week_id, title, description, session_order')
    .eq('id', sessionId)
    .maybeSingle()

  if (!session) notFound()

  const { data: week } = await supabase
    .from('program_weeks')
    .select('id, program_id, title, week_order')
    .eq('id', session.week_id)
    .maybeSingle()

  if (!week?.program_id) notFound()

  const { data: fitnessPlansRaw } = await supabase
    .from('client_fitness_plans')
    .select('id, status, source_program_id')
    .eq('client_id', ctx.client.id)
    .eq('source_program_id', week.program_id)

  const fitnessPlans = (fitnessPlansRaw ?? []) as unknown as ClientFitnessPlanRow[]
  const planForProgram = fitnessPlans[0] ?? null

  if (!planForProgram) notFound()

  const structure = await fetchProgramPreviewStructure(supabase, week.program_id)
  const sessionRow = structure.sessions.find((s) => s.id === sessionId)
  if (!sessionRow) notFound()

  const planStarted = isActivePlanStatus(planForProgram.status)
  const sessionTitle =
    sessionRow.title?.trim() || `Séance ${(sessionRow.session_order ?? 0) + 1}`
  const weekLabel = week.title?.trim() || `Semaine ${(week.week_order ?? 0) + 1}`

  const { data: runRows } = await supabase
    .from('session_runs')
    .select(
      'id, client_id, coach_id, plan_id, source_session_id, source, title, scheduled_date, actual_date, style, snapshot, realized, comment, started_at, finished_at, created_at, updated_at'
    )
    .eq('client_id', ctx.client.id)
    .eq('source_session_id', sessionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const runs = (runRows ?? []) as unknown as SessionRunRow[]
  const activeRun =
    runs.find((r) => r.id === q.run) ??
    runs.find((r) => r.style === 'en_cours') ??
    null
  const completedRun = runs.find((r) => r.style !== 'en_cours') ?? null

  const snapshot = (activeRun?.snapshot ?? null) as SessionRunSnapshot | null
  const realized = (activeRun?.realized as SessionRunRealized | null) ??
    (snapshot ? emptyRealized(snapshot) : null)

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-4">
        <div>
          <Link
            href={`/c/${ctx.slug}/home`}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Accueil
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            {sessionTitle}
          </h1>
          <p className="mt-1 text-sm text-black/55">{weekLabel}</p>
          {sessionRow.description ? (
            <p className="mt-2 text-sm text-black/60">{sessionRow.description}</p>
          ) : null}
        </div>

        {q.run_error === 'already_done' ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
            Cette séance a déjà été jouée. Pas de re-run de la même instance (spec).
          </div>
        ) : q.run_error === 'other_en_cours' ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
            Une autre séance est déjà en cours — reprends-la d’abord.
          </div>
        ) : q.run_error === 'plan' ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
            Démarre le plan depuis l’accueil avant de lancer une séance.
          </div>
        ) : q.run_error ? (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
            {q.run_error}
          </div>
        ) : null}

        {q.run_done === '1' ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100">
            Séance terminée
            {q.style && q.style in RUN_STYLE_LABELS
              ? ` · ${RUN_STYLE_LABELS[q.style as SessionRunStyle]}`
              : ''}
            .{' '}
            {completedRun ? (
              <Link
                href={`/c/${ctx.slug}/historique/seance/${completedRun.id}`}
                className="underline"
              >
                Voir le détail
              </Link>
            ) : (
              'Voir l’historique.'
            )}
          </div>
        ) : null}

        {!planStarted ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
            Programme en attente —{' '}
            <Link href={`/c/${ctx.slug}/home`} className="font-bold underline">
              démarre le plan
            </Link>{' '}
            pour exécuter cette séance.
          </div>
        ) : activeRun && snapshot && realized && activeRun.style === 'en_cours' ? (
          <ClientSessionPlayerClient
            slug={ctx.slug}
            sessionId={sessionId}
            runId={activeRun.id}
            primaryColor={ctx.primaryColor}
            snapshot={snapshot}
            initialRealized={realized}
          />
        ) : completedRun ? (
          <div className="grid gap-3">
            <div className="rounded-xl border border-black/10 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="font-semibold text-[#1a1220]">
                Séance {RUN_STYLE_LABELS[completedRun.style] ?? completedRun.style}
              </p>
              <p className="mt-1 text-xs text-black/45">
                {completedRun.finished_at
                  ? `Terminée le ${new Date(completedRun.finished_at).toLocaleString('fr-FR')}`
                  : completedRun.actual_date
                    ? `Le ${new Date(completedRun.actual_date).toLocaleDateString('fr-FR')}`
                    : ''}
              </p>
              <Link
                href={`/c/${ctx.slug}/historique/seance/${completedRun.id}`}
                className="mt-2 inline-block text-sm font-bold"
                style={{ color: ctx.primaryColor }}
              >
                Voir le détail →
              </Link>
            </div>
            <ClientSessionPreviewClient
              session={sessionRow}
              programExercises={structure.programExercises}
              sessionItems={structure.sessionItems}
              sessionBlocks={structure.sessionBlocks}
              blockExercises={structure.blockExercises}
            />
          </div>
        ) : (
          <div className="grid gap-4">
            <form action={startSessionRunAction}>
              <input type="hidden" name="slug" value={ctx.slug} />
              <input type="hidden" name="session_id" value={sessionId} />
              <input type="hidden" name="plan_id" value={planForProgram.id} />
              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm"
                style={{ backgroundColor: ctx.primaryColor }}
              >
                Démarrer la séance
              </button>
            </form>
            <p className="text-xs text-black/45">
              Ouvre le mode run (snapshot figé). Tu choisis l’ordre des exos / blocs librement.
            </p>
            <ClientSessionPreviewClient
              session={sessionRow}
              programExercises={structure.programExercises}
              sessionItems={structure.sessionItems}
              sessionBlocks={structure.sessionBlocks}
              blockExercises={structure.blockExercises}
            />
          </div>
        )}
      </div>
    </ClientPortalShell>
  )
}
