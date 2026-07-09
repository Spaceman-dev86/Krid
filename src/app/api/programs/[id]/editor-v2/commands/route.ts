import { NextResponse } from 'next/server'

import type { MinimalCommand } from '../../../../../../domain/program-editor'
import { isTempEntityId } from '../../../../../../domain/program-editor'
import { resolveLibraryExerciseForDbAsync } from '../../../../../../domain/program-editor/blockDbTypes'
import {
  persistBlockDuplicateSnapshot,
  persistSessionDuplicateSnapshot,
  persistTimelineExerciseDuplicate,
  persistWeekDuplicateSnapshot,
} from '../../../../../../lib/persistence/editorDuplicatePersistence'
import {
  persistenceErrorMessage,
  persistTimelineBlockAdd,
  persistTimelineExerciseAdd,
} from '../../../../../../lib/persistence/editorCommandPersistence'
import { shiftWeekSessionOrdersForInsert } from '../../../../../../lib/persistence/sessionOrderPersistence'
import { reorderScopedRowsTwoPass } from '../../../../../../lib/persistence/reorderUniquePositions'
import { resolveTimelineItemIdForPersistence } from '../../../../../../lib/persistence/resolveLegacyTimelineItemId'
import {
  assertCanEditProgram,
  loadProgramEditorRole,
} from '../../../../../../lib/programEditorAccess'
import type { DuplicateContext } from '../../../../../../persistence/buildDuplicateContext'
import { createClient } from '../../../../../../lib/supabase/server'

type Payload = {
  programId: string
  clientRevision: number
  commands: MinimalCommand[]
  duplicateContexts?: (DuplicateContext | null)[]
}

type ErrorBody = { ok: false; error: { code: string; message: string } }
type OkBody = { ok: true; idRemap?: Record<string, string> }

function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json<ErrorBody>({ ok: false, error: { code, message } }, { status })
}

function ensureServerId(id: string, idRemap: Record<string, string>): string {
  if (!isTempEntityId(id)) return id
  if (idRemap[id]) return idRemap[id]
  const serverId = crypto.randomUUID()
  idRemap[id] = serverId
  return serverId
}

