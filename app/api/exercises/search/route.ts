import { NextResponse } from 'next/server'
import { createClient } from '../../../../src/lib/supabase/server'

type ExerciseLibraryRow = {
  id: string
  name: string | null
  muscle_group: string | null
  difficulty: string | null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const q = String(url.searchParams.get('q') ?? '').trim()

    if (!q) {
      return NextResponse.json({ exercises: [] })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('exercise_library')
      .select('id,name,muscle_group,difficulty')
      .ilike('name', `%${q}%`)
      .order('name', { ascending: true })
      .limit(12)

    if (error) {
      return NextResponse.json({ error: error.message, exercises: [] }, { status: 500 })
    }

    const exercises = ((data ?? []) as ExerciseLibraryRow[]).map((row) => ({
      id: row.id,
      name: row.name ?? '',
      muscle_group: row.muscle_group,
      difficulty: row.difficulty,
    }))

    return NextResponse.json({ exercises })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message, exercises: [] }, { status: 500 })
  }
}
