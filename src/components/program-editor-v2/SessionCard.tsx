'use client'

import { memo, useCallback, useEffect, useRef, type RefCallback } from 'react'

import { createTempId } from '../../domain/program-editor'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useApplyCommand, useSession } from '../../store/program-editor'
import { useProgramDocumentStore } from '../../store/program-editor/documentStore'
import { useIsSessionOpen, useProgramEditorUiStore } from '../../store/program-editor/uiStore'
import { MOBILE_DRAG_LABEL } from './dnd/useEditorDndActivator'
import { buildSessionTimelineSummary } from './utils/sessionTimelineSummary'
import { EDITOR_CLS, EDITOR_SESSION_BG } from './editorLayoutConstants'
import SessionTimeline from './SessionTimeline'
import { IconChevron, IconDuplicate, IconTrash } from './ui/EditorIcons'
import InlineCommitField from './ui/InlineCommitField'
import { EDITOR_ICON_GAP } from './ui/editorIconLayout'
import TitleEditButton from './ui/TitleEditButton'
import ToolbarIconButton from './ui/ToolbarIconButton'
import EditorToolbarOverflow from './ui/EditorToolbarOverflow'
type MobileDragProps = {
  activatorRef: RefCallback<HTMLElement>
  attributes?: DraggableAttributes
  listeners?: DraggableSyntheticListeners
  dragClass: string
}

type Props = {
  sessionId: string
  mobileDrag?: MobileDragProps
}

function SessionCardInner({ sessionId, mobileDrag }: Props) {
  const session = useSession(sessionId)
  const applyCommand = useApplyCommand()
  const isOpen = useIsSessionOpen(sessionId)
  const toggleSession = useProgramEditorUiStore((s) => s.toggleSession)
  const setSessionOpen = useProgramEditorUiStore((s) => s.setSessionOpen)
  const editingSessionTitleId = useProgramEditorUiStore((s) => s.editingSessionTitleId)
  const setEditingSessionTitleId = useProgramEditorUiStore((s) => s.setEditingSessionTitleId)
  const isEditingTitle = editingSessionTitleId === sessionId
  const articleRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(isOpen)

  const summary = useProgramDocumentStore((s) => {
    const doc = s.document
    if (!doc) return ''
    return buildSessionTimelineSummary(doc, sessionId)
  })

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      articleRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  const duplicateSession = useCallback(() => {
    const newSessionId = createTempId('session')
    applyCommand({
      type: 'session.duplicate',
      sourceSessionId: sessionId,
      newSessionId,
    })
    setSessionOpen(newSessionId, true)
  }, [applyCommand, sessionId, setSessionOpen])

  const onHeaderClick = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('input,textarea,button,select')) return
      toggleSession(sessionId)
    },
    [sessionId, toggleSession]
  )

  if (!session) return null

  return (
    <article
      ref={articleRef}
      className="overflow-hidden rounded-xl border border-[var(--border)] border-l-4 border-l-[var(--brand)] shadow-md shadow-black/10"
      style={{ backgroundColor: EDITOR_SESSION_BG }}
    >
      <div
        role="button"
        tabIndex={0}
        ref={mobileDrag?.activatorRef}
        className={[
          'flex w-full cursor-pointer items-start justify-between gap-2 text-left transition duration-150 hover:bg-black/[0.04]',
          EDITOR_CLS.timelineCompactPx,
          'sm:gap-3',
          mobileDrag?.dragClass ?? '',
          mobileDrag ? 'select-none max-[767px]:cursor-grab' : '',
        ].join(' ')}
        {...(mobileDrag?.attributes ?? {})}
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
          <span className="mt-0.5 shrink-0 text-[var(--brand)]">
            <IconChevron open={isOpen} size={14} />
          </span>
          <div className="min-w-0 flex-1">
            {isOpen && isEditingTitle ? (
              <div onClick={(e) => e.stopPropagation()}>
                <InlineCommitField
                  value={session.title}
                  dense
                  inputClassName="font-extrabold"
                  onCommit={(title) => {
                    applyCommand({ type: 'session.update', sessionId, patch: { title } })
                  }}
                  onDismiss={() => setEditingSessionTitleId(null)}
                />
              </div>
            ) : (
              <div className={`flex min-w-0 items-center ${EDITOR_ICON_GAP}`}>
                <span className="truncate text-sm font-extrabold text-[var(--brand)]">{session.title}</span>
                {isOpen ? (
                  <TitleEditButton label="Éditer le titre" onClick={() => setEditingSessionTitleId(sessionId)} />
                ) : null}
              </div>
            )}
            {!isOpen && session.description ? (
              <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{session.description}</div>
            ) : null}
            {!isOpen ? (
              <div className="mt-0.5 truncate text-xs text-[var(--muted)]">
                {summary || 'Cliquer pour construire la séance'}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={[EDITOR_CLS.toolbarFull, EDITOR_ICON_GAP].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolbarIconButton label="Dupliquer la séance" onClick={duplicateSession}>
            <IconDuplicate size={18} />
          </ToolbarIconButton>
          <ToolbarIconButton
            label="Supprimer"
            danger
            onClick={() => applyCommand({ type: 'session.delete', sessionId })}
          >
            <IconTrash size={14} />
          </ToolbarIconButton>
        </div>
        <EditorToolbarOverflow
          actions={[
            {
              label: 'Dupliquer la séance',
              icon: <IconDuplicate size={16} />,
              onClick: duplicateSession,
            },
            {
              label: 'Supprimer la séance',
              icon: <IconTrash size={14} />,
              danger: true,
              onClick: () => applyCommand({ type: 'session.delete', sessionId }),
            },
          ]}
        />
      </div>

      {isOpen ? (
        <div
          className={['border-t border-black/8 pb-3 pt-1.5', EDITOR_CLS.timelineCompactPx].join(' ')}
          style={{ backgroundColor: EDITOR_SESSION_BG }}
        >
          <div className="mb-2" onClick={(e) => e.stopPropagation()}>
            <InlineCommitField
              value={session.description ?? ''}
              placeholder="Description / objectif de séance"
              dense
              multiline
              inputClassName="!pl-4 !py-2"
              onCommit={(description) =>
                applyCommand({
                  type: 'session.update',
                  sessionId,
                  patch: { description: description || null },
                })
              }
            />
          </div>
          <SessionTimeline sessionId={sessionId} />
        </div>
      ) : null}
    </article>
  )
}

function propsAreEqual(prev: Props, next: Props) {
  return prev.sessionId === next.sessionId
}

export default memo(SessionCardInner, propsAreEqual)
