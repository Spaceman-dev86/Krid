import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

type UntypedInsertResult = { error: { message?: string } | null }
type UntypedInsertQuery = {
  insert: (values: Record<string, unknown>) => Promise<UntypedInsertResult>
}

export default async function NewExercisePage() {
  async function createExercise(formData: FormData) {
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
      redirect('/admin/exercises/new?error=missing_name')
    }

    const { error } = await (supabase as unknown as { from: (t: string) => UntypedInsertQuery })
      .from('exercise_library')
      .insert({
      name,
      description: description || null,
      muscle_group: muscleGroup || null,
      difficulty: difficulty || null,
      video_url: videoUrl || null,
      common_mistakes: commonMistakes || null,
      demo_media_path: demoMediaPath || null,
      replacement_exercise_id: replacementExerciseId,
    })

    if (error) {
      redirect(`/admin/exercises/new?error=${encodeURIComponent(error.message ?? 'unknown_error')}`)
    }

    redirect('/admin/exercises')
  }

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Nouvel exercice</h1>
        <Link href="/admin/exercises" style={{ textDecoration: 'none', color: '#111827' }}>
          Retour
        </Link>
      </div>

      <form action={createExercise} style={{ marginTop: 16, display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Nom</span>
          <input
            name="name"
            required
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Groupe musculaire</span>
          <select
            name="muscle_group"
            defaultValue=""
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
            defaultValue=""
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
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span>Chemin média (Storage)</span>
            <input
              name="demo_media_path"
              style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
            />
          </label>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Problèmes fréquents</span>
          <textarea
            name="common_mistakes"
            rows={3}
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>ID exercice de remplacement (optionnel)</span>
          <input
            name="replacement_exercise_id"
            style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}
          />
        </label>

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
          Créer
        </button>
      </form>
    </section>
  )
}
