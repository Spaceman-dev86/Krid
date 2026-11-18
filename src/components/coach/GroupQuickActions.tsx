'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { enableGroupChatAction, updateGroupAction } from '@/src/app/clients/groupes/actions'
import { FluidSpinner } from '@/src/components/admin/FluidSpinner'
import { Button, IconClose, daFieldClass } from '@/src/components/ui'

type Props = {
  group: {
    id: string
    name: string
    description: string | null
    chat_enabled: boolean
  }
  chatThreadId: string | null
}

function SubmitSave({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="!rounded-lg !px-4 !py-2 text-sm font-bold">
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <FluidSpinner size={12} className="text-[var(--brand-fg)]" />
          …
        </span>
      ) : (
        label
      )}
    </Button>
  )
}

function ModalShell({
  title,
  titleId,
  onClose,
  children,
}: {
  title: string
  titleId: string
  onClose: () => void
  children: ReactNode
}) {
  return (
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
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-w-md rounded-t-[1.25rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-md sm:rounded-[1.25rem] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p id={titleId} className="text-sm font-extrabold text-[color:var(--fg)]">
            {title}
          </p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted)] hover:bg-[var(--accent)] hover:text-[color:var(--fg)]"
            aria-label="Fermer"
            onClick={onClose}
          >
            <IconClose size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const pillBtn =
  '!rounded-[var(--radius-sm)] !px-3 !py-1.5 text-sm font-semibold'

export function GroupQuickActions({ group, chatThreadId }: Props) {
  const editTitleId = useId()
  const chatTitleId = useId()
  const [editOpen, setEditOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const anyOpen = editOpen || chatOpen
  useEffect(() => {
    if (!anyOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditOpen(false)
        setChatOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [anyOpen])

  const chatHref =
    group.chat_enabled && chatThreadId
      ? `/chat/${chatThreadId}`
      : group.chat_enabled
        ? '/chat'
        : null

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={pillBtn}
          onClick={() => setEditOpen(true)}
        >
          Éditer
        </Button>

        {chatHref ? (
          <Button href={chatHref} variant="secondary" size="sm" className={pillBtn}>
            Ouvrir le chat
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className={pillBtn}
            onClick={() => setChatOpen(true)}
          >
            Créer le chat
          </Button>
        )}
      </div>

      {editOpen ? (
        <ModalShell title="Infos du groupe" titleId={editTitleId} onClose={() => setEditOpen(false)}>
          <form action={updateGroupAction} className="grid gap-3">
            <input type="hidden" name="id" value={group.id} />
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Titre</span>
              <input name="name" defaultValue={group.name} required autoFocus className={daFieldClass} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Description</span>
              <textarea
                name="description"
                defaultValue={group.description ?? ''}
                rows={3}
                placeholder="Optionnel"
                className={daFieldClass}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditOpen(false)}
                className="!rounded-lg !px-4 !py-2 text-sm"
              >
                Annuler
              </Button>
              <SubmitSave label="Enregistrer" />
            </div>
          </form>
        </ModalShell>
      ) : null}

      {chatOpen ? (
        <ModalShell title="Créer le chat" titleId={chatTitleId} onClose={() => setChatOpen(false)}>
          <form action={enableGroupChatAction} className="grid gap-3">
            <input type="hidden" name="id" value={group.id} />
            <p className="text-xs text-[color:var(--muted)]">
              Nomme le salon et envoie le premier message. Les membres le verront dans Messagerie.
            </p>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Nom du chat *</span>
              <input
                name="chat_title"
                required
                autoFocus
                defaultValue={group.name}
                placeholder="ex. Soft — questions"
                className={daFieldClass}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-semibold text-[color:var(--fg)]">Premier message *</span>
              <textarea
                name="first_message"
                required
                rows={3}
                placeholder="Bienvenue dans le groupe…"
                className={daFieldClass}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setChatOpen(false)}
                className="!rounded-lg !px-4 !py-2 text-sm"
              >
                Annuler
              </Button>
              <SubmitSave label="Créer et ouvrir" />
            </div>
          </form>
        </ModalShell>
      ) : null}
    </>
  )
}
