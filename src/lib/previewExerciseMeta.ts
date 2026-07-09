export type PreviewExerciseMetaInput = {
  sets?: number | string | null
  reps?: number | string | null
  restTime?: string | number | null
  restSeconds?: number | null
  rpe?: number | string | null
  tempo?: string | null
  load?: string | null
  loadText?: string | null
}

function formatRestValue(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null
    if (raw >= 60 && raw % 60 === 0) return `${raw / 60} min`
    if (raw >= 60) return `${Math.round(raw / 60)} min`
    return `${raw} s`
  }
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (/[a-zA-Z]/.test(trimmed)) return trimmed
  return `${trimmed} min`
}

function formatLoadValue(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (/[a-zA-Z]/.test(trimmed)) return trimmed
  return `${trimmed} Kg`
}

function formatCountValue(raw: number | string | null | undefined, label: string): string | null {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  return `${trimmed} ${label}`
}

export function buildPreviewExerciseMetaLine(input: PreviewExerciseMetaInput): string {
  const restValue =
    formatRestValue(input.restTime) ??
    (input.restSeconds != null ? formatRestValue(input.restSeconds) : null)
  const loadValue = formatLoadValue(input.load ?? input.loadText ?? null)

  return [
    formatCountValue(input.sets, 'séries'),
    formatCountValue(input.reps, 'reps'),
    restValue ? `repos ${restValue}` : null,
    input.rpe != null && String(input.rpe).trim() ? `RPE ${String(input.rpe).trim()}` : null,
    input.tempo ? `tempo ${String(input.tempo).trim()}` : null,
    loadValue ? `charge ${loadValue}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
