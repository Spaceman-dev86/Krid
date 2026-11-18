'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'

import type { CoachThreadBundle } from '@/src/app/chat/threadActions'
import {
  coachDeleteMessageAction,
  coachPinMessageAction,
  coachSaveMediaToDriveAction,
  coachSendMessageAction,
  coachToggleReactionAction,
  coachUploadChatMediaAction,
  ensureClientDmThreadAction,
} from '@/src/app/chat/actions'
import { Button } from '@/src/components/ui'
import { IconClose } from '@/src/components/ui/icons'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { initialsFromName } from '@/src/lib/chat/chat'
import { ChatThreadClient } from './ChatThreadClient'
import { fetchThreadBundle, invalidateThreadCache, peekThreadCache } from './threadCache'

type Props = {
  clientId: string
  clientLabel: string
  /** Remplace le bouton Message par défaut. */
  trigger?: ReactNode
  triggerVariant?: 'secondary' | 'mist' | 'cta'
  triggerSize?: 'sm' | 'md'
  triggerClassName?: string
}

function ThreadSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <div className="ml-auto h-10 w-[55%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="h-10 w-[45%] animate-pulse rounded-2xl bg-[var(--accent)]" />
        <div className="ml-auto h-14 w-[60%] animate-pulse rounded-2xl bg-[var(--accent)]" />
      </div>
    </div>
  )
}

export function ClientMessageDialog({
  clientId,
  clientLabel,
  trigger,
  triggerVariant = 'secondary',
  triggerSize = 'sm',
  triggerClassName,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [bundle, setBundle] = useState<CoachThreadBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadBundle = useCallback(async (tid: string, force = false) => {
    if (!force) {
      const hit = peekThreadCache(tid)
      if (hit) {
        setBundle(hit)
        void fetchThreadBundle(tid, { force: true }).then((res) => {
          if (res.ok) setBundle(res)
        })
        return
      }
    }
    const res = await fetchThreadBundle(tid, { force })
    if (!res.ok) {
      setError(res.error === 'introuvable' ? 'Conversation introuvable' : 'Impossible de charger')
      return
    }
    setBundle(res)
    setError(null)
  }, [])

  async function handleOpen() {
    if (opening) return
    setOpening(true)
    setError(null)
    setOpen(true)
    try {
      const res = await ensureClientDmThreadAction(clientId)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setThreadId(res.threadId)
      await loadBundle(res.threadId)
    } catch {
      setError('Impossible d’ouvrir la conversation')
    } finally {
      setOpening(false)
    }
  }

  const softReload = useCallback(() => {
    if (!threadId) return
    invalidateThreadCache(threadId)
    void loadBundle(threadId, true)
  }, [threadId, loadBundle])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setThreadId(null)
      setBundle(null)
      setError(null)
      setOpening(false)
    }
  }, [open])

  const defaultTrigger = (
    <Button
      type="button"
      variant={triggerVariant}
      size={triggerSize}
      onClick={() => void handleOpen()}
      disabled={opening}
      className={
        triggerClassName ??
        'inline-flex items-center gap-2 !rounded-[var(--radius-sm)]'
      }
    >
      {opening ? <FluidSpinner size={12} className="text-[color:var(--fg)]" /> : null}
      {opening ? 'Ouverture…' : 'Message'}
    </Button>
  )

  return (
    <>
      {trigger ? (
        <span
          role="button"
          tabIndex={0}
          onClick={() => void handleOpen()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              void handleOpen()
            }
          }}
        >
          {trigger}
        </span>
      ) : (
        defaultTrigger
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-[1] flex h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:h-[min(85vh,40rem)] sm:rounded-[1.25rem]">
            <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-extrabold text-[color:var(--fg)]"
                aria-hidden
              >
                {initialsFromName(clientLabel)}
              </span>
              <div className="min-w-0 flex-1">
                <p id={titleId} className="truncate text-sm font-extrabold text-[color:var(--fg)]">
                  {clientLabel}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                  Message
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
                aria-label="Fermer"
                onClick={() => setOpen(false)}
              >
                <IconClose size={16} />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              {error && !bundle ? (
                <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[color:var(--muted)]">
                  {error}
                </div>
              ) : !bundle || !threadId ? (
                <ThreadSkeleton />
              ) : (
                <ChatThreadClient
                  messages={bundle.messages}
                  currentUserId={bundle.currentUserId}
                  threadId={threadId}
                  sendAction={coachSendMessageAction}
                  uploadAction={bundle.readOnly ? undefined : coachUploadChatMediaAction}
                  reactionAction={coachToggleReactionAction}
                  deleteAction={coachDeleteMessageAction}
                  pinAction={coachPinMessageAction}
                  saveDriveAction={coachSaveMediaToDriveAction}
                  readOnly={bundle.readOnly}
                  readOnlyReason={bundle.readOnly ? 'Client archivé — lecture seule' : null}
                  variant="coach"
                  mediaUrls={bundle.mediaUrls}
                  senderNames={bundle.senderNames}
                  peerLastReadAt={bundle.peerLastReadAt}
                  mentionCandidates={bundle.mentionCandidates}
                  onMessagesRefresh={softReload}
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
