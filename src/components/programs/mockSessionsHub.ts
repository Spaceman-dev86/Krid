/** Données factices séances — UI hub (même cycle que exos/blocs). */

export type MockSessionRow = {
  id: string
  name: string
  sport_label: string | null
  type_labels: string[]
  exercise_count: number
  source_kind?: 'krid' | 'coach' | null
}

export const MOCK_SESSION_SPORTS = [
  { id: 'sp1', label: 'CrossFit' },
  { id: 'sp2', label: 'Musculation' },
  { id: 'sp3', label: 'Hyrox' },
]

export const MOCK_SESSION_TYPES = [
  { id: 'ty1', label: 'Force' },
  { id: 'ty2', label: 'Cardio' },
  { id: 'ty3', label: 'Mobilité' },
]

export const MOCK_SESSIONS_MINE: MockSessionRow[] = [
  {
    id: 'sm1',
    name: 'Full body A',
    sport_label: 'CrossFit',
    type_labels: ['Force', 'Cardio'],
    exercise_count: 4,
    source_kind: 'krid',
  },
  {
    id: 'sm2',
    name: 'Upper push',
    sport_label: 'Musculation',
    type_labels: ['Force'],
    exercise_count: 6,
    source_kind: 'coach',
  },
  {
    id: 'sm3',
    name: 'Hyrox engine',
    sport_label: 'Hyrox',
    type_labels: ['Cardio'],
    exercise_count: 5,
    source_kind: 'coach',
  },
]

export const MOCK_SESSIONS_KRID: MockSessionRow[] = [
  {
    id: 'sk1',
    name: 'Krid — AMRAP 12′',
    sport_label: 'CrossFit',
    type_labels: ['Cardio'],
    exercise_count: 3,
  },
  {
    id: 'sk2',
    name: 'Krid — Lower strength',
    sport_label: 'Musculation',
    type_labels: ['Force'],
    exercise_count: 5,
  },
]

export const MOCK_SESSIONS_DRAFT: MockSessionRow[] = [
  {
    id: 'sd1',
    name: 'Séance brouillon',
    sport_label: 'Musculation',
    type_labels: ['Force'],
    exercise_count: 2,
    source_kind: 'coach',
  },
]

export function filterMockSessions(
  rows: MockSessionRow[],
  opts: { q?: string; sport?: string; type?: string },
) {
  const q = (opts.q ?? '').trim().toLowerCase()
  const sport = (opts.sport ?? '').trim()
  const type = (opts.type ?? '').trim()
  return rows.filter((r) => {
    if (q && !r.name.toLowerCase().includes(q)) return false
    if (sport && r.sport_label !== sport) return false
    if (type && !r.type_labels.includes(type)) return false
    return true
  })
}
