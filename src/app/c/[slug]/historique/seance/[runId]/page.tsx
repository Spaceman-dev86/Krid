import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ClientPortalShell } from '../../../../../../components/client-portal/ClientPortalShell'
import { ClientRunHistoryDetail } from '../../../../../../components/client-portal/ClientRunHistoryDetail'
import { requireClientPortal } from '../../../../../../lib/client-portal/context'
import {
  RUN_STYLE_LABELS,
  summarizeRun,
  type SessionRunRealized,
  type SessionRunRow,
  type SessionRunSnapshot,
  type SessionRunStyle,
} from '../../../../../../lib/client-portal/sessionRuns'
import { createClient } from '../../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; runId: string }> | { slug: string; runId: string }
}

export default async function ClientHistoriqueRunPage({ params }: Props) {
  const { slug, runId } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: runRaw } = await supabase
    .from('session_runs')
    .select(
      'id, title, style, source, source_session_id, scheduled_date, actual_date, started_at, finished_at, created_at, snapshot, realized, comment'
    )
    .eq('id', runId)
    .eq('client_id', ctx.client.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!runRaw) notFound()

  const run = runRaw as unknown as SessionRunRow
  const snapshot = run.snapshot as SessionRunSnapshot | null
  const realized = run.realized as SessionRunRealized | null
  const summary = summarizeRun(snapshot, realized)
  const styleLabel = RUN_STYLE_LABELS[run.style as SessionRunStyle] ?? run.style
  const when = run.finished_at || run.actual_date || run.created_at

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-4">
        <div>
          <Link
            href={`/c/${ctx.slug}/historique`}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Historique
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
            {run.title?.trim() || 'Séance'}
          </h1>
          <p className="mt-1 text-sm text-black/55">
            {when ? new Date(when).toLocaleString('fr-FR') : ''}
            {run.source === 'libre' ? ' · libre' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black/55 ring-1 ring-black/10">
            {styleLabel}
          </span>
          <span className="text-xs text-black/45">
            {summary.fait}/{summary.total} items faits
            {summary.partiel > 0 ? ` · ${summary.partiel} partiel` : ''}
            {summary.setsTotal > 0 ? ` · ${summary.setsDone}/${summary.setsTotal} séries` : ''}
            {summary.nonFait > 0 ? ` · ${summary.nonFait} non fait` : ''}
          </span>
        </div>

        {run.comment ? (
          <p className="rounded-xl bg-[#fafafa] px-3 py-2 text-sm text-black/60">{run.comment}</p>
        ) : null}

        <ClientRunHistoryDetail snapshot={snapshot} realized={realized} />

        {run.source_session_id ? (
          <Link
            href={`/c/${ctx.slug}/programme/seance/${run.source_session_id}`}
            className="text-center text-sm font-bold"
            style={{ color: ctx.primaryColor }}
          >
            Voir la séance programme →
          </Link>
        ) : null}
      </div>
    </ClientPortalShell>
  )
}
