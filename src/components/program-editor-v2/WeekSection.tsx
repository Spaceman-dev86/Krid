'use client'

import { memo, useCallback, useEffect, useRef, useState, type RefCallback } from 'react'

import { createTempId, type WeekNode } from '../../domain/program-editor'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useApplyCommand } from '../../store/program-editor'
import { useIsWeekOpen, useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { MOBILE_DRAG_LABEL } from './dnd/useEditorDndActivator'
import { EDITOR_CLS } from './editorLayoutConstants'
import WeekSessionList from './WeekSessionList'
import { EDITOR_PANEL_SHADOW_CLASS } from './ui/editorInputStyles'
import { EDITOR_SECTION_TITLE_CLASS } from './ui/editorSectionTitle'
import EditorAddButton from './ui/EditorAddButton'
import { IconChevron, IconDuplicate, IconTrash } from './ui/EditorIcons'
import InlineCommitField from './ui/InlineCommitField'
import { EDITOR_ICON_GAP } from './ui/editorIconLayout'
import TitleEditButton from './ui/TitleEditButton'
import ToolbarIconButton from './ui/ToolbarIconButton'
import EditorConfirmDialog from './ui/EditorConfirmDialog'
import EditorToolbarOverflow from './ui/EditorToolbarOverflow'

type MobileDragProps = {
  activatorRef: RefCallback<HTMLElement>
  attributes?: DraggableAttributes
  listeners?: DraggableSyntheticListeners
  dragClass: string
}

type Props = {
  week: WeekNode
  mobileDrag?: MobileDragProps
}

function WeekSectionInner({ week, mobileDrag }: Props) {
  const applyCommand = useApplyCommand()
  const isOpen = useIsWeekOpen(week.id)
  const toggleWeek = useProgramEditorUiStore((s) => s.toggleWeek)
  const setWeekOpen = useProgramEditorUiStore((s) => s.setWeekOpen)
  const setSessionOpen = useProgramEditorUiStore((s) => s.setSessionOpen)
  const editingWeekTitleId = useProgramEditorUiStore((s) => s.editingWeekTitleId)
  const setEditingWeekTitleId = useProgramEditorUiStore((s) => s.setEditingWeekTitleId)
  const isEditingTitle = editingWeekTitleId === week.id
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(isOpen)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  const confirmDeleteWeek = useCallback(() => {
    applyCommand({ type: 'week.delete', weekId: week.id })
    setConfirmDeleteOpen(false)
  }, [applyCommand, week.id])

  const addSession = useCallback(() => {
    const sessionId = createTempId('session')
    applyCommand({
      type: 'session.add',
      weekId: week.id,
      sessionId,
      title: 'Nouvelle séance',
    })
    setSessionOpen(sessionId, true)
  }, [applyCommand, setSessionOpen, week.id])

  const duplicateWeek = useCallback(() => {
    const newWeekId = createTempId('week')
    applyCommand({
      type: 'week.duplicate',
      sourceWeekId: week.id,
      newWeekId,
    })
    setWeekOpen(newWeekId, true)
  }, [applyCommand, setWeekOpen, week.id])

  const onHeaderClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button,select')) return
      toggleWeek(week.id, week.sessionIds)
    },
    [toggleWeek, week.id, week.sessionIds]
  )

  return (
    <section
      ref={sectionRef}
      className={`overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] ${EDITOR_PANEL_SHADOW_CLASS}`}
    >
      <div
        ref={mobileDrag?.activatorRef}
        className={[
          'flex cursor-pointer items-start justify-between gap-2 text-left transition duration-150',
          EDITOR_CLS.timelineCompactPx,
          'sm:gap-3',
          isOpen ? 'bg-[var(--brand)]' : 'hover:bg-[#fafafa]',
          mobileDrag?.dragClass ?? '',
          mobileDrag ? 'select-none max-[767px]:cursor-grab' : '',
        ].join(' ')}
        {...(mobileDrag?.attributes ?? { role: 'button', tabIndex: 0 })}
        {...(mobileDrag?.listeners ?? {})}
        {...(mobileDrag ? { title: MOBILE_DRAG_LABEL, 'aria-label': MOBILE_DRAG_LABEL } : {})}
        onClick={onHeaderClick}
        onKeyDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button,select')) return
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          onHeaderClick(e)
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className={`mt-1 shrink-0 ${isOpen ? 'text-white' : 'text-[var(--brand)]'}`}>
            <IconChevron open={isOpen} />
          </span>
          <div className="min-w-0 flex-1">
            {isOpen && isEditingTitle ? (
              <div onClick={(e) => e.stopPropagation()}>
                <InlineCommitField
                  value={week.title}
                  dense
                  inputClassName={`${EDITOR_SECTION_TITLE_CLASS} !p-0`}
                  onCommit={(title) => {
                    applyCommand({ type: 'week.update', weekId: week.id, patch: { title } })
                  }}
                  onDismiss={() => setEditingWeekTitleId(null)}
                />
              </div>
            ) : (
              <div className={`flex min-w-0 items-center ${EDITOR_ICON_GAP}`}>
                <span
                  className={`truncate ${EDITOR_SECTION_TITLE_CLASS} ${isOpen ? '!text-white' : ''}`}
                >
                  {week.title}
                </span>
                {isOpen ? (
                  <TitleEditButton
                    inverted
                    label="Éditer le titre"
                    onClick={() => setEditingWeekTitleId(week.id)}
                  />
                ) : null}
              </div>
            )}
            {!isOpen && week.notes ? (
              <div className="mt-1 line-clamp-2 text-sm text-[color:var(--muted)]">{week.notes}</div>
            ) : null}
            {!isOpen ? (
              <div className="mt-1 text-[10px] font-semibold text-black/40">
                {week.sessionIds.length} séance{week.sessionIds.length > 1 ? 's' : ''}
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={[EDITOR_CLS.toolbarFull, EDITOR_ICON_GAP].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolbarIconButton
            label="Dupliquer la semaine"
            variant={isOpen ? 'inverted' : 'brand'}
            onClick={duplicateWeek}
          >
            <IconDuplicate size={18} />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Supprimer la semaine"
            danger
            variant={isOpen ? 'inverted' : 'brand'}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <IconTrash size={14} />
          </ToolbarIconButton>
        </div>
        <EditorToolbarOverflow
          variant={isOpen ? 'inverted' : 'brand'}
          actions={[
            {
              label: 'Dupliquer la semaine',
              icon: <IconDuplicate size={16} />,
              onClick: duplicateWeek,
            },
            {
              label: 'Supprimer la semaine',
              icon: <IconTrash size={14} />,
              danger: true,
              onClick: () => setConfirmDeleteOpen(true),
            },
          ]}
        />
      </div>

      <EditorConfirmDialog
        open={confirmDeleteOpen}
        message="Es-tu sûr·e de vouloir supprimer la semaine sélectionné ?"
        confirmLabel="Supprimer"
        onConfirm={confirmDeleteWeek}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {isOpen ? (
        <div className={['border-t border-black/8 pb-4 pt-2', EDITOR_CLS.timelineCompactPx].join(' ')}>
          <div className="mb-3" onClick={(e) => e.stopPropagation()}>
            <InlineCommitField
              value={week.notes ?? ''}
              placeholder="Note de semaine"
              dense
              multiline
              brandBorder
              inputClassName="!pl-4 !py-2"
              onCommit={(notes) =>
                applyCommand({ type: 'week.update', weekId: week.id, patch: { notes: notes || null } })
              }
            />
          </div>
          <WeekSessionList weekId={week.id} sessionIds={week.sessionIds} />
          <div className="mt-3">
            <EditorAddButton onClick={addSession}>+ Ajouter une séance</EditorAddButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function propsAreEqual(prev: Props, next: Props) {
  if (prev.week.id !== next.week.id) return false
  if (prev.week.title !== next.week.title) return false
  if (prev.week.notes !== next.week.notes) return false
  if (prev.week.sessionIds.length !== next.week.sessionIds.length) return false
  for (let i = 0; i < prev.week.sessionIds.length; i += 1) {
    if (prev.week.sessionIds[i] !== next.week.sessionIds[i]) return false
  }
  return true
}

export default memo(WeekSectionInner, propsAreEqual)
