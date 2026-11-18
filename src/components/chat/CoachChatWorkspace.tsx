'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { loadCoachChatBootAction } from '@/src/app/chat/threadActions'
import { useOptionalShellNav } from '@/src/components/shell/ShellNavContext'
import { IconPlus, IconUsers } from '@/src/components/ui'
import { inboxListTime, initialsFromName, type ChatInboxItem } from '@/src/lib/chat/chat'
import { ChatWorkspaceProvider } from './ChatWorkspaceContext'
import { NewChatModal, type NewChatClient, type NewChatGroup } from './NewChatModal'
import { prefetchThreadBundle } from './threadCache'

type Props = {
  children?: ReactNode
}

export function CoachChatWorkspace({ children }: Props) {
  const [inbox, setInbox] = useState<ChatInboxItem[]>([])
  const [clients, setClients] = useState<NewChatClient[]>([])
  const [groups, setGroups] = useState<NewChatGroup[]>([])
  const [bootPending, setBootPending] = useState(true)
  const [bootError, setBootError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'group' | 'archived'>('all')
  const [newOpen, setNewOpen] = useState(false)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const bootedRef = useRef(false)
  const pathname = usePathname() || '/chat'
  const shellNav = useOptionalShellNav()

  const activeThreadId = useMemo(() => {
    const m = pathname.match(/^\/chat\/([^/?#]+)/)
    return m?.[1] ?? null
  }, [pathname])

  const refreshInbox = useCallback(() => {
    void loadCoachChatBootAction()
      .then((boot) => {
        setInbox(boot.inbox)
        setClients(boot.clients)
        setGroups(boot.groups)
        setBootError(null)
      })
      .catch((e) => {
        setBootError(e instanceof Error ? e.message : 'inbox')
      })
  }, [])

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void loadCoachChatBootAction()
      .then((boot) => {
        setInbox(boot.inbox)
        setClients(boot.clients)
        setGroups(boot.groups)
        setBootPending(false)
        // Prefetch les 4 premiers fils → 1er clic quasi immédiat
        for (const item of boot.inbox.slice(0, 4)) {
          prefetchThreadBundle(item.threadId)
        }
      })
      .catch((e) => {
        setBootError(e instanceof Error ? e.message : 'inbox')
        setBootPending(false)
      })
  }, [])

  useEffect(() => {
    setPendingTarget(null)
  }, [pathname, activeThreadId])

  const markThreadReadLocal = useCallback((threadId: string) => {
    setInbox((prev) =>
      prev.map((item) => (item.threadId === threadId ? { ...item, unread: false } : item))
    )
  }, [])

  const switchPending = Boolean(pendingTarget && pendingTarget !== activeThreadId)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inbox.filter((item) => {
      if (filter === 'archived') {
        if (!item.archived) return false
      } else if (item.archived) {
        return false
      }
      if (filter === 'unread' && !item.unread) return false
      if (filter === 'group' && item.kind !== 'group') return false
      if (!needle) return true
      return (
        item.title.toLowerCase().includes(needle) ||
        item.preview.toLowerCase().includes(needle)
      )
    })
  }, [inbox, q, filter])

  const showThreadOnly = Boolean(activeThreadId)

  return (
    <ChatWorkspaceProvider
      value={{
        inbox,
        clients,
        groups,
        activeThreadId,
        switchPending,
        bootPending,
        markThreadReadLocal,
        refreshInbox,
      }}
    >
      <div
        className={`coach-chat-shell -mx-4 -mt-6 -mb-6 bg-[var(--surface)] md:-mx-8 ${
          showThreadOnly ? 'coach-chat-shell--thread' : 'coach-chat-shell--list'
        }`}
      >
      <div className={`coach-chat ${showThreadOnly ? 'coach-chat--thread' : 'coach-chat--list'}`}>
        <aside className="coach-chat__aside">
          <div className="coach-chat__aside-head">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-[color:var(--fg)]">Messages</h1>
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-da-brand transition hover:brightness-105"
                aria-label="Nouveau chat"
              >
                <IconPlus size={18} className="shrink-0" />
              </button>
            </div>

            <label className="coach-chat__search">
              <span className="sr-only">Rechercher</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une discussion…"
                className="coach-chat__search-input"
              />
            </label>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`coach-chat__chip ${filter === 'all' ? 'coach-chat__chip--on' : ''}`}
              >
                Toutes
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`coach-chat__chip ${filter === 'unread' ? 'coach-chat__chip--on' : ''}`}
              >
                Non lues
              </button>
              <button
                type="button"
                onClick={() => setFilter('group')}
                className={`coach-chat__chip ${filter === 'group' ? 'coach-chat__chip--on' : ''}`}
              >
                Groupe
              </button>
              <button
                type="button"
                onClick={() => setFilter('archived')}
                className={`coach-chat__chip ${filter === 'archived' ? 'coach-chat__chip--on' : ''}`}
              >
                Archivées
              </button>
            </div>
          </div>

          {bootError ? (
            <p className="mx-3 mb-2 rounded-[var(--radius-sm)] border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[color:var(--danger)]">
              {bootError}
            </p>
          ) : null}

          <ul className="coach-chat__list">
            {bootPending && !inbox.length ? (
              <li className="space-y-2 px-3 py-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
                    <div className="min-w-0 flex-1 space-y-2 py-1">
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--accent)]" />
                      <div className="h-2.5 w-full animate-pulse rounded bg-[var(--accent)]" />
                    </div>
                  </div>
                ))}
              </li>
            ) : !filtered.length ? (
              <li className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">
                Aucune conversation{q || filter !== 'all' ? ' pour ce filtre' : ''}.
              </li>
            ) : (
              filtered.map((item) => {
                const active = item.threadId === activeThreadId
                return (
                  <li key={item.threadId}>
                    <Link
                      href={`/chat/${item.threadId}`}
                      prefetch
                      onClick={() => {
                        if (item.threadId === activeThreadId) return
                        setPendingTarget(item.threadId)
                        // Prefetch agressif au clic (souvent déjà fait au hover)
                        prefetchThreadBundle(item.threadId)
                      }}
                      onPointerEnter={() => {
                        shellNav?.prefetchNav(`/chat/${item.threadId}`)
                        prefetchThreadBundle(item.threadId)
                      }}
                      className={`coach-chat__row ${active ? 'coach-chat__row--active' : ''} ${
                        item.unread ? 'coach-chat__row--unread' : ''
                      }`}
                    >
                      <span className="coach-chat__avatar" aria-hidden>
                        {item.kind === 'group' ? (
                          <IconUsers size={18} />
                        ) : (
                          initialsFromName(item.title)
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[color:var(--fg)]">
                            {item.pinned ? '📌 ' : ''}
                            {item.title}
                            {item.archived ? ' · arch.' : ''}
                          </span>
                          <span className="shrink-0 text-[10px] text-[color:var(--muted)]">
                            {inboxListTime(item.at)}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--muted)]">
                            {item.kind === 'group' ? `Groupe · ${item.preview}` : item.preview || '—'}
                          </span>
                          {item.unread ? <span className="coach-chat__badge" /> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </aside>

        <section className="coach-chat__panel">{children}</section>
      </div>
      </div>

      <NewChatModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={clients}
        groups={groups}
      />
    </ChatWorkspaceProvider>
  )
}

export function CoachChatEmptyPanel() {
  return (
    <div className="coach-chat__empty">
      <div className="coach-chat__empty-card">
        <p className="text-base font-extrabold text-[color:var(--fg)]">Tes messages</p>
        <p className="mt-1 max-w-xs text-sm text-[color:var(--muted)]">
          Sélectionne une conversation, ou appuie sur <strong>+</strong> pour écrire à un client ou
          créer un groupe.
        </p>
      </div>
    </div>
  )
}
