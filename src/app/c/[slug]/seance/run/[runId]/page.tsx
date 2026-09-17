import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ClientPortalShell } from '../../../../../../components/client-portal/ClientPortalShell'
import { ClientSessionPlayerClient } from '../../../../../../components/client-portal/ClientSessionPlayerClient'
import { requireClientPortal } from '../../../../../../lib/client-portal/context'
import {
  emptyRealized,
  type SessionRunRealized,
  type SessionRunRow,
  type SessionRunSnapshot,
} from '../../../../../../lib/client-portal/sessionRuns'
import { createClient } from '../../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; runId: string }> | { slug: string; runId: string }
  searchParams?: Promise<{ run_error?: string }> | { run_error?: string }
}

export default async function ClientLibreRunPage({ params, searchParams }: Props) {
  const { slug, runId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: runRaw } = await supabase
    .from('session_runs')
    .select(
      'id, client_id, coach_id, plan_id, source_session_id, source, title, scheduled_date, actual_date, style, snapshot, realized, comment, started_at, finished_at, created_at, updated_at'
    )
    .eq('id', runId)
    .eq('client_id', ctx.client.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!runRaw) notFound()
  const run = runRaw as unknown as SessionRunRow

  if (run.style !== 'en_cours') {
    return (
      <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
        <Link
          href={`/c/${ctx.slug}/historique/seance/${run.id}`}
          className="text-sm font-bold"
          style={{ color: ctx.primaryColor }}
        >
          Séance terminée — voir le détail →
        </Link>
      </ClientPortalShell>
    )
  }

  const snapshot = (run.snapshot as SessionRunSnapshot | null) ?? {
    version: 1 as const,
    session_id: run.id,
    title: run.title ?? 'Séance libre',
    items: [],
  }
  const realized =
    (run.realized as SessionRunRealized | null) ?? emptyRealized(snapshot)
  const returnTo = `/c/${ctx.slug}/seance/run/${run.id}`

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="grid gap-4">
        <div>
          <Link
            href={`/c/${ctx.slug}/seance`}
            className="text-xs font-bold text-black/45 hover:text-black/65"
          >
            ← Séance
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
              {snapshot.title || 'Séance libre'}
            </h1>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-100">
              Libre
            </span>
          </div>
        </div>

        {q.run_error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.run_error}
          </div>
        ) : null}

        <ClientSessionPlayerClient
          slug={ctx.slug}
          sessionId={snapshot.session_id || run.id}
          runId={run.id}
          primaryColor={ctx.primaryColor}
          snapshot={snapshot}
          initialRealized={realized}
          returnTo={returnTo}
        />
      </div>
    </ClientPortalShell>
  )
}
