'use client'

import { useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconUsers } from '@/src/components/ui'
import { clientDisplayName, initialsFromName } from '@/src/lib/chat/chat'
import {
  createChatGroupAction,
  openDmWithClientAction,
  openGroupThreadAction,
} from '@/src/app/chat/actions'

export type NewChatClient = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
}

export type NewChatGroup = {
  id: string
  name: string
  chat_enabled: boolean
  memberCount: number
}

type Tab = 'search' | 'group'

type Props = {
  open: boolean
  onClose: () => void
  clients: NewChatClient[]
  groups: NewChatGroup[]
}

function PendingLabel({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus()
  return (
    <>
      {pending ? <FluidSpinner size={12} className="text-[var(--brand-fg)]" /> : null}
      {pending ? busy : idle}
    </>
  )
}

export function NewChatModal({ open, onClose, clients, groups }: Props) {
  const [tab, setTab] = useState<Tab>('search')
  const [q, setQ] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())

  const needle = q.trim().toLowerCase()
  const filteredClients = useMemo(
    () =>
      clients.filter((c) => {
        const label = clientDisplayName(c).toLowerCase()
        return !needle || label.includes(needle) || c.email.toLowerCase().includes(needle)
      }),
    [clients, needle],
  )
  const filteredGroups = useMemo(
    () =>
      groups.filter((g) => !needle || g.name.toLowerCase().includes(needle)),
    [groups, needle],
  )

  if (!open) return null

  function toggleMember(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-[1] flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.35rem] border border-[var(--border)] bg-[var(--surface)] shadow-da-md sm:rounded-[1.35rem]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted)]">Nouveau</p>
            <h2 className="text-lg font-extrabold text-[color:var(--fg)]">Démarrer une discussion</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-sm font-bold text-[color:var(--muted)] hover:bg-[var(--accent)]"
          >
            Fermer
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={`rounded-t-lg px-3 py-2 text-xs font-bold ${
              tab === 'search'
                ? 'bg-[var(--accent)] text-[color:var(--fg)]'
                : 'text-[color:var(--muted)]'
            }`}
          >
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setTab('group')}
            className={`rounded-t-lg px-3 py-2 text-xs font-bold ${
              tab === 'group'
                ? 'bg-[var(--accent)] text-[color:var(--fg)]'
                : 'text-[color:var(--muted)]'
            }`}
          >
            Créer un groupe
          </button>
        </div>

        {tab === 'search' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="px-4 py-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Client ou groupe…"
                className="w-full rounded-full border border-[var(--border)] bg-[var(--accent)] px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                autoFocus
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Clients
              </p>
              <ul>
                {filteredClients.slice(0, 40).map((c) => {
                  const label = clientDisplayName(c)
                  return (
                    <li key={c.id}>
                      <form action={openDmWithClientAction}>
                        <input type="hidden" name="client_id" value={c.id} />
                        <button type="submit" className="coach-chat__new-row w-full">
                          <span className="coach-chat__avatar">{initialsFromName(label)}</span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-semibold">{label}</span>
                            {c.email ? (
                              <span className="block truncate text-[11px] text-[color:var(--muted)]">
                                {c.email}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </form>
                    </li>
                  )
                })}
                {!filteredClients.length ? (
                  <li className="px-3 py-2 text-xs text-[color:var(--muted)]">Aucun client</li>
                ) : null}
              </ul>

              <p className="mt-4 px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Groupes
              </p>
              <ul>
                {filteredGroups.map((g) => (
                  <li key={g.id}>
                    <form action={openGroupThreadAction}>
                      <input type="hidden" name="group_id" value={g.id} />
                      <button type="submit" className="coach-chat__new-row w-full">
                        <span className="coach-chat__avatar">
                          <IconUsers size={18} />
                        </span>
                        <span className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-semibold">{g.name}</span>
                          <span className="block truncate text-[11px] text-[color:var(--muted)]">
                            {g.memberCount} membre{g.memberCount > 1 ? 's' : ''}
                            {!g.chat_enabled ? ' · active le chat' : ''}
                          </span>
                        </span>
                      </button>
                    </form>
                  </li>
                ))}
                {!filteredGroups.length ? (
                  <li className="px-3 py-2 text-xs text-[color:var(--muted)]">Aucun groupe</li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : (
          <form action={createChatGroupAction} className="flex min-h-0 flex-1 flex-col">
            <div className="space-y-3 px-4 py-3">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  Nom du groupe *
                </span>
                <input
                  name="name"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Ex. Groupe matin"
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--accent)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                  Description
                </span>
                <textarea
                  name="description"
                  value={groupDesc}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  rows={2}
                  placeholder="Optionnel"
                  className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--accent)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]"
                />
              </label>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                Membres ({picked.size})
              </p>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              {clients.map((c) => {
                const label = clientDisplayName(c)
                const on = picked.has(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleMember(c.id)}
                      className={`coach-chat__new-row w-full ${on ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]' : ''}`}
                    >
                      <span className="coach-chat__avatar">{initialsFromName(label)}</span>
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{label}</span>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                          on
                            ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                            : 'ring-1 ring-[var(--border)] text-[color:var(--muted)]'
                        }`}
                      >
                        {on ? '✓' : ''}
                      </span>
                    </button>
                    {on ? <input type="hidden" name="member_id" value={c.id} /> : null}
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-[var(--border)] p-3">
              <Button
                type="submit"
                disabled={!groupName.trim() || picked.size < 1}
                className="inline-flex w-full items-center justify-center gap-2 !rounded-[var(--radius-sm)]"
              >
                <PendingLabel idle="Créer le groupe & ouvrir" busy="Création…" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
