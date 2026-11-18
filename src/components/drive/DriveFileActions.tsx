'use client'

import { useEffect, useRef, useState } from 'react'

import {
  moveFileAction,
  shareFileToClientAction,
  softDeleteFileAction,
} from '@/src/app/drive/actions'
import { DriveConfirmArchiveButton } from '@/src/components/drive/DriveConfirmArchiveButton'
import { DrivePendingSubmit } from '@/src/components/drive/DrivePendingSubmit'
import { DriveQuietForm } from '@/src/components/drive/DriveQuietForm'
import { IconButton, IconMove, IconShare, IconTrash, daFieldClass } from '@/src/components/ui'
import type { DriveFolderOption } from '@/src/lib/drive/drive'

type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; label: string }
type ActionKey = 'move' | 'share' | 'archive'
type Panel = ActionKey | null

/** Ordre : déplacer · partager · archiver. */
export function DriveFileActions({
  fileId,
  folderId,
  currentFolderId,
  clients,
  groups,
  moveTargets,
  alreadySharedClientIds,
  alreadySharedGroupIds,
  show = ['move', 'share', 'archive'],
  bare = false,
}: {
  fileId: string
  folderId: string | null
  currentFolderId: string | null
  clients: ClientOpt[]
  groups: GroupOpt[]
  moveTargets: DriveFolderOption[]
  alreadySharedClientIds: Set<string>
  alreadySharedGroupIds: Set<string>
  show?: ActionKey[]
  bare?: boolean
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const tone = bare ? 'ghost' : 'soft'

  useEffect(() => {
    if (!panel) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setPanel(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [panel])

  const availableClients = clients.filter((c) => !alreadySharedClientIds.has(c.id))
  const availableGroups = groups.filter((g) => !alreadySharedGroupIds.has(g.id))
  const has = (k: ActionKey) => show.includes(k)
  const close = () => setPanel(null)

  return (
    <div
      ref={rootRef}
      data-drive-panel-open={panel ? '' : undefined}
      className="relative z-[40] flex shrink-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {has('move') ? (
        <IconButton
          type="button"
          label="Déplacer"
          size="sm"
          tone={tone}
          onClick={() => setPanel((p) => (p === 'move' ? null : 'move'))}
        >
          <IconMove size={16} />
        </IconButton>
      ) : null}
      {has('share') ? (
        <IconButton
          type="button"
          label="Partager"
          size="sm"
          tone={tone}
          onClick={() => setPanel((p) => (p === 'share' ? null : 'share'))}
        >
          <IconShare size={16} />
        </IconButton>
      ) : null}
      {has('archive') ? (
        <IconButton
          type="button"
          label="Archiver"
          size="sm"
          tone={tone}
          onClick={() => setPanel((p) => (p === 'archive' ? null : 'archive'))}
        >
          <IconTrash size={16} />
        </IconButton>
      ) : null}

      {panel === 'move' ? (
        <div className="absolute right-0 top-full z-[100] mt-1 min-w-[14rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md">
          <DriveQuietForm action={moveFileAction} successMsg="Déplacé" className="flex flex-col gap-2" onSuccess={close}>
            <input type="hidden" name="file_id" value={fileId} />
            <input type="hidden" name="from_folder_id" value={currentFolderId ?? ''} />
            <select name="target_folder_id" defaultValue={folderId ?? '__root__'} className={`${daFieldClass} text-xs`}>
              <option value="__root__">Drive (racine)</option>
              {moveTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <DrivePendingSubmit
              idle="Déplacer"
              pending="…"
              className="rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[10px] font-bold text-[var(--brand-fg)]"
            />
          </DriveQuietForm>
        </div>
      ) : null}

      {panel === 'share' ? (
        <div className="absolute right-0 top-full z-[100] mt-1 min-w-[14rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md">
          {!availableClients.length && !availableGroups.length ? (
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">
              Déjà couvert, ou aucun destinataire.
            </p>
          ) : (
            <DriveQuietForm
              action={shareFileToClientAction}
              successMsg="Partagé"
              className="flex flex-col gap-2"
              onSuccess={close}
            >
              <input type="hidden" name="file_id" value={fileId} />
              {currentFolderId ? <input type="hidden" name="folder_id" value={currentFolderId} /> : null}
              <select name="audience" required defaultValue="" className={`${daFieldClass} text-xs`}>
                <option value="" disabled>
                  Destinataire…
                </option>
                {availableClients.length ? (
                  <optgroup label="Clients">
                    {availableClients.map((c) => (
                      <option key={c.id} value={`client:${c.id}`}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {availableGroups.length ? (
                  <optgroup label="Groupes">
                    {availableGroups.map((g) => (
                      <option key={g.id} value={`group:${g.id}`}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <DrivePendingSubmit
                idle="Partager"
                pending="…"
                className="rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[10px] font-bold text-[var(--brand-fg)]"
              />
            </DriveQuietForm>
          )}
        </div>
      ) : null}

      {panel === 'archive' ? (
        <div className="absolute right-0 top-full z-[100] mt-1 min-w-[11rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md">
          <DriveQuietForm action={softDeleteFileAction} successMsg="Archivé" onSuccess={close}>
            <input type="hidden" name="file_id" value={fileId} />
            {currentFolderId ? <input type="hidden" name="folder_id" value={currentFolderId} /> : null}
            <DriveConfirmArchiveButton label="Confirmer l’archivage" />
          </DriveQuietForm>
        </div>
      ) : null}
    </div>
  )
}
