'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  moveFolderAction,
  shareFolderToClientAction,
  softDeleteFolderAction,
} from '@/src/app/drive/actions'
import { IconButton, IconMove, IconShare, IconTrash, daFieldClass } from '@/src/components/ui'
import type { DriveFolderOption } from '@/src/lib/drive/drive'

type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; label: string }
type ActionKey = 'move' | 'share' | 'archive'
type Panel = ActionKey | null

function descendantIdsOf(folderId: string, targets: DriveFolderOption[]): Set<string> {
  const kids = new Map<string | null, string[]>()
  for (const t of targets) {
    const list = kids.get(t.parent_id) ?? []
    list.push(t.id)
    kids.set(t.parent_id, list)
  }
  const out = new Set<string>([folderId])
  const stack = [folderId]
  while (stack.length) {
    const id = stack.pop()!
    for (const child of kids.get(id) ?? []) {
      if (!out.has(child)) {
        out.add(child)
        stack.push(child)
      }
    }
  }
  return out
}

/** Ordre : déplacer · partager · archiver. */
export function DriveFolderActions({
  folderId,
  parentId,
  currentParentId,
  clients,
  groups,
  moveTargets,
  alreadySharedClientIds,
  alreadySharedGroupIds,
  listFolderId,
  show = ['move', 'share', 'archive'],
  bare = false,
  onMoved,
  onArchived,
  onShared,
}: {
  folderId: string
  parentId: string | null
  currentParentId: string | null
  clients: ClientOpt[]
  groups: GroupOpt[]
  moveTargets: DriveFolderOption[]
  alreadySharedClientIds: Set<string>
  alreadySharedGroupIds: Set<string>
  listFolderId: string | null
  show?: ActionKey[]
  bare?: boolean
  /** Optimistic : retire le dossier de la vue (pas de refresh RSC). */
  onMoved?: () => void
  onArchived?: () => void
  onShared?: () => void
}) {
  const [panel, setPanel] = useState<Panel>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
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

  const blocked = descendantIdsOf(folderId, moveTargets)
  const options = moveTargets.filter((t) => !blocked.has(t.id))
  const availableClients = clients.filter((c) => !alreadySharedClientIds.has(c.id))
  const availableGroups = groups.filter((g) => !alreadySharedGroupIds.has(g.id))
  const has = (k: ActionKey) => show.includes(k)
  const close = () => {
    setPanel(null)
    setError(null)
  }

  function runAction(
    kind: ActionKey,
    action: (fd: FormData) => Promise<{ ok: true; navigateTo?: string | null } | { ok: false; error: string }>,
    fd: FormData,
  ) {
    setError(null)
    close() // ferme le panel tout de suite (feedback immédiat)

    startTransition(async () => {
      const res = await action(fd)
      if (!res.ok) {
        setError(res.error)
        setPanel(kind)
        return
      }
      if (kind === 'move') onMoved?.()
      if (kind === 'archive') onArchived?.()
      if (kind === 'share') onShared?.()
      if (res.navigateTo != null) {
        router.push(res.navigateTo || '/drive')
        return
      }
      // Header (pas de callback) : refresh léger.
      if ((kind === 'move' && !onMoved) || (kind === 'share' && !onShared) || (kind === 'archive' && !onArchived)) {
        router.refresh()
      }
    })
  }

  const panelClass =
    'absolute right-0 bottom-full z-[100] mb-1 min-w-[14rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md'

  return (
    <div
      ref={rootRef}
      data-drive-panel-open={panel ? '' : undefined}
      data-no-dnd
      className="relative z-[40] flex shrink-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
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
        <div className={panelClass}>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              const raw = String(fd.get('target_folder_id') ?? '')
              const target = raw === '__root__' || !raw ? null : raw
              // Même parent = no-op silencieux.
              if (target === (currentParentId ?? null) || target === (parentId ?? null)) {
                close()
                return
              }
              runAction('move', moveFolderAction, fd)
            }}
          >
            <input type="hidden" name="folder_id" value={folderId} />
            <input type="hidden" name="from_parent_id" value={parentId ?? ''} />
            <select name="target_folder_id" defaultValue={currentParentId ?? '__root__'} className={`${daFieldClass} text-xs`}>
              <option value="__root__">Drive (racine)</option>
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[10px] font-bold text-[var(--brand-fg)] disabled:opacity-60"
            >
              {pending ? '…' : 'Déplacer'}
            </button>
          </form>
        </div>
      ) : null}

      {panel === 'share' ? (
        <div className={panelClass}>
          {!availableClients.length && !availableGroups.length ? (
            <p className="text-[11px] font-semibold text-[color:var(--muted)]">
              Déjà partagé avec tous, ou aucun destinataire.
            </p>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                runAction('share', shareFolderToClientAction, new FormData(e.currentTarget))
              }}
            >
              <input type="hidden" name="share_folder_id" value={folderId} />
              {listFolderId ? <input type="hidden" name="folder_id" value={listFolderId} /> : null}
              <select name="audience" required defaultValue="" className={`${daFieldClass} text-xs`}>
                <option value="" disabled>
                  Destinataire…
                </option>
                {availableClients.length ? (
                  <optgroup label="Clients">
                    {availableClients.map((c) => (
                      <option key={`c-${c.id}`} value={`client:${c.id}`}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {availableGroups.length ? (
                  <optgroup label="Groupes">
                    {availableGroups.map((g) => (
                      <option key={`g-${g.id}`} value={`group:${g.id}`}>
                        {g.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--brand)] px-2 py-1.5 text-[10px] font-bold text-[var(--brand-fg)] disabled:opacity-60"
              >
                {pending ? '…' : 'Partager'}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {panel === 'archive' ? (
        <div className={`${panelClass} min-w-[11rem]`}>
          <button
            type="button"
            disabled={pending}
            className="text-xs font-semibold text-[var(--danger)] hover:underline disabled:opacity-60"
            onClick={() => {
              if (!window.confirm('Archiver cet élément ? Il disparaîtra de la liste (contenu inclus pour un dossier).')) {
                return
              }
              const fd = new FormData()
              fd.set('folder_id', folderId)
              fd.set('parent_id', parentId ?? '')
              if (listFolderId) fd.set('list_folder_id', listFolderId)
              runAction('archive', softDeleteFolderAction, fd)
            }}
          >
            {pending ? 'Archivage…' : 'Confirmer l’archivage'}
          </button>
        </div>
      ) : null}

      {error ? <p className="absolute right-0 top-full z-[100] mt-1 text-[10px] font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  )
}
