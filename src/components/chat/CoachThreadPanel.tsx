'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import type { CoachThreadBundle } from '@/src/app/chat/threadActions'
import {
  coachClearHistoryAction,
  coachDeleteMessageAction,
  coachForwardMessageAction,
  coachGroupMemberAction,
  coachPinMessageAction,
  coachRenameGroupAction,
  coachSaveMediaToDriveAction,
  coachSendMessageAction,
  coachThreadStateAction,
  coachToggleReactionAction,
  coachUploadChatMediaAction,
} from '@/src/app/chat/actions'
import { CoachRdvEntryButton } from '@/src/components/coach/calendar/CoachRdvEntryButton'
import { IconCaret, IconUsers } from '@/src/components/ui/icons'
import { initialsFromName } from '@/src/lib/chat/chat'
import { ChatCallPhoneButton } from './ChatCallPhoneButton'
import { ChatThreadFlash } from './ChatThreadFlash'
import { ChatThreadWithTools } from './ChatThreadWithTools'
import { useChatWorkspace } from './ChatWorkspaceContext'
import { fetchThreadBundle, invalidateThreadCache, peekThreadCache } from './threadCache'

type Flash = {
  error?: string
  draft?: string
  ok?: string
}

function ThreadSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-[var(--border)] px-3">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]" />
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--accent)]" />
      </div>
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <div className="ml-auto h-10 w-[55%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="h-10 w-[45%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="ml-auto h-14 w-[60%] animate-pulse rounded-2xl bg-[var(--accent)]" />
      </div>
    </div>
  )
}

export function CoachThreadPanel({ threadId, flash }: { threadId: string; flash: Flash }) {
  const router = useRouter()
  const { clients, markThreadReadLocal } = useChatWorkspace()
  const cached = peekThreadCache(threadId)
  const [bundle, setBundle] = useState<CoachThreadBundle | null>(cached)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cached)

  const load = useCallback(
    async (force = false) => {
      if (!force) {
        const hit = peekThreadCache(threadId)
        if (hit) {
          setBundle(hit)
          setLoading(false)
          setError(null)
          markThreadReadLocal(threadId)
          // Revalidation soft en arrière-plan
          void fetchThreadBundle(threadId, { force: true }).then((res) => {
            if (res.ok) setBundle(res)
          })
          return
        }
      }
      setLoading(true)
      const res = await fetchThreadBundle(threadId, { force })
      if (!res.ok) {
        setError(res.error)
        setLoading(false)
        if (res.error === 'introuvable') {
          router.replace('/chat?error=Conversation%20introuvable')
        }
        return
      }
      setBundle(res)
      setError(null)
      setLoading(false)
      markThreadReadLocal(threadId)
    },
    [threadId, markThreadReadLocal, router]
  )

  useEffect(() => {
    void load(false)
  }, [load])

  const softReload = useCallback(() => {
    invalidateThreadCache(threadId)
    void load(true)
  }, [threadId, load])

  if (loading && !bundle) return <ThreadSkeleton />
  if (error && !bundle) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-[color:var(--muted)]">
        Impossible de charger la conversation.
      </div>
    )
  }
  if (!bundle) return <ThreadSkeleton />

  const allClients =
    bundle.allClients.length > 0
      ? bundle.allClients
      : clients.map((c) => ({
          id: c.id,
          label: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email,
        }))

  const nameMap = new Map(bundle.nameMapEntries)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatThreadFlash error={flash.error} cleared={flash.ok === 'cleared'} />
      <ChatThreadWithTools
        messages={bundle.messages}
        currentUserId={bundle.currentUserId}
        threadId={threadId}
        sendAction={coachSendMessageAction}
        uploadAction={bundle.readOnly ? undefined : coachUploadChatMediaAction}
        reactionAction={coachToggleReactionAction}
        deleteAction={coachDeleteMessageAction}
        pinAction={coachPinMessageAction}
        forwardAction={coachForwardMessageAction}
        saveDriveAction={coachSaveMediaToDriveAction}
        stateAction={coachThreadStateAction}
        clearHistoryAction={coachClearHistoryAction}
        renameGroupAction={bundle.groupEditable ? coachRenameGroupAction : undefined}
        archived={bundle.archived}
        readOnly={bundle.readOnly}
        readOnlyReason={bundle.readOnly ? 'Client archivé — lecture seule' : null}
        draft={typeof flash.draft === 'string' ? flash.draft : ''}
        variant="coach"
        mediaUrls={bundle.mediaUrls}
        senderNames={bundle.senderNames}
        peerLastReadAt={bundle.peerLastReadAt}
        mentionCandidates={bundle.mentionCandidates}
        onMessagesRefresh={softReload}
        groupHref={
          bundle.type === 'group' && bundle.groupId
            ? `/clients/groupes/${bundle.groupId}`
            : null
        }
        groupId={bundle.type === 'group' ? bundle.groupId : null}
        groupName={bundle.groupName}
        groupDescription={bundle.groupDescription}
        groupMembers={bundle.groupMembers}
        allClients={allClients}
        groupMemberAction={coachGroupMemberAction}
        titleBlock={
          <>
            <Link
              key="back"
              href="/chat"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] md:hidden"
              aria-label="Retour aux messages"
            >
              <IconCaret dir="left" />
            </Link>
            <span key="avatar" className="coach-chat__avatar" aria-hidden>
              {bundle.type === 'group' ? (
                <IconUsers size={18} />
              ) : (
                initialsFromName(bundle.title)
              )}
            </span>
            <div key="meta" className="min-w-0">
              {bundle.ficheHref ? (
                <Link
                  href={bundle.ficheHref}
                  className="block truncate text-sm font-extrabold text-[color:var(--fg)] hover:text-[color:var(--brand)]"
                >
                  {bundle.title}
                </Link>
              ) : (
                <p className="truncate text-sm font-extrabold text-[color:var(--fg)]">{bundle.title}</p>
              )}
              {bundle.type === 'group' ? (
                <p className="truncate text-[10px] font-semibold text-[color:var(--muted)]">
                  {bundle.groupDescription?.trim() || 'Groupe'}
                </p>
              ) : bundle.readOnly ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Archivé · lecture seule
                </p>
              ) : null}
            </div>
          </>
        }
        headerLeading={
          <div className="flex items-center gap-1.5">
            {bundle.type === 'dm' ? (
              <ChatCallPhoneButton
                phone={bundle.clientPhone}
                clientHref={bundle.clientId ? `/clients/${bundle.clientId}` : null}
              />
            ) : null}
            {bundle.rdvClients.length || bundle.rdvGroups.length ? (
              <CoachRdvEntryButton
                clients={bundle.rdvClients}
                groups={bundle.rdvGroups}
                defaultAudience={bundle.defaultAudience}
                returnTo={`/chat/${threadId}`}
                nameMap={nameMap}
              />
            ) : null}
          </div>
        }
      />
    </div>
  )
}
