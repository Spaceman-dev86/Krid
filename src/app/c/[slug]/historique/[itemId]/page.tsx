import { notFound } from 'next/navigation'

import { ClientHistoryItemClient } from '../../../../../components/client-portal/ClientHistoryItemClient'
import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../lib/client-portal/context'
import {
  buildFavoriteSet,
  buildItemHistory,
  decodeItemId,
} from '../../../../../lib/client-portal/historyLand'
import { loadClientFavorites } from '../../../../../lib/client-portal/loadClientFavorites'
import type { SessionRunRow } from '../../../../../lib/client-portal/sessionRuns'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; itemId: string }> | { slug: string; itemId: string }
}

type LibAbout = {
  name: string
  description: string | null
  muscle_group: string | null
  difficulty: string | null
  video_url: string | null
  demo_media_path: string | null
}

export default async function ClientHistoriqueItemPage({ params }: Props) {
  const { slug, itemId: rawItemId } = await Promise.resolve(params)
  const itemId = decodeURIComponent(rawItemId)
  const decoded = decodeItemId(itemId)
  if (!decoded) notFound()

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
  const item = buildItemHistory(itemId, runs)
  if (!item) notFound()

  const favorites = buildFavoriteSet(favRaw)
  const isFavorite = favorites.has(`${item.kind}:${item.targetId}`)

  let about: {
    name: string
    description: string | null
    muscleGroup: string | null
    difficulty: string | null
    videoUrl: string | null
    demoMediaPath: string | null
  } | null = null

  if (item.kind === 'exercise' && item.exerciseLibraryId) {
    const db = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (a: string, b: string) => {
            maybeSingle: () => Promise<{ data: LibAbout | null }>
          }
        }
      }
    }
    const { data: lib } = await db
      .from('exercise_library')
      .select('name, description, muscle_group, difficulty, video_url, demo_media_path')
      .eq('id', item.exerciseLibraryId)
      .maybeSingle()
    if (lib) {
      about = {
        name: lib.name,
        description: lib.description,
        muscleGroup: lib.muscle_group,
        difficulty: lib.difficulty,
        videoUrl: lib.video_url,
        demoMediaPath: lib.demo_media_path,
      }
    }
  }

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <ClientHistoryItemClient
        slug={ctx.slug}
        primaryColor={ctx.primaryColor}
        item={item}
        isFavorite={isFavorite}
        about={about}
      />
    </ClientPortalShell>
  )
}
