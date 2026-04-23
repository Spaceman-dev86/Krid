import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

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

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function EditExercisePage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
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
      'id,name,description,muscle_group,difficulty,video_url,common_mistakes,demo_media_path,replacement_exercise_id,created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !exercise) {
    redirect('/admin/exercises')
  }

  const storageBucket = 'exercise-media'

  let demoMediaUrl: string | null = null
  let demoMediaError: string | null = null
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
    created_at: string | null
  }

  if (typedExercise.demo_media_path) {
    if (/^https?:\/\//i.test(typedExercise.demo_media_path)) {
      demoMediaUrl = typedExercise.demo_media_path
    } else {
      const { data, error } = await supabase.storage
        .from(storageBucket)
        .createSignedUrl(typedExercise.demo_media_path, 60 * 60)
      demoMediaUrl = data?.signedUrl ?? null
      demoMediaError = error?.message ?? null
    }
  }

  let replacement: { id: string; name: string; demo_media_path: string | null } | null = null
  let replacementMediaUrl: string | null = null
  let replacementMediaError: string | null = null

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
        if (/^https?:\/\//i.test(typedRep.demo_media_path)) {
          replacementMediaUrl = typedRep.demo_media_path
        } else {
          const { data, error } = await supabase.storage
            .from(storageBucket)
            .createSignedUrl(typedRep.demo_media_path, 60 * 60)
          replacementMediaUrl = data?.signedUrl ?? null
          replacementMediaError = error?.message ?? null
        }
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
      redirect('/login')
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
      redirect(`/admin/exercises/${id}?error=missing_name`)
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
      redirect(`/admin/exercises/${id}?error=${encodeURIComponent(error.message ?? 'unknown_error')}`)
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
      redirect('/login')
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
      redirect(`/admin/exercises/${id}?error=${encodeURIComponent(error.message ?? 'unknown_error')}`)
    }

    redirect('/admin/exercises')
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Exercice</h1>
        <Link href="/admin/exercises" style={{ textDecoration: 'none', color: '#111827' }}>
          Retour
        </Link>
      </div>

      {typedExercise.video_url ? (
        <p style={{ marginTop: 12 }}>
          <a href={typedExercise.video_url} target="_blank" rel="noreferrer" style={{ color: '#111827' }}>
            Ouvrir la vidéo
          </a>
        </p>
      ) : null}

      {demoMediaUrl ? (
        <div style={{ marginTop: 12 }}>
          <img
            src={demoMediaUrl}
            alt={typedExercise.name}
            style={{ maxWidth: 420, width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
        </div>
      ) : typedExercise.demo_media_path ? (
        <p style={{ marginTop: 12, color: '#b91c1c' }}>
          Impossible de charger le média ({typedExercise.demo_media_path})
          {demoMediaError ? `: ${demoMediaError}` : ''}
        </p>
      ) : null}

      <form action={updateExercise} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Nom</span>
          <input
            name="name"
            required
            defaultValue={typedExercise.name}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={typedExercise.description ?? ''}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Groupe musculaire</span>
          <select
            name="muscle_group"
            defaultValue={typedExercise.muscle_group ?? ''}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          >
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

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Difficulté</span>
          <select
            name="difficulty"
            defaultValue={typedExercise.difficulty ?? ''}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          >
            <option value="">Sélectionner…</option>
            <option value="Débutant">Débutant</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Avancé">Avancé</option>
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>URL vidéo</span>
            <input
              name="video_url"
              defaultValue={typedExercise.video_url ?? ''}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Chemin média (Storage)</span>
            <input
              name="demo_media_path"
              defaultValue={typedExercise.demo_media_path ?? ''}
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Erreurs fréquentes</span>
          <textarea
            name="common_mistakes"
            rows={3}
            defaultValue={typedExercise.common_mistakes ?? ''}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>ID exercice de remplacement (optionnel)</span>
          <input
            name="replacement_exercise_id"
            defaultValue={typedExercise.replacement_exercise_id ?? ''}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        {replacement ? (
          <div style={{ marginTop: 4, padding: 12, border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <strong>{replacement.name}</strong>
              <Link href={`/admin/exercises/${replacement.id}`} style={{ textDecoration: 'none', color: '#111827' }}>
                Ouvrir
              </Link>
            </div>
            {replacementMediaUrl ? (
              <div style={{ marginTop: 10 }}>
                <img
                  src={replacementMediaUrl}
                  alt={replacement.name}
                  style={{ maxWidth: 420, width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </div>
            ) : replacement.demo_media_path ? (
              <p style={{ marginTop: 10, color: '#b91c1c' }}>
                Impossible de charger le média ({replacement.demo_media_path})
                {replacementMediaError ? `: ${replacementMediaError}` : ''}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #111827',
            background: '#111827',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Enregistrer
        </button>
      </form>

      <form action={deleteExercise} style={{ marginTop: 16 }}>
        <button
          type="submit"
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #ef4444',
            background: '#ef4444',
            color: '#ffffff',
            cursor: 'pointer',
          }}
        >
          Supprimer
        </button>
      </form>
    </section>
  )
}
