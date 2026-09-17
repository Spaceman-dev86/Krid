import Link from 'next/link'

import { ClientHistoryLandClient } from '../../../../../components/client-portal/ClientHistoryLandClient'
import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../lib/client-portal/context'
import {
  buildFavoriteSet,
  buildHistoryCalendarDays,
  buildHistoryLandRows,
} from '../../../../../lib/client-portal/historyLand'
import { loadClientFavorites } from '../../../../../lib/client-portal/loadClientFavorites'
import type { SessionRunRow } from '../../../../../lib/client-portal/sessionRuns'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> | { slug: string } }

export default async function ClientHistoriqueFavorisPage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const [{ data: runsRaw }, favRaw] = await Promise.all([
    supabase
      .from('session_runs')
      .select(
        'id, title, style, source_session_id, actual_date, finished_at, started_at, created_at, source, snapshot, realized'
      )
      .eq('client_id', ctx.client.id)
      .is('deleted_at', null)
      .neq('style', 'en_cours')
      .order('finished_at', { ascending: false })
      .limit(120),
    loadClientFavorites(supabase, ctx.client.id),
  ])

  const runs = (runsRaw ?? []) as unknown as SessionRunRow[]
  const favorites = buildFavoriteSet(favRaw)
  const allRows = buildHistoryLandRows(runs, favorites)
  const rows = allRows.filter((r) => r.isFavorite)
  const calendarDays = buildHistoryCalendarDays(runs)

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="mb-3">
        <Link
          href={`/c/${ctx.slug}/historique`}
          className="text-xs font-bold text-black/45 hover:text-black/65"
        >
          ← Historique
        </Link>
      </div>
      <ClientHistoryLandClient
        slug={ctx.slug}
        primaryColor={ctx.primaryColor}
        rows={rows}
        calendarDays={calendarDays}
        favorisHref={`/c/${ctx.slug}/historique/favoris`}
        emptyLabel="Aucun favori pour l’instant. Touche l’étoile sur une ligne."
        title="Favoris"
        subtitle="Exos & blocs épinglés"
        returnToPath={`/c/${ctx.slug}/historique/favoris`}
      />
    </ClientPortalShell>
  )
}
