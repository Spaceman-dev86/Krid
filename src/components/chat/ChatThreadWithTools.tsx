'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import type { ChatMessageRow } from '../../lib/chat/chat'
import { ChatThreadSwitchProgress, useChatWorkspace } from './ChatWorkspaceContext'
import { ChatThreadClient } from './ChatThreadClient'
import {
  ChatThreadToolbar,
  type ChatMediaFilter,
  type ChatMediaGalleryItem,
} from './ChatThreadToolbar'

type Props = {
  messages: ChatMessageRow[]
  currentUserId: string
  primaryColor?: string
  sendAction: (formData: FormData) => void | Promise<unknown>
  uploadAction?: (formData: FormData) => void | Promise<unknown>
  reactionAction?: (formData: FormData) => void | Promise<void>
  deleteAction?: (formData: FormData) => void | Promise<unknown>
  pinAction?: (formData: FormData) => void | Promise<unknown>
  forwardAction?: (formData: FormData) => void | Promise<void>
  saveDriveAction?: (formData: FormData) => void | Promise<void>
  stateAction?: (formData: FormData) => void | Promise<void>
  clearHistoryAction?: (formData: FormData) => void | Promise<void>
  renameGroupAction?: (formData: FormData) => void | Promise<void>
  threadId: string
  hiddenFields?: Record<string, string>
  draft?: string
  variant?: 'coach' | 'portal'
  mediaUrls?: Record<string, string>
  senderNames?: Record<string, string>
  peerLastReadAt?: string | null
  forwardTargets?: Array<{ threadId: string; title: string }>
  mentionCandidates?: Array<{ id: string; label: string }>
  archived?: boolean
  readOnly?: boolean
  readOnlyReason?: string | null
  groupHref?: string | null
  groupId?: string | null
  groupName?: string | null
  groupDescription?: string | null
  groupMembers?: Array<{ clientId: string; label: string }>
  allClients?: Array<{ id: string; label: string }>
  groupMemberAction?: (formData: FormData) => void | Promise<void>
  headerLeading?: ReactNode
  titleBlock?: ReactNode
  /** Recharge messages sans router.refresh (cache client) */
  onMessagesRefresh?: () => void
}

const LAST_THREAD_KEY = 'trainly.chat.lastThreadId'

export function ChatThreadWithTools({
  headerLeading,
  titleBlock,
  groupHref,
  groupId,
  groupName,
  groupDescription,
  groupMembers,
  allClients,
  groupMemberAction,
  stateAction,
  clearHistoryAction,
  renameGroupAction,
  archived = false,
  readOnly = false,
  readOnlyReason = null,
  forwardTargets: forwardTargetsProp,
  onMessagesRefresh,
  ...threadProps
}: Props) {
  const [search, setSearch] = useState('')
  const [mediaFilter, setMediaFilter] = useState<ChatMediaFilter>('all')
  const [jumpToId, setJumpToId] = useState<string | null>(null)
  const { inbox } = useChatWorkspace()

  useEffect(() => {
    try {
      localStorage.setItem(LAST_THREAD_KEY, threadProps.threadId)
    } catch {
      // ignore
    }
  }, [threadProps.threadId])

  const coachTools = threadProps.variant === 'coach'

  const mediaItems = useMemo<ChatMediaGalleryItem[]>(() => {
    const urls = threadProps.mediaUrls ?? {}
    return threadProps.messages
      .filter((m) => m.media_kind && m.media_path)
      .map((m) => ({
        id: m.id,
        kind: m.media_kind as string,
        url: m.media_path ? urls[m.media_path] : null,
        name: m.media_name,
        body: m.body,
      }))
  }, [threadProps.messages, threadProps.mediaUrls])

  const forwardTargets = useMemo(() => {
    if (forwardTargetsProp?.length) return forwardTargetsProp
    return inbox
      .filter((i) => i.threadId !== threadProps.threadId && !i.archived)
      .slice(0, 40)
      .map((i) => ({ threadId: i.threadId, title: i.title }))
  }, [forwardTargetsProp, inbox, threadProps.threadId])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="coach-chat__panel-head relative">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">{titleBlock}</div>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerLeading ? <div className="shrink-0">{headerLeading}</div> : null}
          <ChatThreadToolbar
            threadId={threadProps.threadId}
            archived={archived}
            stateAction={stateAction}
            clearHistoryAction={clearHistoryAction}
            renameGroupAction={renameGroupAction}
            hiddenFields={threadProps.hiddenFields}
            onSearchChange={setSearch}
            mediaFilter={mediaFilter}
            onMediaFilterChange={setMediaFilter}
            mediaItems={mediaItems}
            onJumpToMessage={setJumpToId}
            groupHref={groupHref}
            groupId={groupId}
            groupName={groupName}
            groupDescription={groupDescription}
            groupMembers={groupMembers}
            allClients={allClients}
            groupMemberAction={groupMemberAction}
            coachTools={coachTools}
          />
        </div>
        <ChatThreadSwitchProgress />
      </header>
      <ChatThreadClient
        {...threadProps}
        forwardTargets={forwardTargets}
        threadSearch={search}
        mediaFilter="all"
        jumpToMessageId={jumpToId}
        onJumpHandled={() => setJumpToId(null)}
        readOnly={readOnly}
        readOnlyReason={readOnlyReason}
        onMessagesRefresh={onMessagesRefresh}
      />
    </div>
  )
}

export { LAST_THREAD_KEY }
