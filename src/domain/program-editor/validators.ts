import type { MinimalProgramDocument } from './minimalDocument'

export type ValidationIssue = {
  code: string
  message: string
}

export function validateMinimalDocument(doc: MinimalProgramDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { entities } = doc

  const sessionIdsInWeeks = new Set<string>()
  const referencedTimelineItemIds = new Set<string>()
  const referencedBlockIds = new Set<string>()
  const referencedBlockExerciseIds = new Set<string>()
  const referencedProgramExerciseIds = new Set<string>()

  for (const week of doc.weeks) {
    if (!week.id.trim()) {
      issues.push({ code: 'week.empty_id', message: 'Week id must be non-empty' })
    }

    const seenSessionInWeek = new Set<string>()
    for (const sessionId of week.sessionIds) {
      if (seenSessionInWeek.has(sessionId)) {
        issues.push({
          code: 'week.duplicate_session',
          message: `Week ${week.id} lists session ${sessionId} more than once`,
        })
      }
      seenSessionInWeek.add(sessionId)
      sessionIdsInWeeks.add(sessionId)

      const session = entities.sessions[sessionId]
      if (!session) {
        issues.push({
          code: 'week.missing_session',
          message: `Week ${week.id} references unknown session ${sessionId}`,
        })
        continue
      }
      if (session.weekId !== week.id) {
        issues.push({
          code: 'session.week_mismatch',
          message: `Session ${sessionId} belongs to week ${session.weekId}, not ${week.id}`,
        })
      }

      const seenTimelineInSession = new Set<string>()
      for (const itemId of session.timelineItemIds) {
        if (seenTimelineInSession.has(itemId)) {
          issues.push({
            code: 'session.duplicate_timeline_item',
            message: `Session ${sessionId} lists timeline item ${itemId} more than once`,
          })
        }
        seenTimelineInSession.add(itemId)
        referencedTimelineItemIds.add(itemId)

        const item = entities.timelineItems[itemId]
        if (!item) {
          issues.push({
            code: 'session.missing_timeline_item',
            message: `Session ${sessionId} references unknown timeline item ${itemId}`,
          })
          continue
        }
        if (item.sessionId !== sessionId) {
          issues.push({
            code: 'timeline_item.session_mismatch',
            message: `Timeline item ${itemId} belongs to session ${item.sessionId}, not ${sessionId}`,
          })
        }

        if (item.kind === 'exercise') {
          if (!item.programExerciseId) {
            issues.push({
              code: 'timeline_item.exercise_missing_ref',
              message: `Exercise timeline item ${itemId} must have programExerciseId`,
            })
          } else {
            referencedProgramExerciseIds.add(item.programExerciseId)
            if (!entities.programExercises[item.programExerciseId]) {
              issues.push({
                code: 'timeline_item.missing_program_exercise',
                message: `Timeline item ${itemId} references unknown program exercise ${item.programExerciseId}`,
              })
            }
          }
          if (item.sessionBlockId) {
            issues.push({
              code: 'timeline_item.exercise_has_block_ref',
              message: `Exercise timeline item ${itemId} must not have sessionBlockId`,
            })
          }
        } else if (item.kind === 'block') {
          if (!item.sessionBlockId) {
            issues.push({
              code: 'timeline_item.block_missing_ref',
              message: `Block timeline item ${itemId} must have sessionBlockId`,
            })
          }
          if (item.programExerciseId) {
            issues.push({
              code: 'timeline_item.block_has_exercise_ref',
              message: `Block timeline item ${itemId} must not have programExerciseId`,
            })
          }
          if (item.sessionBlockId) {
            referencedBlockIds.add(item.sessionBlockId)
            const block = entities.sessionBlocks[item.sessionBlockId]
            if (!block) {
              issues.push({
                code: 'timeline_item.missing_block',
                message: `Timeline item ${itemId} references unknown block ${item.sessionBlockId}`,
              })
            } else if (block.sessionId !== sessionId) {
              issues.push({
                code: 'block.session_mismatch',
                message: `Block ${block.id} belongs to session ${block.sessionId}, not ${sessionId}`,
              })
            }
          }
        } else {
          issues.push({
            code: 'timeline_item.invalid_kind',
            message: `Timeline item ${itemId} has invalid kind`,
          })
        }
      }
    }
  }

  for (const block of Object.values(entities.sessionBlocks)) {
    const seenBe = new Set<string>()
    for (const beId of block.blockExerciseIds) {
      if (seenBe.has(beId)) {
        issues.push({
          code: 'block.duplicate_block_exercise',
          message: `Block ${block.id} lists block exercise ${beId} more than once`,
        })
      }
      seenBe.add(beId)
      referencedBlockExerciseIds.add(beId)

      const be = entities.blockExercises[beId]
      if (!be) {
        issues.push({
          code: 'block.missing_block_exercise',
          message: `Block ${block.id} references unknown block exercise ${beId}`,
        })
        continue
      }
      if (be.blockId !== block.id) {
        issues.push({
          code: 'block_exercise.block_mismatch',
          message: `Block exercise ${beId} belongs to block ${be.blockId}, not ${block.id}`,
        })
      }
    }

    if (!referencedBlockIds.has(block.id)) {
      issues.push({
        code: 'block.orphan',
        message: `Block ${block.id} is not referenced by any timeline item`,
      })
    }
  }

  for (const sessionId of Object.keys(entities.sessions)) {
    if (!sessionIdsInWeeks.has(sessionId)) {
      issues.push({
        code: 'session.orphan',
        message: `Session ${sessionId} is not listed in any week`,
      })
    }
  }

  for (const itemId of Object.keys(entities.timelineItems)) {
    if (!referencedTimelineItemIds.has(itemId)) {
      issues.push({
        code: 'timeline_item.orphan',
        message: `Timeline item ${itemId} is not listed in any session`,
      })
    }
  }

  for (const beId of Object.keys(entities.blockExercises)) {
    if (!referencedBlockExerciseIds.has(beId)) {
      issues.push({
        code: 'block_exercise.orphan',
        message: `Block exercise ${beId} is not listed in any block`,
      })
    }
  }

  return issues
}

export function assertValidMinimalDocument(doc: MinimalProgramDocument): void {
  const issues = validateMinimalDocument(doc)
  if (issues.length > 0) {
    const detail = issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid MinimalProgramDocument: ${detail}`)
  }
}
