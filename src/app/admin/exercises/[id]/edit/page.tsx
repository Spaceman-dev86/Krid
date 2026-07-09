import Link from 'next/link'
import { redirect } from 'next/navigation'

import BackButtonClient from '../../../../../components/BackButtonClient'
import { createClient } from '../../../../../lib/supabase/server'
import { isPngOrGifMedia, signExerciseMediaUrl } from '../../../../../lib/exerciseMedia'

type UntypedMaybeSingleResult = { data: unknown; error: { message?: string } | null }
type UntypedMutationResult = { error: { message?: string } | null }

type UntypedMutationChain = {
  eq: (col: string, val: string) => Promise<UntypedMutationResult>
}

type UntypedQuery = {
  select: (columns: string) => UntypedQuery
  eq: (col: string, val: string) => UntypedQuery
  maybeSingle: () => Promise<UntypedMaybeSingleResult>
  update: (values: Record<string, unknown>) => UntypedMutationChain
  delete: () => UntypedMutationChain
}

const inputClassName =
  'w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#341c44] ring-1 ring-black/10 outline-none'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ returnTo?: string }>
}

export default async function AdminExerciseEditPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { returnTo } = await searchParams
  const backHref =
    typeof returnTo === 'string' && returnTo.trim().length > 0
      ? `/admin/exercises/${id}?returnTo=${encodeURIComponent(returnTo)}`
      : `/admin/exercises/${id}`

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
    redirect('/dashboard')
  }

  const { data: exercise, error } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,video_url,common_mistakes,demo_media_path,replacement_exercise_id',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !exercise) {
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

  let replacement: { id: string; name: string; demo_media_path: string | null } | null = null
  let replacementMediaUrl: string | null = null

  if (typedExercise.replacement_exercise_id) {
    const { data: rep } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('exercise_library')
      .select('id,name,demo_media_path')
      .eq('id', typedExercise.replacement_exercise_id)
      .maybeSingle()

    const typedRep = rep as unknown as { id: string; name: string; demo_media_path: string | null } | null
    if (typedRep) {
      replacement = typedRep
      if (typedRep.demo_media_path) {
        replacementMediaUrl = await signExerciseMediaUrl(supabase, typedRep.demo_media_path)
      }
    }
  }

  async function updateExercise(formData: FormData) {
    'use server'

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
      redirect('/dashboard')
    }

    const name = String(formData.get('name') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const muscleGroup = String(formData.get('muscle_group') ?? '').trim()
    const difficulty = String(formData.get('difficulty') ?? '').trim()
    const videoUrl = String(formData.get('video_url') ?? '').trim()
    const commonMistakes = String(formData.get('common_mistakes') ?? '').trim()
    const demoMediaPath = String(formData.get('demo_media_path') ?? '').trim()
    const replacementExerciseIdRaw = String(formData.get('replacement_exercise_id') ?? '').trim()

    const replacementExerciseId = replacementExerciseIdRaw || null

    if (!name) {
      redirect(`/admin/exercises/${id}/edit?error=missing_name`)
    }

    const { error } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('exercise_library')
      .update({
        name,
        description: description || null,
        muscle_group: muscleGroup || null,
        difficulty: difficulty || null,
        video_url: videoUrl || null,
        common_mistakes: commonMistakes || null,
        demo_media_path: demoMediaPath || null,
        replacement_exercise_id: replacementExerciseId,
      })
      .eq('id', id)

    if (error) {
      redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(error.message ?? 'unknown_error')}`)
    }

    redirect('/admin/exercises')
  }

  async function deleteExercise() {
    'use server'

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
      redirect('/dashboard')
    }

    const { error } = await (supabase as unknown as { from: (t: string) => UntypedQuery })
      .from('exercise_library')
      .delete()
      .eq('id', id)

    if (error) {
      redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(error.message ?? 'unknown_error')}`)
    }

    redirect('/admin/exercises')
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-[var(--brand)]">Modifier l&apos;exercice</div>
          <div className="mt-1 truncate text-lg font-extrabold text-[var(--brand)]">{typedExercise.name}</div>
        </div>

        <BackButtonClient
          href={backHref}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-white"
          ariaLabel="Retour"
        >
          ←
        </BackButtonClient>
      </div>

      {demoMediaUrl ? (
        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-black/10">
          <img src={demoMediaUrl} alt={typedExercise.name} className="h-48 w-full object-cover" loading="lazy" />
        </div>
      ) : null}

      <form action={updateExercise} className="mt-4 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[var(--brand)]">Nom</span>
          <input name="name" required defaultValue={typedExercise.name} className={inputClassName} />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[var(--brand)]">Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={typedExercise.description ?? ''}
            className={inputClassName}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[var(--brand)]">Groupe musculaire</span>
            <select name="muscle_group" defaultValue={typedExercise.muscle_group ?? ''} className={inputClassName}>
              <option value="">Sélectionner…</option>
              <option value="Pectoraux">Pectoraux</option>
              <option value="Dos">Dos</option>
              <option value="Épaules">Épaules</option>
              <option value="Biceps">Biceps</option>
              <option value="Triceps">Triceps</option>
              <option value="Jambes">Jambes</option>
              <option value="Fessiers">Fessiers</option>
              <option value="Ischios">Ischios</option>
              <option value="Quadriceps">Quadriceps</option>
              <option value="Mollets">Mollets</option>
              <option value="Abdos">Abdos</option>
              <option value="Full body">Full body</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[var(--brand)]">Difficulté</span>
            <select name="difficulty" defaultValue={typedExercise.difficulty ?? ''} className={inputClassName}>
              <option value="">Sélectionner…</option>
              <option value="Débutant">Débutant</option>
              <option value="Intermédiaire">Intermédiaire</option>
              <option value="Avancé">Avancé</option>
              <option value="Maison">Maison (poids du corps / à domicile)</option>
            </select>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[var(--brand)]">URL vidéo</span>
            <input name="video_url" defaultValue={typedExercise.video_url ?? ''} className={inputClassName} />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-extrabold text-[var(--brand)]">Chemin média (Storage)</span>
            <input name="demo_media_path" defaultValue={typedExercise.demo_media_path ?? ''} className={inputClassName} />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[var(--brand)]">Erreurs fréquentes</span>
          <textarea
            name="common_mistakes"
            rows={3}
            defaultValue={typedExercise.common_mistakes ?? ''}
            className={inputClassName}
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-extrabold text-[var(--brand)]">ID exercice de remplacement (optionnel)</span>
          <input
            name="replacement_exercise_id"
            defaultValue={typedExercise.replacement_exercise_id ?? ''}
            className={inputClassName}
          />
        </label>

        {replacement ? (
          <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-black/10">
            <div className="text-xs font-extrabold text-[var(--brand)]">Exercice de remplacement actuel</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/5 ring-1 ring-black/10">
                {replacementMediaUrl ? (
                  <img
                    src={replacementMediaUrl}
                    alt={replacement.name}
                    className={
                      isPngOrGifMedia(replacement.demo_media_path ?? replacementMediaUrl)
                        ? 'h-full w-full object-contain p-2'
                        : 'h-16 w-16 object-cover'
                    }
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-extrabold text-[var(--brand)]">{replacement.name}</div>
                <Link href={`/admin/exercises/${replacement.id}`} className="mt-1 inline-block text-sm text-black/60">
                  Voir la fiche
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Enregistrer
        </button>
      </form>

      <form action={deleteExercise} className="mt-6">
        <button
          type="submit"
          className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Supprimer
        </button>
      </form>
    </main>
  )
}
