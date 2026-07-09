'use client'

import { memo, useCallback } from 'react'

import { createTempId } from '../../domain/program-editor'
import { resolveProgramExerciseLabel } from '../../domain/program-editor/devExerciseLibrary'
import { EDITOR_CLS } from './editorLayoutConstants'
import useBlockExerciseDisplayName from './useBlockExerciseDisplayName'
import { useApplyCommand, useBlockExercise, useBlockExerciseIds, useProgramExercise, useSessionBlock, useTimelineItem } from '../../store/program-editor'
import {
  useIsBlockExpanded,
  useProgramEditorUiStore,
} from '../../store/program-editor/uiStore'
import ExerciseEditFields from './ExerciseEditFields'
import BlockExerciseSortableList from './BlockExerciseSortableList'
import BlockDropZone from './dnd/BlockDropZone'
import { useExerciseLibraryCatalog } from './ExerciseLibraryContext'
import ExerciseLibraryPicker from './ui/ExerciseLibraryPicker'
import { IconChevron, IconDuplicate, IconTrash } from './ui/EditorIcons'
import InlineCommitField from './ui/InlineCommitField'
import { EDITOR_ICON_GAP } from './ui/editorIconLayout'
import ToolbarIconButton from './ui/ToolbarIconButton'
import {
  formatProgramExerciseDetails,
  hasProgramExerciseDetails,
} from './utils/formatProgramExerciseDetails'

type Props = {
  itemId: string
  compact?: boolean
}

function BlockExercisePreview({ blockExerciseId }: { blockExerciseId: string }) {
  const row = useBlockExercise(blockExerciseId)
  const name = useBlockExerciseDisplayName(row)
  if (!row) return null
  return (
    <div className={`grid min-w-0 items-start gap-0.5 ${EDITOR_CLS.gridPairUntil868}`}>
      <div className="min-w-0 truncate pr-2 text-xs font-semibold text-[var(--brand)]">{name}</div>
      {row.notes ? (
        <div className="min-w-0 truncate border-l border-gray-200 pl-2 text-left text-[11px] text-gray-600">
          {row.notes}
        </div>
      ) : null}
    </div>
  )
}

function BlockTimelineItem({
  blockId,
  itemId,
  dragCompact,
}: {
  blockId: string
  itemId: string
  dragCompact?: boolean
}) {
  const block = useSessionBlock(blockId)
  const exerciseIds = useBlockExerciseIds(blockId)
  const { exercises: libraryExercises } = useExerciseLibraryCatalog()
  const applyCommand = useApplyCommand()
  const isExpanded = useIsBlockExpanded(blockId)
  const toggleBlockExpanded = useProgramEditorUiStore((s) => s.toggleBlockExpanded)
  const setBlockExpanded = useProgramEditorUiStore((s) => s.setBlockExpanded)

  const duplicateBlock = useCallback(() => {
    const newBlockId = createTempId('block')
    const newTimelineItemId = createTempId('item')
    applyCommand({
      type: 'timeline.block.duplicate',
      sourceTimelineItemId: itemId,
      newTimelineItemId,
      newBlockId,
    })
    setBlockExpanded(newBlockId, true)
  }, [applyCommand, itemId, setBlockExpanded])

  const deleteBlock = useCallback(() => {
    applyCommand({ type: 'timeline.item.delete', timelineItemId: itemId })
    if (useProgramEditorUiStore.getState().expandedBlockId === blockId) {
      useProgramEditorUiStore.getState().setBlockExpanded(blockId, false)
    }
  }, [applyCommand, blockId, itemId])

  const addBlockExercise = useCallback(
    (libraryExerciseId: string) => {
      const blockExerciseId = createTempId('be')
      const exerciseName = libraryExercises.find((e) => e.id === libraryExerciseId)?.name
      applyCommand({
        type: 'blockExercise.add',
        blockId,
        blockExerciseId,
        libraryExerciseId,
        exerciseName: exerciseName ?? null,
      })
    },
    [applyCommand, blockId, libraryExercises]
  )

  if (!block) return null

  if (dragCompact) {
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-[var(--brand)]">{block.title ?? 'Bloc'}</div>
        {block.notes ? <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{block.notes}</div> : null}
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 text-[var(--brand)]"
          onClick={(e) => {
            e.stopPropagation()
            toggleBlockExpanded(blockId)
          }}
          aria-label={isExpanded ? 'Replier le bloc' : 'Déplier le bloc'}
        >
          <IconChevron open={isExpanded} size={12} />
        </button>
        <div
          className="min-w-0 flex-1 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation()
            toggleBlockExpanded(blockId)
          }}
        >
          <div className="truncate text-sm font-extrabold text-[var(--brand)]">{block.title ?? 'Bloc'}</div>
          {!isExpanded && block.notes ? (
            <div className="mt-0.5 line-clamp-1 text-xs text-[var(--muted)]">{block.notes}</div>
          ) : null}
        </div>
        <div className={`flex shrink-0 ${EDITOR_ICON_GAP}`} onClick={(e) => e.stopPropagation()}>
          <ToolbarIconButton label="Dupliquer le bloc" variant="muted" onClick={duplicateBlock}>
            <IconDuplicate size={18} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Supprimer le bloc" variant="muted" onClick={deleteBlock}>
            <IconTrash size={14} />
          </ToolbarIconButton>
        </div>
      </div>

      {!isExpanded ? (
        <div className="mt-2 grid gap-1 pl-5">
          {exerciseIds.length === 0 ? (
            <div className="text-[11px] text-gray-500">Aucun exercice.</div>
          ) : (
            exerciseIds.slice(0, 4).map((beId) => <BlockExercisePreview key={beId} blockExerciseId={beId} />)
          )}
          {exerciseIds.length > 4 ? (
            <div className="text-[11px] font-semibold text-gray-500">+{exerciseIds.length - 4} exercices</div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 space-y-2 pl-5" onClick={(e) => e.stopPropagation()}>
          <BlockDropZone blockId={blockId}>
            <div className="grid gap-2">
              <InlineCommitField
              value={block.title ?? ''}
              placeholder="Titre du bloc"
              dense
              inputClassName="font-extrabold text-[var(--brand)]"
              onCommit={(title) =>
                applyCommand({ type: 'block.update', blockId, patch: { title: title || null } })
              }
            />
            <InlineCommitField
              value={block.notes ?? ''}
              placeholder="Notes du bloc"
              dense
              multiline
              onCommit={(notes) =>
                applyCommand({ type: 'block.update', blockId, patch: { notes: notes || null } })
              }
            />
            <ExerciseLibraryPicker onSelect={addBlockExercise} />
              <BlockExerciseSortableList blockId={blockId} />
            </div>
          </BlockDropZone>
        </div>
      )}
    </div>
  )
}

