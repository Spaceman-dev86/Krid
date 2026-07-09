import { resolveProgramExerciseLabel } from '../../../domain/program-editor/devExerciseLibrary'
import type { MinimalProgramDocument } from '../../../domain/program-editor'

export function buildSessionTimelineSummary(doc: MinimalProgramDocument, sessionId: string): string {
  const session = doc.entities.sessions[sessionId]
  if (!session) return ''

  const parts: string[] = []
  for (const itemId of session.timelineItemIds) {
    const item = doc.entities.timelineItems[itemId]
    if (!item) continue

    if (item.kind === 'block' && item.sessionBlockId) {
      const block = doc.entities.sessionBlocks[item.sessionBlockId]
      parts.push(block?.title?.trim() || 'Bloc')
      continue
    }

    if (item.kind === 'exercise' && item.programExerciseId) {
      const pe = doc.entities.programExercises[item.programExerciseId] ?? null
      parts.push(resolveProgramExerciseLabel(item.programExerciseId, pe))
    }
  }

  return parts.slice(0, 6).join(' · ')
}
