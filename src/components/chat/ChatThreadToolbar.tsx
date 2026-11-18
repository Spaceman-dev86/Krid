'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button } from '@/src/components/ui'

export type ChatMediaFilter = 'all' | 'image' | 'video' | 'file'

type Member = { clientId: string; label: string }
type ClientOpt = { id: string; label: string }

export type ChatMediaGalleryItem = {
  id: string
  kind: string
  url?: string | null
  name?: string | null
  body?: string | null
}

type Props = {
  threadId: string
  archived?: boolean
  stateAction?: (formData: FormData) => void | Promise<void>
  clearHistoryAction?: (formData: FormData) => void | Promise<void>
  renameGroupAction?: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
  onSearchChange?: (q: string) => void
  mediaFilter?: ChatMediaFilter
  onMediaFilterChange?: (f: ChatMediaFilter) => void
  mediaItems?: ChatMediaGalleryItem[]
  onJumpToMessage?: (messageId: string) => void
  groupHref?: string | null
  groupId?: string | null
  groupName?: string | null
  groupDescription?: string | null
  groupMembers?: Member[]
  allClients?: ClientOpt[]
  groupMemberAction?: (formData: FormData) => void | Promise<void>
  /** Coach only — clear history + rename group */
  coachTools?: boolean
}

function PendingSubmit({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <>
      {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
      {pending ? busy : idle}
    </>
  )
}

export function ChatThreadToolbar({
  threadId,
  archived = false,
  stateAction,
  clearHistoryAction,
  renameGroupAction,
  hiddenFields,
  onSearchChange,
  mediaFilter = 'all',
  onMediaFilterChange,
  mediaItems = [],
  onJumpToMessage,
  groupHref,
  groupId,
  groupName,
  groupDescription,
  groupMembers = [],
  allClients = [],
  groupMemberAction,
  coachTools = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open && !membersOpen && !renameOpen && !clearOpen) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const el = rootRef.current
      const target = e.target as Node | null
      if (!el || !target) return
      if (!el.contains(target)) {
        setOpen(false)
        setMembersOpen(false)
        setRenameOpen(false)
        setClearOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setMembersOpen(false)
        setRenameOpen(false)
        setClearOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, membersOpen, renameOpen, clearOpen])

  const memberIds = new Set(groupMembers.map((m) => m.clientId))
  const addable = allClients.filter((c) => !memberIds.has(c.id))

  const filters: Array<{ id: ChatMediaFilter; label: string }> = [
    { id: 'all', label: 'Tout' },
    { id: 'image', label: 'Photos' },
    { id: 'video', label: 'Vidéos' },
    { id: 'file', label: 'Docs' },
  ]

  const gallery = mediaItems.filter((m) => {
    if (mediaFilter === 'all') return false
    if (mediaFilter === 'image') {
      return m.kind === 'image' || m.kind === 'gif' || m.kind === 'sticker'
    }
    if (mediaFilter === 'video') return m.kind === 'video'
    if (mediaFilter === 'file') return m.kind === 'file' || m.kind === 'audio' // docs + vocaux
    return false
  })

  function closeAll() {
    setOpen(false)
    setMembersOpen(false)
    setRenameOpen(false)
    setClearOpen(false)
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-1" data-thread-menu>
      <button
        type="button"
        onClick={() => {
          setMembersOpen(false)
          setRenameOpen(false)
          setClearOpen(false)
          setOpen((v) => !v)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-[color:var(--muted)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
        aria-label="Options conversation"
        aria-expanded={open}
      >
        ⋯
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-72 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-da-md"
        >
          <div className="border-b border-[var(--border)] px-3 py-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Rechercher
              </span>
              <input
                value={q}
                autoFocus
                onChange={(e) => {
                  setQ(e.target.value)
                  onSearchChange?.(e.target.value)
                }}
                placeholder="Dans cette discussion…"
                className="w-full rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs text-[color:var(--fg)] outline-none ring-1 ring-[var(--border)] focus:ring-[var(--brand)]"
              />
            </label>
          </div>

          <div className="border-b border-[var(--border)] px-3 py-2">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
              Médias
            </p>
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onMediaFilterChange?.(f.id)}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                    mediaFilter === f.id
                      ? 'bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] text-[color:var(--fg)] ring-[var(--brand)]'
                      : 'text-[color:var(--muted)] ring-[var(--border)] hover:bg-[var(--accent)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {mediaFilter !== 'all' ? (
              <div className="mt-2 max-h-56 overflow-y-auto overflow-x-visible px-0.5 py-1">
                {!gallery.length ? (
                  <p className="py-3 text-center text-[11px] text-[color:var(--muted)]">
                    Aucun média de ce type
                  </p>
                ) : (
                  <ul className="grid grid-cols-3 gap-2">
                    {gallery.slice(0, 30).map((item) => (
                      <li key={item.id} className="min-w-0">
                        <button
                          type="button"
                          title={item.name || item.body || 'Média'}
                          onClick={() => {
                            onJumpToMessage?.(item.id)
                            closeAll()
                          }}
                          className="flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-xl bg-[var(--accent)] p-1.5 ring-1 ring-[var(--border)]"
                        >
                          {item.url && (item.kind === 'image' || item.kind === 'gif' || item.kind === 'sticker') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.url} alt="" className="h-full w-full rounded-lg object-cover" />
                          ) : item.url && item.kind === 'video' ? (
                            <video src={item.url} className="h-full w-full rounded-lg object-cover" muted />
                          ) : (
                            <>
                              <span className="text-base leading-none" aria-hidden>
                                {item.kind === 'audio' ? '🎤' : '📄'}
                              </span>
                              <span className="line-clamp-2 w-full break-all text-center text-[9px] font-bold leading-tight text-[color:var(--muted)]">
                                {item.name || 'Fichier'}
                              </span>
                            </>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          {stateAction ? (
            <form action={stateAction} className="contents">
              <input type="hidden" name="thread_id" value={threadId} />
              <input type="hidden" name="archived" value={archived ? '0' : '1'} />
              {hiddenFields
                ? Object.entries(hiddenFields).map(([k, v]) => (
                    <input key={k} type="hidden" name={k} value={v} />
                  ))
                : null}
              <button
                type="submit"
                className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
                onClick={() => closeAll()}
              >
                {archived ? 'Désarchiver' : 'Archiver la conversation'}
              </button>
            </form>
          ) : null}

          {groupId && groupMemberAction ? (
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
              onClick={() => {
                setOpen(false)
                setMembersOpen(true)
              }}
            >
              Membres du groupe
            </button>
          ) : null}

          {coachTools && groupId && renameGroupAction ? (
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
              onClick={() => {
                setOpen(false)
                setRenameOpen(true)
              }}
            >
              Renommer le groupe
            </button>
          ) : null}

          {groupHref ? (
            <a
              href={groupHref}
              className="flex w-full px-3 py-2 text-left text-sm hover:bg-[var(--accent)]"
              onClick={() => closeAll()}
            >
              Fiche groupe
            </a>
          ) : null}

          {coachTools && clearHistoryAction ? (
            <button
              type="button"
              className="flex w-full px-3 py-2 text-left text-sm text-[color:var(--danger)] hover:bg-[var(--accent)]"
              onClick={() => {
                setOpen(false)
                setClearOpen(true)
              }}
            >
              Effacer l’historique…
            </button>
          ) : null}
        </div>
      ) : null}

      {membersOpen && groupId && groupMemberAction ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-extrabold text-[color:var(--fg)]">Membres</p>
            <button type="button" className="text-sm" onClick={() => setMembersOpen(false)}>
              ×
            </button>
          </div>
          <ul className="max-h-40 overflow-y-auto py-1">
            {groupMembers.map((m) => (
              <li key={m.clientId} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate text-xs font-semibold">{m.label}</span>
                <form action={groupMemberAction}>
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="group_id" value={groupId} />
                  <input type="hidden" name="client_id" value={m.clientId} />
                  <input type="hidden" name="op" value="remove" />
                  <button type="submit" className="text-[10px] font-bold text-[color:var(--danger)]">
                    Retirer
                  </button>
                </form>
              </li>
            ))}
          </ul>
          {addable.length ? (
            <div className="border-t border-[var(--border)] py-1">
              <p className="px-3 py-1 text-[10px] font-bold uppercase text-[color:var(--muted)]">
                Ajouter
              </p>
              <ul className="max-h-32 overflow-y-auto">
                {addable.slice(0, 40).map((c) => (
                  <li key={c.id}>
                    <form action={groupMemberAction}>
                      <input type="hidden" name="thread_id" value={threadId} />
                      <input type="hidden" name="group_id" value={groupId} />
                      <input type="hidden" name="client_id" value={c.id} />
                      <input type="hidden" name="op" value="add" />
                      <button
                        type="submit"
                        className="flex w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-[var(--accent)]"
                      >
                        + {c.label}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {renameOpen && groupId && renameGroupAction ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-extrabold text-[color:var(--fg)]">Renommer le groupe</p>
            <button type="button" className="text-sm" onClick={() => setRenameOpen(false)}>
              ×
            </button>
          </div>
          <form action={renameGroupAction} className="grid gap-2 p-3">
            <input type="hidden" name="thread_id" value={threadId} />
            <input type="hidden" name="group_id" value={groupId} />
            <label className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Nom
              </span>
              <input
                name="name"
                required
                defaultValue={groupName ?? ''}
                className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--brand)]"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Description
              </span>
              <textarea
                name="description"
                rows={2}
                defaultValue={groupDescription ?? ''}
                placeholder="Optionnel"
                className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--brand)]"
              />
            </label>
            <Button
              type="submit"
              className="inline-flex items-center justify-center gap-2 !rounded-lg !px-3 !py-1.5 text-xs font-bold"
            >
              <PendingSubmit idle="Enregistrer" busy="…" />
            </Button>
          </form>
        </div>
      ) : null}

      {clearOpen && clearHistoryAction ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-da-md">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-xs font-extrabold text-[color:var(--fg)]">Effacer l’historique</p>
            <button type="button" className="text-sm" onClick={() => setClearOpen(false)}>
              ×
            </button>
          </div>
          <div className="grid gap-2 p-3">
            <p className="text-xs text-[color:var(--muted)]">
              Supprime tous les messages pour tout le monde. Irréversible.
            </p>
            <form action={clearHistoryAction} className="flex gap-2">
              <input type="hidden" name="thread_id" value={threadId} />
              <input type="hidden" name="confirm" value="1" />
              <Button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 !rounded-lg !px-3 !py-1.5 text-xs font-bold !bg-[var(--danger)] !text-[color:var(--page-bg)]"
              >
                <PendingSubmit idle="Confirmer" busy="…" />
              </Button>
              <button
                type="button"
                onClick={() => setClearOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-bold ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
              >
                Annuler
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