async function shiftSessionItems(
  supabase: any,
  sessionId: string,
  fromPosition: number
) {
  // Increment positions >= fromPosition.
  // Note: Supabase doesn't support arithmetic updates in a typed way; use RPC later if needed.
  const { data, error } = await supabase
    .from('session_items')
    .select('id,position')
    .eq('session_id', sessionId)
    .gte('position', fromPosition)
    .order('position', { ascending: false })
  if (error) throw error
  for (const row of data ?? []) {
    const { error: updErr } = await supabase
      .from('session_items')
      .update({ position: Number(row.position) + 1 })
      .eq('id', row.id)
    if (updErr) throw updErr
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  let payload: Payload
  try {
    payload = (await req.json()) as Payload
  } catch {
    return jsonError('payload.invalid', 'Invalid JSON payload.')
  }

  if (!payload || payload.programId !== id) {
    return jsonError('payload.program_mismatch', 'Program id mismatch.')
  }

  // Database types may lag behind new tables (e.g. session_items). Keep API route robust.
  const supabase = (await createClient()) as any
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonError('auth.required', 'Not authenticated.', 401)

  const { isAdmin } = await loadProgramEditorRole(supabase, user.id)
  const access = await assertCanEditProgram(supabase, id, user.id, isAdmin)
  if (!access.ok) {
    return jsonError(access.code, access.message, access.status)
  }

  const idRemap: Record<string, string> = {}

  try {
    const commands = payload.commands ?? []
    for (let i = 0; i < commands.length; i += 1) {
      const cmd = commands[i]
      const dupCtx = payload.duplicateContexts?.[i] ?? null

      switch (cmd.type) {
        case 'program.update': {
          const patch: Record<string, unknown> = {}
          if ('title' in cmd.patch) patch.title = cmd.patch.title
          if ('description' in cmd.patch) patch.description = cmd.patch.description ?? null
          if ('goal' in cmd.patch) patch.goal = cmd.patch.goal ?? null
          if ('level' in cmd.patch) patch.level = cmd.patch.level ?? null
          if ('duration' in cmd.patch) patch.duration = cmd.patch.duration ?? null
          const { error } = await supabase.from('programs').update(patch).eq('id', id)
          if (error) throw error
          break
        }
        case 'week.add': {
          const weekId = ensureServerId(cmd.weekId, idRemap)
          const { data: maxRow, error: maxErr } = await supabase
            .from('program_weeks')
            .select('week_order')
            .eq('program_id', id)
            .order('week_order', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (maxErr) throw maxErr
          const nextOrder = (maxRow?.week_order ?? 0) + 1
          const { error } = await supabase.from('program_weeks').insert({
            id: weekId,
            program_id: id,
            title: cmd.title ?? 'Semaine',
            week_order: nextOrder,
          })
          if (error) throw error
          break
        }
        case 'week.update': {
          const weekId = ensureServerId(cmd.weekId, idRemap)
          const { error } = await supabase
            .from('program_weeks')
            .update({ title: cmd.patch.title })
            .eq('id', weekId)
          if (error) throw error
          break
        }
        case 'week.delete': {
          const weekId = ensureServerId(cmd.weekId, idRemap)
          const { error } = await supabase.from('program_weeks').delete().eq('id', weekId)
          if (error) throw error
          break
        }
        case 'week.reorder': {
          const orderedWeekIds = cmd.weekIds.map((weekId) => ensureServerId(weekId, idRemap))
          await reorderScopedRowsTwoPass(supabase, {
            table: 'program_weeks',
            scopeColumn: 'program_id',
            scopeId: id,
            orderColumn: 'week_order',
            orderedIds: orderedWeekIds,
            finalOrderBase: 1,
          })
          break
        }
        case 'session.add': {
          const sessionId = ensureServerId(cmd.sessionId, idRemap)
          const weekId = ensureServerId(cmd.weekId, idRemap)
          const { data: maxRow, error: maxErr } = await supabase
            .from('sessions')
            .select('session_order')
            .eq('week_id', weekId)
            .order('session_order', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (maxErr) throw maxErr
          const nextOrder = (maxRow?.session_order ?? 0) + 1
          const { error } = await supabase.from('sessions').insert({
            id: sessionId,
            week_id: weekId,
            title: cmd.title ?? 'Nouvelle séance',
            description: null,
            session_order: nextOrder,
          })
          if (error) throw error
          break
        }
        case 'session.update': {
          const sessionId = ensureServerId(cmd.sessionId, idRemap)
          const { error } = await supabase
            .from('sessions')
            .update({ title: cmd.patch.title, description: cmd.patch.description })
            .eq('id', sessionId)
          if (error) throw error
          break
        }
        case 'session.delete': {
          const sessionId = ensureServerId(cmd.sessionId, idRemap)
          const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
          if (error) throw error
          break
        }
        case 'week.sessions.reorder': {
          const weekId = ensureServerId(cmd.weekId, idRemap)
          const orderedSessionIds = cmd.sessionIds.map((sessionId) => ensureServerId(sessionId, idRemap))
          await reorderScopedRowsTwoPass(supabase, {
            table: 'sessions',
            scopeColumn: 'week_id',
            scopeId: weekId,
            orderColumn: 'session_order',
            orderedIds: orderedSessionIds,
            finalOrderBase: 1,
          })
          break
        }
        case 'timeline.exercise.add': {
          await persistTimelineExerciseAdd(supabase, cmd, idRemap, (clientId) =>
            ensureServerId(clientId, idRemap)
          )
          break
        }
        case 'timeline.block.add': {
          await persistTimelineBlockAdd(supabase, cmd, idRemap, (clientId) =>
            ensureServerId(clientId, idRemap)
          )
          break
        }
        case 'timeline.item.delete': {
          const rawTimelineItemId = cmd.timelineItemId
          if (rawTimelineItemId.startsWith('legacy-ex-')) {
            const programExerciseId = ensureServerId(
              rawTimelineItemId.slice('legacy-ex-'.length),
              idRemap
            )
            const { error: siDelErr } = await supabase
              .from('session_items')
              .delete()
              .eq('program_exercise_id', programExerciseId)
            if (siDelErr) throw siDelErr
            const { error: peDelErr } = await supabase
              .from('program_exercises')
              .delete()
              .eq('id', programExerciseId)
            if (peDelErr) throw peDelErr
            break
          }

          let timelineItemId = ensureServerId(rawTimelineItemId, idRemap)
          let { data: si, error: siReadErr } = await supabase
            .from('session_items')
            .select('kind,program_exercise_id,session_block_id,session_id')
            .eq('id', timelineItemId)
            .maybeSingle()
          if (siReadErr) throw siReadErr

          if (!si) {
            const { data: blockRow, error: blockErr } = await supabase
              .from('session_blocks')
              .select('program_session_id')
              .eq('id', rawTimelineItemId)
              .maybeSingle()
            if (blockErr) throw blockErr
            if (blockRow?.program_session_id) {
              const sessionId = ensureServerId(String(blockRow.program_session_id), idRemap)
              timelineItemId = await resolveTimelineItemIdForPersistence(
                supabase,
                sessionId,
                rawTimelineItemId,
                idRemap
              )
              const retry = await supabase
                .from('session_items')
                .select('kind,program_exercise_id,session_block_id,session_id')
                .eq('id', timelineItemId)
                .maybeSingle()
              si = retry.data
              siReadErr = retry.error
              if (siReadErr) throw siReadErr
            }
          }

          const { error: siDelErr } = await supabase.from('session_items').delete().eq('id', timelineItemId)
          if (siDelErr) throw siDelErr

          if (si?.program_exercise_id) {
            const { error } = await supabase.from('program_exercises').delete().eq('id', si.program_exercise_id)
            if (error) throw error
          }
          if (si?.session_block_id) {
            const { error } = await supabase.from('session_blocks').delete().eq('id', si.session_block_id)
            if (error) throw error
          }
          break
        }
        case 'timeline.reorder': {
          const sessionId = ensureServerId(cmd.sessionId, idRemap)
          const orderedItemIds: string[] = []
          for (const itemId of cmd.timelineItemIds) {
            if (isTempEntityId(itemId)) {
              const mapped = idRemap[itemId]
              if (!mapped) {
                throw new Error(`timeline.reorder: unknown temp timeline item ${itemId}`)
              }
              orderedItemIds.push(mapped)
              continue
            }
            orderedItemIds.push(
              await resolveTimelineItemIdForPersistence(supabase, sessionId, itemId, idRemap)
            )
          }
          await reorderScopedRowsTwoPass(supabase, {
            table: 'session_items',
            scopeColumn: 'session_id',
            scopeId: sessionId,
            orderColumn: 'position',
            orderedIds: orderedItemIds,
            finalOrderBase: 0,
          })
          break
        }
        case 'programExercise.update': {
          const programExerciseId = ensureServerId(cmd.programExerciseId, idRemap)
          const payload: Record<string, string | number | null> = {}
          if ('sets' in cmd.patch) payload.sets = cmd.patch.sets ?? null
          if ('reps' in cmd.patch) payload.reps = cmd.patch.reps ?? null
          if ('restTime' in cmd.patch) payload.rest_time = cmd.patch.restTime ?? null
          if ('rpe' in cmd.patch) payload.rpe = cmd.patch.rpe ?? null
          if ('tempo' in cmd.patch) payload.tempo = cmd.patch.tempo ?? null
          if ('load' in cmd.patch) payload.load = cmd.patch.load ?? null
          if ('notes' in cmd.patch) payload.notes = cmd.patch.notes ?? null
          if (Object.keys(payload).length === 0) break
          const { error } = await supabase.from('program_exercises').update(payload).eq('id', programExerciseId)
          if (error) throw error
          break
        }
        case 'block.update': {
          const blockId = ensureServerId(cmd.blockId, idRemap)
          const { error } = await supabase.from('session_blocks').update({
            title: cmd.patch.title ?? null,
            notes: cmd.patch.notes ?? null,
          }).eq('id', blockId)
          if (error) throw error
          break
        }
        case 'blockExercise.add': {
          const blockId = ensureServerId(cmd.blockId, idRemap)
          const blockExerciseId = ensureServerId(cmd.blockExerciseId, idRemap)
          const { data: maxRow, error: maxErr } = await supabase
            .from('block_exercises')
            .select('position')
            .eq('session_block_id', blockId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (maxErr) throw maxErr
          const nextPos = (maxRow?.position ?? -1) + 1
          const resolvedBe = await resolveLibraryExerciseForDbAsync(supabase, cmd.libraryExerciseId)
          const { error } = await supabase.from('block_exercises').insert({
            id: blockExerciseId,
            session_block_id: blockId,
            position: nextPos,
            exercise_id: resolvedBe.exercise_id,
            exercise_name: resolvedBe.exercise_name,
            notes: null,
          })
          if (error) throw error
          break
        }
        case 'blockExercise.update': {
          const blockExerciseId = ensureServerId(cmd.blockExerciseId, idRemap)
          const payload: Record<string, string | null> = {}
          if ('notes' in cmd.patch) payload.notes = cmd.patch.notes ?? null
          if ('exerciseName' in cmd.patch) payload.exercise_name = cmd.patch.exerciseName ?? null
          if (Object.keys(payload).length === 0) break
          const { error } = await supabase.from('block_exercises').update(payload).eq('id', blockExerciseId)
          if (error) throw error
          break
        }
        case 'blockExercise.delete': {
          const blockExerciseId = ensureServerId(cmd.blockExerciseId, idRemap)
          const { error } = await supabase.from('block_exercises').delete().eq('id', blockExerciseId)
          if (error) throw error
          break
        }
        case 'blockExercise.reorder': {
          const blockId = ensureServerId(cmd.blockId, idRemap)
          const orderedBlockExerciseIds = cmd.blockExerciseIds.map((beId) => ensureServerId(beId, idRemap))
          await reorderScopedRowsTwoPass(supabase, {
            table: 'block_exercises',
            scopeColumn: 'session_block_id',
            scopeId: blockId,
            orderColumn: 'position',
            orderedIds: orderedBlockExerciseIds,
            finalOrderBase: 0,
          })
          break
        }
        case 'week.duplicate': {
          if (dupCtx?.kind !== 'week.duplicate') {
            return jsonError('duplicate.context_missing', 'week.duplicate requires client snapshot.', 400)
          }
          await persistWeekDuplicateSnapshot(supabase, id, dupCtx.snapshot, (clientId) =>
            ensureServerId(clientId, idRemap)
          )
          break
        }
        case 'session.duplicate': {
          if (dupCtx?.kind !== 'session.duplicate') {
            return jsonError('duplicate.context_missing', 'session.duplicate requires client snapshot.', 400)
          }
          const sourceSessionId = ensureServerId(cmd.sourceSessionId, idRemap)
          const { data: srcSession, error: srcErr } = await supabase
            .from('sessions')
            .select('session_order')
            .eq('id', sourceSessionId)
            .maybeSingle()
          if (srcErr) throw srcErr
          const sessionOrder =
            typeof srcSession?.session_order === 'number' ? srcSession.session_order + 1 : undefined
          if (sessionOrder != null) {
            const weekId = ensureServerId(dupCtx.snapshot.session.weekId, idRemap)
            await shiftWeekSessionOrdersForInsert(supabase, weekId, sessionOrder)
          }
          await persistSessionDuplicateSnapshot(supabase, dupCtx.snapshot, (clientId) =>
            ensureServerId(clientId, idRemap), sessionOrder != null ? { sessionOrder } : undefined
          )
          break
        }
        case 'timeline.exercise.duplicate': {
          await persistTimelineExerciseDuplicate(
            supabase,
            cmd.sourceTimelineItemId,
            cmd.newTimelineItemId,
            cmd.newProgramExerciseId,
            idRemap,
            (clientId) => ensureServerId(clientId, idRemap)
          )
          break
        }
        case 'timeline.block.duplicate': {
          if (dupCtx?.kind !== 'timeline.block.duplicate') {
            return jsonError('duplicate.context_missing', 'timeline.block.duplicate requires client snapshot.', 400)
          }
          await persistBlockDuplicateSnapshot(
            supabase,
            cmd.sourceTimelineItemId,
            dupCtx.snapshot,
            idRemap,
            (clientId) => ensureServerId(clientId, idRemap)
          )
          break
        }
        default: {
          const unsupported = cmd as MinimalCommand
          return jsonError(
            'command.not_supported',
            `Command ${unsupported.type} is not yet supported by persistence.`,
            409
          )
        }
      }
    }
  } catch (err) {
    return jsonError('persistence.failed', persistenceErrorMessage(err), 500)
  }

  return NextResponse.json<OkBody>({ ok: true, idRemap: Object.keys(idRemap).length ? idRemap : undefined })
}

