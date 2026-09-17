import Link from 'next/link'
import { redirect } from 'next/navigation'

import ExerciseDetailView from '../../../../components/ExerciseDetailView'
import { Button } from '@/src/components/ui'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'
import { signExerciseMediaUrl } from '../../../../lib/exerciseMedia'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string; ok?: string }>
}

export default async function AdminExerciseDetailPage(props: PageProps) {
  const { id } = await props.params
  const { returnTo, ok } = await props.searchParams
  const backHref = typeof returnTo === 'string' && returnTo.trim().length > 0 ? returnTo : '/admin/exercises'

  const replacementReturnTo = (() => {
    const url = new URL(`/admin/exercises/${id}`, 'http://localhost')
    if (typeof returnTo === 'string' && returnTo.trim().length > 0) {
      url.searchParams.set('returnTo', returnTo)
    }
    return url.pathname + url.search
  })()

  const { supabase } = await requirePlatformAdmin()

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,named_notes,demo_media_path,exercise_type_id,exercise_type,coach_id,replacement_exercise_id',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!exercise) {
    redirect('/admin/exercises')
  }

  const typedExercise = exercise as unknown as {
    id: string
    name: string
    description: string | null
    muscle_group: string | null
    difficulty: string | null
    video_url: string | null
    named_notes: Array<{ title: string; body: string }> | null
    demo_media_path: string | null
    exercise_type_id: string | null
    exercise_type: string | null
    coach_id: string | null
    replacement_exercise_id: string | null
  }

  let typeLabel = typedExercise.exercise_type
  if (typedExercise.exercise_type_id) {
    const { data: t } = await supabase
      .from('exercise_types' as never)
      .select('label')
      .eq('id' as never, typedExercise.exercise_type_id as never)
      .maybeSingle()
    typeLabel = (t as { label?: string } | null)?.label ?? typeLabel
  }

  const demoMediaUrl = await signExerciseMediaUrl(supabase, typedExercise.demo_media_path ?? null)

  const { data: linksRaw } = await supabase
    .from('exercise_replacements' as never)
    .select('replacement_id, title, note, position')
    .eq('exercise_id' as never, id as never)
    .order('position' as never, { ascending: true })

  let replacementIds = (
    (linksRaw ?? []) as { replacement_id: string; title: string | null; note: string | null }[]
  ).map((l) => l.replacement_id)
  const bridgeMeta = new Map(
    ((linksRaw ?? []) as { replacement_id: string; title: string | null; note: string | null }[]).map(
      (l) => [l.replacement_id, { title: l.title, note: l.note }],
    ),
  )
  if (!replacementIds.length && typedExercise.replacement_exercise_id) {
    replacementIds = [typedExercise.replacement_exercise_id]
  }

  const replacements: Array<{
    exercise: { id: string; name: string; demo_media_path: string | null }
    mediaUrl: string | null
    bridgeTitle?: string | null
    bridgeNote?: string | null
  }> = []

  for (const rid of replacementIds) {
    const { data: rep } = await supabase
      .from('exercise_library')
      .select('id,name,demo_media_path')
      .eq('id', rid)
      .is('deleted_at', null)
      .maybeSingle()
    const typedRep = rep as unknown as { id: string; name: string; demo_media_path: string | null } | null
    if (!typedRep) continue
    const mediaUrl = typedRep.demo_media_path
      ? await signExerciseMediaUrl(supabase, typedRep.demo_media_path)
      : null
    const meta = bridgeMeta.get(rid)
    replacements.push({
      exercise: typedRep,
      mediaUrl,
      bridgeTitle: meta?.title,
      bridgeNote: meta?.note,
    })
  }

  const editHref = `/admin/exercises/${id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`
  const isTrainly = typedExercise.coach_id == null

  return (
    <>
      {ok === 'created' || ok === 'saved' || ok === 'published' || ok === 'draft' ? (
        <p className="mx-auto max-w-3xl px-4 pt-4 text-sm font-semibold text-[var(--success)] md:px-6">
          {ok === 'published'
            ? 'Exercice publié.'
            : ok === 'draft'
              ? 'Brouillon sauvegardé.'
              : ok === 'created'
                ? 'Brouillon créé.'
                : 'Exercice enregistré.'}
        </p>
      ) : null}
      <ExerciseDetailView
        exercise={{
          ...typedExercise,
          exercise_type_label: typeLabel,
        }}
        demoMediaUrl={demoMediaUrl}
        demoMediaPath={typedExercise.demo_media_path}
        replacements={replacements}
        backHref={backHref}
        preferBackHref={Boolean(returnTo)}
        exerciseBasePath="/admin/exercises"
        replacementReturnTo={replacementReturnTo}
        hideBackButton
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button href="/admin/exercises" variant="secondary" size="sm">
              Liste
            </Button>
            {isTrainly ? (
              <Button href={editHref} size="sm">
                Modifier
              </Button>
            ) : (
              <Link
                href={`/admin/coaches/${typedExercise.coach_id}`}
                className="text-xs font-semibold text-[var(--brand)]"
              >
                Coach →
              </Link>
            )}
          </div>
        }
      />
    </>
  )
}
