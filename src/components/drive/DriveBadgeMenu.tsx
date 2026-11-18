'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { unshareAction } from '@/src/app/drive/actions'
import { DrivePendingSubmit } from '@/src/components/drive/DrivePendingSubmit'
import { DriveQuietForm } from '@/src/components/drive/DriveQuietForm'
import type { DriveShareInfo } from '@/src/lib/drive/drive'

export function DriveBadgeMenu({
  label,
  title,
  children,
  align = 'right',
}: {
  label: ReactNode
  title: string
  children: ReactNode
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--fg)] ring-1 ring-[var(--border)] hover:brightness-105"
      >
        {label}
      </button>
      {open ? (
        <div
          className={`absolute top-full z-30 mt-1 max-h-56 min-w-[12rem] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function DriveShareListMenu({
  shares,
  currentFolderId,
  count,
}: {
  shares: DriveShareInfo[]
  currentFolderId: string | null
  count: number
}) {
  return (
    <DriveBadgeMenu label={count} title={`${count} partage${count > 1 ? 's' : ''} — cliquer pour la liste`}>
      {!shares.length ? (
        <p className="px-1 py-1 text-[11px] font-semibold text-[color:var(--muted)]">Aucun partage</p>
      ) : (
        <ul className="grid gap-1.5">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-semibold text-[color:var(--fg)]">
                {s.kind === 'group' ? `Groupe · ${s.label}` : s.label}
              </span>
              <DriveQuietForm action={unshareAction} successMsg="Partage retiré">
                <input type="hidden" name="share_id" value={s.id} />
                {currentFolderId ? <input type="hidden" name="folder_id" value={currentFolderId} /> : null}
                <DrivePendingSubmit
                  idle="Retirer"
                  pending="…"
                  className="rounded-full bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger)]"
                />
              </DriveQuietForm>
            </li>
          ))}
        </ul>
      )}
    </DriveBadgeMenu>
  )
}

export function DriveFileListMenu({
  files,
  count,
}: {
  files: { id: string; name: string }[]
  count: number
}) {
  return (
    <DriveBadgeMenu
      label={count}
      title={`${count} fichier${count > 1 ? 's' : ''} — cliquer pour la liste`}
    >
      {!files.length ? (
        <p className="px-1 py-1 text-[11px] font-semibold text-[color:var(--muted)]">Aucun fichier</p>
      ) : (
        <ul className="grid gap-1">
          {files.map((f) => (
            <li key={f.id}>
              <span className="block truncate text-[11px] font-semibold text-[color:var(--fg)]" title={f.name}>
                {f.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DriveBadgeMenu>
  )
}

/** Variante brand (badge fichiers DocFolderCard via handlers externes). */
export function DriveFolderFilesPopup({
  files,
  folderId,
}: {
  files: { id: string; name: string }[]
  folderId: string
}) {
  return (
    <ul className="grid gap-1">
      {!files.length ? (
        <li className="text-[11px] font-semibold text-[color:var(--muted)]">Aucun fichier</li>
      ) : (
        files.map((f) => (
          <li key={f.id}>
            <Link
              href={`/drive/${folderId}`}
              className="block truncate text-[11px] font-semibold text-[var(--brand)] hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {f.name}
            </Link>
          </li>
        ))
      )}
    </ul>
  )
}
