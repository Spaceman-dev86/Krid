import { normalizeDifficulty } from './ficheConstants'

export type NamedNote = { title: string; body: string }
export type BridgeRow = { title: string; note: string; exerciseId: string }

export function parseNamedNotes(formData: FormData): NamedNote[] {
  const titles = formData.getAll('note_titles').map((v) => String(v ?? '').trim())
  const bodies = formData.getAll('note_bodies').map((v) => String(v ?? '').trim())
  const len = Math.max(titles.length, bodies.length)
  const out: NamedNote[] = []
  for (let i = 0; i < len; i++) {
    const title = titles[i] ?? ''
    const body = bodies[i] ?? ''
    if (!title && !body) continue
    out.push({ title: title || 'Note', body })
  }
  return out
}

export function parseBridges(formData: FormData): BridgeRow[] {
  const titles = formData.getAll('bridge_titles').map((v) => String(v ?? '').trim())
  const notes = formData.getAll('bridge_notes').map((v) => String(v ?? '').trim())
  const ids = formData.getAll('bridge_exercise_ids').map((v) => String(v ?? '').trim())
  const len = Math.max(titles.length, notes.length, ids.length)
  const out: BridgeRow[] = []
  for (let i = 0; i < len; i++) {
    const exerciseId = ids[i] ?? ''
    if (!exerciseId) continue
    out.push({
      title: titles[i] || 'Remplacement',
      note: notes[i] ?? '',
      exerciseId,
    })
  }
  return out
}

export function readExerciseFicheFields(formData: FormData) {
  return {
    name: String(formData.get('name') ?? '').trim(),
    exerciseTypeId: String(formData.get('exercise_type_id') ?? '').trim(),
    sportId: String(formData.get('sport_id') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    muscleGroup: String(formData.get('muscle_group') ?? '').trim(),
    difficulty: normalizeDifficulty(String(formData.get('difficulty') ?? '')),
    videoUrl: String(formData.get('video_url') ?? '').trim(),
    demoMediaPath: String(formData.get('demo_media_path') ?? '').trim(),
    namedNotes: parseNamedNotes(formData),
    bridges: parseBridges(formData),
  }
}
