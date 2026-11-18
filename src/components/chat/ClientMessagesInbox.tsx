'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

import { inboxListTime, initialsFromName, type ChatInboxItem } from '../../lib/chat/chat'
import { contrastBrandFg } from '../../lib/coach/clientBrandTheme'
import { IconCaret, IconUsers } from '../ui/icons'

type Props = {
  slug: string
  primaryColor: string
  secondaryColor?: string | null
  coachName: string
  inbox: ChatInboxItem[]
  startCoachDmAction: (formData: FormData) => void | Promise<void>
}

export function ClientMessagesInbox({
  slug,
  primaryColor,
  secondaryColor,
  coachName,
  inbox,
  startCoachDmAction,
}: Props) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'group'>('all')
  const listRef = useRef<HTMLUListElement | null>(null)

  const hasDm = useMemo(() => inbox.some((i) => i.kind === 'dm' && !i.archived), [inbox])
  const brandFg = useMemo(() => contrastBrandFg(primaryColor), [primaryColor])

  // Trackpad : même fix que le fil (parents overflow:hidden)
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!el || el.scrollHeight <= el.clientHeight + 1) return
      const next = el.scrollTop + e.deltaY
      const max = el.scrollHeight - el.clientHeight
      if (next <= 0 && el.scrollTop <= 0) return
      if (next >= max && el.scrollTop >= max - 1) return
      el.scrollTop = Math.max(0, Math.min(max, next))
      e.preventDefault()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return inbox.filter((item) => {
      // Client : pas d’archivage — on masque les fils archivés côté coach
      if (item.archived) return false
      if (filter === 'unread' && !item.unread) return false
      if (filter === 'group' && item.kind !== 'group') return false
      if (!needle) return true
      return (
        item.title.toLowerCase().includes(needle) ||
        item.preview.toLowerCase().includes(needle)
      )
    })
  }, [inbox, q, filter])

  return (
    <div
      className="coach-chat coach-chat--list client-chat"
      style={
        {
          ['--brand']: primaryColor,
          ['--brand-fg']: brandFg,
          ['--brand-secondary']: secondaryColor?.trim() || primaryColor,
        } as CSSProperties
      }
    >
      <aside className="coach-chat__aside">
        <div className="coach-chat__aside-head">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/c/${slug}/coach`}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
                aria-label="Retour au coach"
              >
                <IconCaret dir="left" />
              </Link>
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[color:var(--fg)]">
                Messages
              </h1>
            </div>
            {!hasDm ? (
              <form action={startCoachDmAction}>
                <input type="hidden" name="slug" value={slug} />
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[var(--brand)] px-3 text-xs font-bold text-[var(--brand-fg)] shadow-da-brand"
                >
                  Écrire au coach
                </button>
              </form>
            ) : null}
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
            {(
              [
                ['all', 'Toutes'],
                ['unread', 'Non lues'],
                ['group', 'Groupe'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`coach-chat__chip ${filter === id ? 'coach-chat__chip--on' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul ref={listRef} className="coach-chat__list">
          {!inbox.length ? (
            <li className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">
              Pas encore de conversation.
              <br />
              Touche <strong className="text-[color:var(--fg)]">Écrire au coach</strong> pour démarrer
              (1:1).
              <br />
              <span className="mt-2 block text-xs">
                Les groupes créés par ton coach apparaîtront ici.
              </span>
            </li>
          ) : !filtered.length ? (
            <li className="px-4 py-8 text-center text-sm text-[color:var(--muted)]">
              Aucune conversation pour ce filtre.
            </li>
          ) : (
            filtered.map((item) => (
              <li key={item.threadId}>
                <Link
                  href={`/c/${slug}/messages/${item.threadId}`}
                  className={`coach-chat__row ${item.unread ? 'coach-chat__row--unread' : ''}`}
                >
                  <span className="coach-chat__avatar" aria-hidden>
                    {item.kind === 'group' ? (
                      <IconUsers size={18} />
                    ) : (
                      initialsFromName(item.title || coachName)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[color:var(--fg)]">
                        {item.pinned ? '📌 ' : ''}
                        {item.title}
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
            ))
          )}
        </ul>
      </aside>
    </div>
  )
}
