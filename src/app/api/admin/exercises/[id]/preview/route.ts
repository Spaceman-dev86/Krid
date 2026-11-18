import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import { signExerciseMediaUrl } from '@/src/lib/exerciseMedia'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: raw, error } = await supabase
    .from('exercise_library')
    .select(
      'id,name,description,muscle_group,difficulty,named_notes,exercise_type_id,sport_id,status,demo_media_path,video_url',
    )
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!raw) return NextResponse.json({ error: 'Exercice introuvable' }, { status: 404 })

  const row = raw as {
    id: string
    name: string
    description: string | null
    muscle_group: string | null
    difficulty: string | null
    named_notes: unknown
    exercise_type_id: string | null
    sport_id: string | null
    status: string | null
    demo_media_path: string | null
    video_url: string | null
  }

  const namedNotes = Array.isArray(row.named_notes)
    ? (row.named_notes as { title?: unknown; body?: unknown }[])
        .map((n) => ({
          title: String(n?.title ?? '').trim(),
          body: String(n?.body ?? '').trim(),
        }))
        .filter((n) => n.title || n.body)
    : []

  const demoMediaPath = row.demo_media_path?.trim() || null
  const videoUrl = row.video_url?.trim() || null

  const [sportRes, typeRes, demoMediaUrl] = await Promise.all([
    row.sport_id
      ? supabase
          .from('sports' as never)
          .select('label')
          .eq('id' as never, row.sport_id as never)
          .maybeSingle()
      : Promise.resolve({ data: null as { label?: string } | null }),
    row.exercise_type_id
      ? supabase
          .from('exercise_types' as never)
          .select('label')
          .eq('id' as never, row.exercise_type_id as never)
          .maybeSingle()
      : Promise.resolve({ data: null as { label?: string } | null }),
    signExerciseMediaUrl(supabase, demoMediaPath),
  ])

  const sportLabel = (sportRes.data as { label?: string } | null)?.label?.trim() || null
  const typeLabel = (typeRes.data as { label?: string } | null)?.label?.trim() || null

  return NextResponse.json({
    preview: {
      id: row.id,
      name: row.name,
      status: row.status,
      description: row.description,
      muscleGroup: row.muscle_group,
      difficulty: row.difficulty,
      namedNotes,
      sportLabel,
      typeLabel,
      demoMediaPath,
      demoMediaUrl,
      videoUrl,
    },
  })
}
