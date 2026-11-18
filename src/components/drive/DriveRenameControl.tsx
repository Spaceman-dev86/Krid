'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { renameFileAction, renameFolderAction } from '@/src/app/drive/actions'
import { IconEdit, daFieldClass } from '@/src/components/ui'

type FolderProps = {
  kind: 'folder'
  id: string
  name: string
  listFolderId: string | null
  /** Classes du titre affiché (édition inline). */
  nameClassName?: string
  size?: 'sm' | 'md' | 'lg'
  onRenamed?: (name: string) => void
}

type FileProps = {
  kind: 'file'
  id: string
  name: string
  currentFolderId: string | null
  nameClassName?: string
  size?: 'sm' | 'md' | 'lg'
  onRenamed?: (name: string) => void
}

const SIZE = {
  sm: { btn: 'h-6 w-6', icon: 13 },
  md: { btn: 'h-[1.2rem] w-[1.2rem]', icon: 18 },
  lg: { btn: 'h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9', icon: 22 },
} as const

/**
 * Rename inline : le titre devient un champ, validation Entrée ou bouton OK, Échap annule.
 */
export function DriveRenameControl(props: FolderProps | FileProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.name)
  const [displayName, setDisplayName] = useState(props.name)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const size = SIZE[props.size ?? 'sm']
  const nameClass =
    props.nameClassName ??
    (props.size === 'lg'
      ? 'min-w-0 truncate text-xl font-extrabold tracking-tight text-[color:var(--fg)] sm:text-2xl md:text-3xl'
      : props.size === 'md'
        ? 'doc-folder-real__title min-w-0 truncate font-extrabold tracking-tight text-[color:var(--fg)]'
        : 'min-w-0 truncate text-sm font-bold text-[color:var(--fg)]')

  // Sync serveur uniquement — ne pas écraser un rename optimistic à la fermeture d’édition.
  useEffect(() => {
    setDisplayName(props.name)
    setDraft(props.name)
  }, [props.name])

  useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editing])

  function cancel() {
    setEditing(false)
    setDraft(displayName)
    setError(null)
  }

  function submit() {
    const next = draft.trim()
    if (!next) {
      setError('Nom requis')
      return
    }
    if (next === displayName) {
      setEditing(false)
      return
    }
    setError(null)
    // Optimistic : ferme l’édition tout de suite.
    const prev = displayName
    setDisplayName(next)
    setEditing(false)
    props.onRenamed?.(next)

    const fd = new FormData()
    if (props.kind === 'folder') {
      fd.set('folder_id', props.id)
      if (props.listFolderId) fd.set('list_folder_id', props.listFolderId)
      fd.set('name', next)
    } else {
      fd.set('file_id', props.id)
      if (props.currentFolderId) fd.set('folder_id', props.currentFolderId)
      fd.set('name', next)
    }

    startTransition(async () => {
      const action = props.kind === 'folder' ? renameFolderAction : renameFileAction
      const res = await action(fd)
      if (!res.ok) {
        setDisplayName(prev)
        setDraft(prev)
        setError(res.error)
        setEditing(true)
      }
    })
  }

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-1 items-center gap-1.5"
      data-drive-panel-open={editing ? '' : undefined}
      data-folder-chrome={editing ? '' : undefined}
      onClick={(e) => {
        // Ne bloque l’open dossier que pour les contrôles (pas le libellé).
        if ((e.target as HTMLElement).closest('button, input')) e.stopPropagation()
      }}
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest('button, input')) e.stopPropagation()
      }}
    >
      {editing ? (
        <>
          <input
            ref={inputRef}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
            }}
            className={`${daFieldClass} min-w-0 flex-1 py-1 text-sm`}
            aria-label="Nouveau nom"
          />
          <button
            type="button"
            disabled={pending}
            onClick={submit}
            className="shrink-0 rounded-lg bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold text-[var(--brand-fg)] disabled:opacity-60"
          >
            {pending ? '…' : 'OK'}
          </button>
          {error ? (
            <span className="sr-only" role="alert">
              {error}
            </span>
          ) : null}
        </>
      ) : (
        <>
          {/* Libellé : laisse passer le clic vers l’open dossier (pochette). */}
          <span className={`${nameClass} pointer-events-none`} title={displayName}>
            {displayName}
          </span>
          <button
            type="button"
            title="Renommer"
            aria-label="Renommer"
            data-folder-chrome
            onClick={(e) => {
              e.stopPropagation()
              setDraft(displayName)
              setEditing(true)
            }}
            className={`pointer-events-auto inline-flex ${size.btn} shrink-0 translate-y-[2px] items-center justify-center rounded-md text-[color:var(--muted)] opacity-55 transition hover:bg-[var(--accent)] hover:text-[color:var(--fg)] hover:opacity-100`}
          >
            <IconEdit size={size.icon} />
          </button>
        </>
      )}
      {error && editing ? (
        <p className="basis-full text-[10px] font-semibold text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  )
}
