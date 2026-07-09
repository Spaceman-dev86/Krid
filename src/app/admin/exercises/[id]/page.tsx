import Link from 'next/link'
import { redirect } from 'next/navigation'

import ExerciseDetailView from '../../../../components/ExerciseDetailView'
import { createClient } from '../../../../lib/supabase/server'
import { signExerciseMediaUrl } from '../../../../lib/exerciseMedia'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

export default async function AdminExerciseDetailPage(props: PageProps) {
  const { id } = await props.params
  const { returnTo } = await props.searchParams
  const backHref = typeof returnTo === 'string' && returnTo.trim().length > 0 ? returnTo : '/admin/exercises'

  const replacementReturnTo = (() => {
    const url = new URL(`/admin/exercises/${id}`, 'http://localhost')
    if (typeof returnTo === 'string' && returnTo.trim().length > 0) {
      url.searchParams.set('returnTo', returnTo)
    }
    return url.pathname + url.search
  })()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/loginadmin')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const typedProfile = profile as unknown as { role: string | null } | null
  if (typedProfile?.role !== 'admin') {
    redirect('/dashboard/exercises')
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,common_mistakes,demo_media_path,replacement_exercise_id',
    )
    .eq('id', id)
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
    common_mistakes: string | null
    demo_media_path: string | null
    replacement_exercise_id: string | null
  }

  const demoMediaUrl = await signExerciseMediaUrl(supabase, typedExercise.demo_media_path ?? null)

  const replacementId = typedExercise.replacement_exercise_id
  const replacement = replacementId
    ? (
        (await supabase
          .from('exercise_library')
          .select('id,name,demo_media_path')
          .eq('id', replacementId)
          .maybeSingle()).data as unknown as { id: string; name: string; demo_media_path: string | null } | null
      )
    : null
  const replacementMediaUrl = replacement?.demo_media_path
    ? await signExerciseMediaUrl(supabase, replacement.demo_media_path)
    : null

  const editHref = `/admin/exercises/${id}/edit${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`

  return (
    <ExerciseDetailView
      exercise={typedExercise}
      demoMediaUrl={demoMediaUrl}
      demoMediaPath={typedExercise.demo_media_path}
      replacement={replacement}
      replacementMediaUrl={replacementMediaUrl}
      replacementMediaPath={replacement?.demo_media_path ?? null}
      backHref={backHref}
      preferBackHref={Boolean(returnTo)}
      exerciseBasePath="/admin/exercises"
      replacementReturnTo={replacementReturnTo}
      actions={
        <Link
          href={editHref}
          className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-[var(--brand)] ring-1 ring-black/10 hover:bg-[#f5f5f5]"
        >
          Modifier
        </Link>
      }
    />
  )
}
