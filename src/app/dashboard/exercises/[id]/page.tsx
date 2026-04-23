import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import BackButtonClient from '../../../../components/BackButtonClient'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

export default async function DashboardExerciseDetailPage(props: PageProps) {
  const { id } = await props.params

  const { returnTo } = await props.searchParams
  const backHref = typeof returnTo === 'string' && returnTo.trim().length > 0 ? returnTo : '/dashboard'

  const replacementBackHref = (() => {
    const url = new URL(`/dashboard/exercises/${id}`, 'http://localhost')
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
    redirect('/login')
  }

  const { data: exercise } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,common_mistakes,demo_media_path,replacement_exercise_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (!exercise) {
    redirect('/dashboard?error=exercise_not_found')
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

  const storageBucket = 'exercise-media'

  function normalizeStoragePath(p: string) {
    let out = p.trim()
    if (out.startsWith('/')) out = out.slice(1)
    if (out.startsWith(`${storageBucket}/`)) out = out.slice(storageBucket.length + 1)
    return out
  }

  function getStoragePathFromUrl(raw: string) {
    try {
      const u = new URL(raw)
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => p === 'object')
      if (idx === -1) return null
      const bucketIdx = idx + 2
      if (!parts[bucketIdx] || parts[bucketIdx] !== storageBucket) return null
      const internal = parts.slice(bucketIdx + 1).join('/')
      return internal || null
    } catch {
      return null
    }
  }

  async function signMediaUrl(rawPathOrUrl: string | null) {
    if (!rawPathOrUrl) return null
    const raw = String(rawPathOrUrl).trim()
    if (!raw) return null

    const isHttp = /^https?:\/\//i.test(raw)
    const internalFromUrl = isHttp ? getStoragePathFromUrl(raw) : null
    const internalPath = internalFromUrl ?? (isHttp ? null : raw)

    if (!internalPath) {
      return raw
    }

    const { data } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(normalizeStoragePath(internalPath), 60 * 60)

    return data?.signedUrl ?? null
  }

  const demoMediaUrl = await signMediaUrl(typedExercise.demo_media_path ?? null)

  const replacementId = typedExercise.replacement_exercise_id as string | null
  const replacement = replacementId
    ? (
        (await supabase
          .from('exercise_library')
          .select('id,name,demo_media_path')
          .eq('id', replacementId)
          .maybeSingle()).data as unknown as { id: string; name: string; demo_media_path: string | null } | null
      )
    : null
  const replacementMediaUrl = replacement?.demo_media_path ? await signMediaUrl(replacement.demo_media_path) : null

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-[var(--brand)]">Exercice</div>
          <div className="mt-1 truncate text-lg font-extrabold text-[var(--brand)]">{typedExercise.name}</div>
        </div>

        <BackButtonClient
          href={backHref}
          preferHref={Boolean(returnTo)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
          ariaLabel="Retour"
        >
          ←
        </BackButtonClient>
      </div>

      <div className="mt-4 grid gap-4">
        {demoMediaUrl ? (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
            <img src={demoMediaUrl} alt={typedExercise.name} className="h-80 w-full object-cover" loading="lazy" />
          </div>
        ) : null}

        {(typedExercise.muscle_group || typedExercise.difficulty) ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
              <div className="text-xs font-extrabold text-[var(--brand)]">Groupe musculaire</div>
              <div className="mt-1 text-sm font-semibold text-black/70">{typedExercise.muscle_group ?? ''}</div>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
              <div className="text-xs font-extrabold text-[var(--brand)]">Difficulté</div>
              <div className="mt-1 text-sm font-semibold text-black/70">{typedExercise.difficulty ?? ''}</div>
            </div>
          </div>
        ) : null}

        {typedExercise.video_url ? (
          <a
            href={typedExercise.video_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--brand)] ring-1 ring-black/10"
          >
            Ouvrir la vidéo
          </a>
        ) : null}

        {typedExercise.description ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Description</div>
            <div className="mt-1 text-sm text-black/70">{typedExercise.description}</div>
          </div>
        ) : null}

        {typedExercise.common_mistakes ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Erreurs fréquentes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-black/70">{typedExercise.common_mistakes}</div>
          </div>
        ) : null}

        {replacement ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Exercice de remplacement</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                {replacementMediaUrl ? (
                  <img src={replacementMediaUrl} alt={replacement.name} className="h-16 w-16 object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-[var(--brand)]">{replacement.name}</div>
                <Link
                  href={`/dashboard/exercises/${replacement.id}?returnTo=${encodeURIComponent(replacementBackHref)}`}
                  className="mt-1 inline-block text-sm text-black/60"
                >
                  Voir la fiche
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
