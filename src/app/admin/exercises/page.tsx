import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

type ExerciseListRow = {
  id: string
  name: string
  muscle_group: string | null
  difficulty: string | null
  demo_media_path?: string | null
}

type ExerciseListItem = ExerciseListRow & {
  thumb_url?: string | null
}

function normalizeDemoMediaPath(input: string) {
  const cleaned = input.replace(/^\/+/, '').trim()
  if (cleaned.toLowerCase().startsWith('exercise-media/')) {
    return cleaned.slice('exercise-media/'.length)
  }
  return cleaned
}

export default async function AdminExercisesPage() {
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

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  let exercises: ExerciseListRow[] | null = null
  let errorMessage: string | null = null

  const storageBucket = 'exercise-media'

  const withMedia = await supabase
    .from('exercise_library')
    .select('id,name,muscle_group,difficulty,demo_media_path')
    .order('created_at', { ascending: false })

  if (withMedia.error) {
    const fallback = await supabase
      .from('exercise_library')
      .select('id,name,muscle_group,difficulty')
      .order('created_at', { ascending: false })
    exercises = fallback.data as unknown as ExerciseListRow[] | null
    errorMessage = fallback.error ? fallback.error.message : null
  } else {
    exercises = withMedia.data as unknown as ExerciseListRow[] | null
    errorMessage = null
  }

  const items: ExerciseListItem[] | null = exercises
    ? await Promise.all(
        exercises.map(async (e) => {
          const raw = e.demo_media_path ?? null
          if (!raw) return e

          const isUrl = /^https?:\/\//i.test(raw)
          if (isUrl) {
            return { ...e, thumb_url: raw }
          }

          const path = normalizeDemoMediaPath(raw)
          const signed = await supabase.storage.from(storageBucket).createSignedUrl(path, 60 * 60)
          if (!signed.error && signed.data?.signedUrl) {
            return { ...e, thumb_url: signed.data.signedUrl }
          }

          return e
        }),
      )
    : null

  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Bibliothèque d’exercices</h1>
        <Link
          href="/admin"
          aria-label="Retour admin"
          title="Retour admin"
          style={{ textDecoration: 'none', color: '#111827', fontSize: 20, lineHeight: 1 }}
        >
          ←
        </Link>
      </div>

      {errorMessage ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{errorMessage}</p> : null}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
        <p style={{ color: '#6b7280', margin: 0 }}>{items ? `${items.length} exercice(s)` : '0 exercice'}</p>
        <Link
          href="/admin/exercises/new"
          aria-label="Créer un exercice"
          title="Créer un exercice"
          style={{
            display: 'inline-flex',
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            background: 'var(--brand)',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 800,
            textDecoration: 'none',
            flex: '0 0 auto',
          }}
        >
          +
        </Link>
      </div>

      {items && items.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'grid', gap: 10 }}>
          {items.map((e: ExerciseListItem) => (
            <li key={e.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 12, overflow: 'hidden', background: '#f3f4f6', flex: '0 0 auto' }}>
                  {e.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={e.thumb_url}
                      alt=""
                      width={72}
                      height={72}
                      style={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }}
                    />
                  ) : null}
                </div>

                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <Link
                    href={`/admin/exercises/${e.id}`}
                    style={{ textDecoration: 'none', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                  >
                    <strong>{e.name}</strong>
                  </Link>
                  <div style={{ color: '#6b7280', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>{e.muscle_group ?? ''}</span>
                    <span>{e.difficulty ?? ''}</span>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ color: '#6b7280', marginTop: 16 }}>Aucun exercice.</p>
      )}
    </section>
  )
}