function ExerciseTimelineItem({
  itemId,
  programExerciseId,
  dragCompact,
}: {
  itemId: string
  programExerciseId: string
  dragCompact?: boolean
}) {
  const pe = useProgramExercise(programExerciseId)
  const applyCommand = useApplyCommand()
  const editingId = useProgramEditorUiStore((s) => s.editingProgramExerciseId)
  const setEditingId = useProgramEditorUiStore((s) => s.setEditingProgramExerciseId)
  const isEditing = editingId === programExerciseId
  const label = resolveProgramExerciseLabel(programExerciseId, pe)

  const toggleEdit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingId(isEditing ? null : programExerciseId)
    },
    [isEditing, programExerciseId, setEditingId]
  )

  const duplicateExercise = useCallback(() => {
    const newProgramExerciseId = createTempId('pe')
    applyCommand({
      type: 'timeline.exercise.duplicate',
      sourceTimelineItemId: itemId,
      newTimelineItemId: createTempId('item'),
      newProgramExerciseId,
    })
    setEditingId(newProgramExerciseId)
  }, [applyCommand, itemId, setEditingId])

  const deleteExercise = useCallback(() => {
    applyCommand({ type: 'timeline.item.delete', timelineItemId: itemId })
    if (editingId === programExerciseId) setEditingId(null)
  }, [applyCommand, editingId, itemId, programExerciseId, setEditingId])

  if (!pe) return null

  if (dragCompact) {
    return (
      <div className="min-w-0">
        <div className="truncate text-sm font-extrabold text-[var(--brand)]">{label}</div>
        {hasProgramExerciseDetails(pe) ? (
          <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{formatProgramExerciseDetails(pe)}</div>
        ) : null}
      </div>
    )
  }

  const detailsLine = formatProgramExerciseDetails(pe)

  return (
    <div className="min-w-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 cursor-pointer" onClick={toggleEdit}>
          <div className="truncate text-sm font-extrabold text-[var(--brand)]">{label}</div>
          {!isEditing && hasProgramExerciseDetails(pe) ? (
            <div className="mt-1 grid gap-1">
              {detailsLine ? (
                <div className="truncate text-xs text-[var(--muted)]">{detailsLine}</div>
              ) : null}
              {pe.notes ? <div className="truncate text-xs text-[var(--muted)]">{pe.notes}</div> : null}
            </div>
          ) : null}
        </div>
        <div className={`flex shrink-0 ${EDITOR_ICON_GAP}`} onClick={(e) => e.stopPropagation()}>
          <ToolbarIconButton label="Dupliquer l'exercice" variant="muted" onClick={duplicateExercise}>
            <IconDuplicate size={18} />
          </ToolbarIconButton>
          <ToolbarIconButton label="Supprimer l'exercice" variant="muted" onClick={deleteExercise}>
            <IconTrash size={14} />
          </ToolbarIconButton>
        </div>
      </div>
      {isEditing ? <ExerciseEditFields programExerciseId={programExerciseId} /> : null}
    </div>
  )
}

function TimelineItemViewInner({ itemId, compact = false }: Props) {
  const item = useTimelineItem(itemId)

  if (!item) return null

  const shell = [
    'w-full overflow-hidden rounded-xl border border-gray-200 bg-white px-3 py-1.5 shadow-sm shadow-black/10 transition',
    'hover:border-[var(--brand)]/20',
  ].join(' ')

  if (item.kind === 'block' && item.sessionBlockId) {
    return (
      <div className={shell}>
        <BlockTimelineItem blockId={item.sessionBlockId} itemId={itemId} dragCompact={compact} />
      </div>
    )
  }

  if (!item.programExerciseId) return null

  return (
    <div className={shell}>
      <ExerciseTimelineItem
        itemId={itemId}
        programExerciseId={item.programExerciseId}
        dragCompact={compact}
      />
    </div>
  )
}

export default memo(TimelineItemViewInner)
