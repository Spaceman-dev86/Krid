export function formatProgramDurationLabel(input: {
  duration: string | null | undefined
  weeksCount: number
}): string {
  const custom = String(input.duration ?? '').trim()
  if (custom) return custom

  const weeks = Math.max(0, input.weeksCount)
  if (weeks > 0) {
    return `${weeks} semaine${weeks > 1 ? 's' : ''}`
  }

  return '—'
}

export function durationLabelFromWeekCount(weeksCount: number): string | null {
  const weeks = Math.max(0, weeksCount)
  if (weeks <= 0) return null
  return `${weeks} semaine${weeks > 1 ? 's' : ''}`
}

export function formatProgramGoalLabel(goal: string | null | undefined): string {
  const value = String(goal ?? '').trim()
  return value || 'Objectif —'
}
