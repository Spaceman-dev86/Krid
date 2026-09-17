import Link from 'next/link'

import { ClientDiySessionEditor } from '../../../../../components/client-portal/ClientDiySessionEditor'
import { ClientPortalShell } from '../../../../../components/client-portal/ClientPortalShell'
import { requireClientPortal } from '../../../../../lib/client-portal/context'
import type { DiyExerciseInput } from '../../../../../lib/client-portal/diySessions'
import type { SessionRunSnapshot } from '../../../../../lib/client-portal/sessionRuns'
import { chatDb } from '../../../../../lib/chat/chat'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ error?: string; draft?: string }>
    | { error?: string; draft?: string }
}

export default async function ClientSeanceNewPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const ctx = await requireClientPortal(supabase, slug, user?.id)

  const { data: libraryRaw } = await supabase
    .from('exercise_library')
    .select('id, name, muscle_group, coach_id')
    .is('deleted_at', null)
    .or(`coach_id.is.null,coach_id.eq.${ctx.coachId}`)
    .order('name', { ascending: true })
    .limit(200)

  const library = (libraryRaw ?? []) as Array<{
    id: string
    name: string
    muscle_group: string | null
    coach_id: string | null
  }>

  let draftId: string | null = q.draft?.trim() || null
  let initialTitle = ''
  let initialExercises: DiyExerciseInput[] = []

  if (draftId) {
    const db = chatDb(supabase)
    const { data: draft } = await db
      .from('client_diy_sessions')
      .select('id, title, snapshot')
      .eq('id', draftId)
      .eq('client_id', ctx.client.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (draft) {
      initialTitle = draft.title ?? ''
      const snap = draft.snapshot as SessionRunSnapshot
      initialExercises = (snap?.items ?? [])
        .filter((it): it is Extract<typeof it, { kind: 'exercise' }> => it.kind === 'exercise')
        .map((it) => ({
          exerciseId: it.exercise_id,
          name: it.name,
          sets: it.sets != null ? String(it.sets) : null,
          reps: it.reps != null ? String(it.reps) : null,
          restTime: it.rest_time,
          load: it.load,
          notes: it.notes,
          demoMediaUrl: it.demo_media_url ?? null,
        }))
    } else {
      draftId = null
    }
  }

  return (
    <ClientPortalShell slug={ctx.slug} appName={ctx.appName} primaryColor={ctx.primaryColor} logoUrl={ctx.logoUrl}>
      <div className="mb-3">
        <Link
          href={`/c/${ctx.slug}/seance`}
          className="text-xs font-bold text-black/45 hover:text-black/65"
        >
          ← Séance
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold" style={{ color: ctx.primaryColor }}>
          {draftId ? 'Modifier le brouillon' : 'Créer une séance'}
        </h1>
        <p className="mt-1 text-sm text-black/55">Libre · hors plan coach</p>
      </div>

      <ClientDiySessionEditor
        slug={ctx.slug}
        primaryColor={ctx.primaryColor}
        library={library}
        draftId={draftId}
        initialTitle={initialTitle}
        initialExercises={initialExercises}
        error={q.error ?? null}
      />
    </ClientPortalShell>
  )
}
