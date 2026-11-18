'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition, startTransition } from 'react'

import { loadDriveAuxQuietAction, moveDriveItemQuietAction, unshareAction } from '../../app/drive/actions'
import { DocFolderCard } from '@/src/components/documentation/DocFolderCard'
import { DriveAddPopup } from '@/src/components/drive/DriveAddPopup'
import { useDriveFeedback } from '@/src/components/drive/DriveFeedbackContext'
import { DriveFileActions } from '@/src/components/drive/DriveFileActions'
import { DriveFolderActions } from '@/src/components/drive/DriveFolderActions'
import { DrivePendingSubmit } from '@/src/components/drive/DrivePendingSubmit'
import { DriveQuietForm } from '@/src/components/drive/DriveQuietForm'
import { DriveRenameControl } from '@/src/components/drive/DriveRenameControl'
import { DriveUploadZone } from '@/src/components/drive/DriveUploadZone'
import {
  DRIVE_DND_MIME,
  encodeDriveDnd,
  readDriveDnd,
  wouldCreateFolderCycle,
  type DriveDndPayload,
} from '@/src/components/drive/driveDnd'
import { IconButton, IconList, daFieldClass } from '@/src/components/ui'
import {
  formatBytes,
  type DriveFileRow,
  type DriveFolderOption,
  type DriveFolderRow,
  type DriveShareInfo,
} from '../../lib/drive/drive'
import {
  driveMediaKind,
  driveMediaLabel,
  formatDriveDate,
  type DriveMediaKind,
} from '../../lib/drive/formatDriveDate'
import { openDriveFile } from '../../lib/drive/openDriveFile'

type ClientOpt = { id: string; label: string }
type GroupOpt = { id: string; label: string }
type SortMode = 'newest' | 'oldest'
type TypeFilter = 'all' | 'folder' | 'pdf' | 'image' | 'video' | 'other'
/** gallery = cartes (défaut) · list = explorateur type OS */
type ViewMode = 'gallery' | 'list'

type Props = {
  folders: DriveFolderRow[]
  files: DriveFileRow[]
  folderId: string | null
  parentId: string | null
  folderName?: string | null
  clients: ClientOpt[]
  groups: GroupOpt[]
  moveTargets: DriveFolderOption[]
  sharesByFile: Record<string, DriveShareInfo[]>
  sharesByFolder: Record<string, DriveShareInfo[]>
  fileCountsByFolder?: Record<string, number>
  /** Taille totale (octets) sous chaque dossier. */
  sizeBytesByFolder?: Record<string, number>
  fileNamesByFolder?: Record<string, { id: string; name: string }[]>
  searchFolders?: DriveFolderRow[]
  searchFiles?: DriveFileRow[]
  searchActive?: boolean
  initialQuery?: string
  breadcrumb?: { id: string | null; name: string }[]
}

function MediaGlyph({ kind, size = 'md' }: { kind: DriveMediaKind; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-5 w-5' : 'h-10 w-10'
  if (kind === 'folder') {
    return (
      <svg viewBox="0 0 48 48" className={cls} aria-hidden>
        <path
          d="M8 14h12l4 4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"
          fill="color-mix(in srgb, var(--brand) 28%, transparent)"
        />
        <path d="M8 20h32v18a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V20z" fill="var(--brand)" opacity="0.85" />
      </svg>
    )
  }
  if (kind === 'video') {
    return (
      <svg viewBox="0 0 48 48" className={cls} aria-hidden>
        <rect x="4" y="10" width="40" height="28" rx="6" fill="color-mix(in srgb, var(--brand) 22%, transparent)" />
        <path d="M20 18v12l12-6z" fill="var(--brand)" />
      </svg>
    )
  }
  if (kind === 'image') {
    return (
      <svg viewBox="0 0 48 48" className={cls} aria-hidden>
        <rect x="6" y="10" width="36" height="28" rx="6" fill="color-mix(in srgb, var(--brand) 18%, transparent)" />
        <circle cx="18" cy="20" r="3.5" fill="var(--brand)" />
        <path d="M10 32l10-9 7 6 5-4 6 7H10z" fill="var(--brand)" opacity="0.85" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className={cls} aria-hidden>
      <path
        d="M14 6h14l10 10v26a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z"
        fill="color-mix(in srgb, var(--brand) 20%, transparent)"
      />
      <path d="M28 6v10h10" fill="none" stroke="var(--brand)" strokeWidth="2" />
      <path d="M16 26h16M16 32h12" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function FolderBadgePopups({
  folderId,
  files,
  shares,
  listFolderId,
  open,
  onClose,
}: {
  folderId: string
  files: { id: string; name: string }[]
  shares: DriveShareInfo[]
  listFolderId: string | null
  open: 'files' | 'shares' | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      ref={ref}
      className="absolute right-2 top-10 z-[90] max-h-56 min-w-[13rem] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md"
      onClick={(e) => e.stopPropagation()}
    >
      {open === 'files' ? (
        !files.length ? (
          <p className="text-[11px] font-semibold text-[color:var(--muted)]">Aucun fichier</p>
        ) : (
          <ul className="grid gap-1">
            {files.map((f) => (
              <li key={f.id} className="truncate text-[11px] font-semibold text-[color:var(--fg)]">
                {f.name}
              </li>
            ))}
            <li>
              <Link href={`/drive/${folderId}`} className="text-[11px] font-bold text-[var(--brand)] hover:underline">
                Ouvrir le dossier →
              </Link>
            </li>
          </ul>
        )
      ) : !shares.length ? (
        <p className="text-[11px] font-semibold text-[color:var(--muted)]">Aucun partage</p>
      ) : (
        <ul className="grid gap-1.5">
          {shares.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] font-semibold text-[color:var(--fg)]">
                {s.kind === 'group' ? `Groupe · ${s.label}` : s.label}
              </span>
              <DriveQuietForm action={unshareAction} successMsg="Partage retiré">
                <input type="hidden" name="share_id" value={s.id} />
                {listFolderId ? <input type="hidden" name="folder_id" value={listFolderId} /> : null}
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
    </div>
  )
}

function FileShareBadge({
  shares,
  currentFolderId,
}: {
  shares: DriveShareInfo[]
  currentFolderId: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!shares.length) return null
  return (
    <div ref={ref} className="relative z-[50] inline-flex" data-drive-panel-open={open ? '' : undefined}>
      <button
        type="button"
        title={`${shares.length} partage${shares.length > 1 ? 's' : ''} — cliquer pour la liste`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--fg)] ring-1 ring-[var(--border)]"
      >
        {shares.length}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-[100] mt-1 max-h-48 min-w-[12rem] overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2 shadow-da-md">
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
        </div>
      ) : null}
    </div>
  )
}

function useOpenFile() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function open(fileId: string) {
    setError(null)
    startTransition(async () => {
      const res = await openDriveFile(fileId)
      if (!res.ok) setError(res.error)
    })
  }
  return { open, pending, error }
}

const DRIVE_UI_KEY = 'drive:ui'

function readDriveUi(): { view?: ViewMode; type?: TypeFilter; sort?: SortMode } {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem(DRIVE_UI_KEY) || '{}') as {
      view?: ViewMode
      type?: TypeFilter
      sort?: SortMode
    }
  } catch {
    return {}
  }
}

export function DriveBrowser({
  folders,
  files,
  folderId,
  parentId,
  folderName,
  clients: clientsProp,
  groups: groupsProp,
  moveTargets,
  sharesByFile: sharesByFileProp,
  sharesByFolder: sharesByFolderProp,
  fileCountsByFolder: fileCountsProp = {},
  sizeBytesByFolder: sizeBytesProp = {},
  fileNamesByFolder: fileNamesProp = {},
  searchActive = false,
  initialQuery = '',
  breadcrumb = [{ id: null, name: 'Drive' }],
}: Props) {
  const router = useRouter()
  const { softFlash, softError } = useDriveFeedback()
  const { open: openFile } = useOpenFile()
  const [navPending, startNav] = useTransition()
  const [q, setQ] = useState(initialQuery)
  const [type, setType] = useState<TypeFilter>('all')
  const [sort, setSort] = useState<SortMode>('newest')
  const [view, setView] = useState<ViewMode>('gallery')
  const [uiReady, setUiReady] = useState(false)
  const [badgeOpen, setBadgeOpen] = useState<Record<string, 'files' | 'shares' | null>>({})
  /** DnD souris uniquement (desktop). */
  const [dndOk, setDndOk] = useState(false)
  const [dropOver, setDropOver] = useState<string | null>(null)
  const [dndError, setDndError] = useState<string | null>(null)
  const [dndPending, setDndPending] = useState(false)
  const [clients, setClients] = useState(clientsProp)
  const [groups, setGroups] = useState(groupsProp)
  const [sharesByFile, setSharesByFile] = useState(sharesByFileProp)
  const [sharesByFolder, setSharesByFolder] = useState(sharesByFolderProp)
  const [fileCountsByFolder, setFileCountsByFolder] = useState(fileCountsProp)
  const [sizeBytesByFolder, setSizeBytesByFolder] = useState(sizeBytesProp)
  const [fileNamesByFolder, setFileNamesByFolder] = useState(fileNamesProp)
  const [localFolders, setLocalFolders] = useState(folders)
  const [localFiles, setLocalFiles] = useState(files)

  useEffect(() => {
    setLocalFolders(folders)
    setLocalFiles(files)
  }, [folders, files])

  useEffect(() => {
    const saved = readDriveUi()
    if (saved.view === 'gallery' || saved.view === 'list') setView(saved.view)
    if (saved.type) setType(saved.type)
    if (saved.sort) setSort(saved.sort)
    setUiReady(true)
  }, [])

  useEffect(() => {
    if (!uiReady) return
    try {
      sessionStorage.setItem(DRIVE_UI_KEY, JSON.stringify({ view, type, sort }))
    } catch {
      /* ignore */
    }
  }, [view, type, sort, uiReady])

  useEffect(() => {
    setQ(initialQuery)
  }, [initialQuery])

  /** Clients / shares / badges après paint — ne bloque pas la nav. */
  useEffect(() => {
    let cancelled = false
    const folderIds = folders.map((f) => f.id)
    void loadDriveAuxQuietAction({ folderIds }).then((res) => {
      if (cancelled || !res.ok) return
      setClients(res.clients)
      setGroups(res.groups)
      setSharesByFile(res.sharesByFile)
      setSharesByFolder(res.sharesByFolder)
      setFileCountsByFolder(res.fileCountsByFolder)
      setSizeBytesByFolder(res.sizeBytesByFolder)
      setFileNamesByFolder(res.fileNamesByFolder)
    })
    return () => {
      cancelled = true
    }
  }, [folderId, folders])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)')
    const sync = () => setDndOk(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  function goFolder(href: string) {
    startNav(() => {
      router.push(href)
    })
  }

  function dragStart(e: React.DragEvent, payload: DriveDndPayload) {
    if (!dndOk) {
      e.preventDefault()
      return
    }
    const t = e.target as HTMLElement | null
    if (t?.closest?.('button, a, input, textarea, label, [data-no-dnd]')) {
      e.preventDefault()
      return
    }
    setDndError(null)
    const raw = encodeDriveDnd(payload)
    e.dataTransfer.setData(DRIVE_DND_MIME, raw)
    e.dataTransfer.setData('text/plain', raw)
    e.dataTransfer.effectAllowed = 'move'
  }

  function dragEnd() {
    setDropOver(null)
  }

  function dragOverTarget(e: React.DragEvent, targetKey: string) {
    if (!dndOk) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropOver(targetKey)
  }

  function dropOnFolder(e: React.DragEvent, targetFolderId: string | null) {
    if (!dndOk) return
    e.preventDefault()
    e.stopPropagation()
    setDropOver(null)
    const payload = readDriveDnd(e.dataTransfer)
    if (!payload) return
    // Drop sur soi-même = no-op silencieux (repose à sa place).
    if (payload.kind === 'folder' && payload.id === targetFolderId) return
    if (payload.kind === 'folder' && wouldCreateFolderCycle(payload.id, targetFolderId, moveTargets)) {
      setDndError('Impossible de déplacer un dossier dans un de ses sous-dossiers')
      return
    }
    setDndError(null)
    setDndPending(true)
    // Optimistic : retire de la vue tout de suite (pas d’attente RSC).
    if (payload.kind === 'folder') {
      setLocalFolders((prev) => prev.filter((f) => f.id !== payload.id))
    } else {
      setLocalFiles((prev) => prev.filter((f) => f.id !== payload.id))
    }
    void moveDriveItemQuietAction({
      kind: payload.kind,
      id: payload.id,
      targetFolderId,
      viewFolderId: folderId,
    }).then((res) => {
      setDndPending(false)
      if (!res.ok) {
        setDndError(res.error)
        setLocalFolders(folders)
        setLocalFiles(files)
      }
      // Pas de router.refresh() : l’UI est déjà à jour (optimistic).
    })
  }

  function dropClass(targetKey: string) {
    return dropOver === targetKey
      ? 'ring-2 ring-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]'
      : ''
  }

  // Recherche = filtre client sur le dossier courant uniquement (pas de RSC à chaque frappe).
  const insideFolder = Boolean(folderId)
  const emptyFolder = insideFolder && !localFolders.length && !localFiles.length && !searchActive
  const currentFolderShares = folderId ? (sharesByFolder[folderId] ?? []) : []
  const folderCoveredClientIds = new Set(
    currentFolderShares.filter((s) => s.client_id).map((s) => s.client_id!),
  )
  const folderCoveredGroupIds = new Set(
    currentFolderShares.filter((s) => s.group_id).map((s) => s.group_id!),
  )

  const localNeedle = q.trim().toLowerCase()
  const sourceFolders = useMemo(() => {
    if (!localNeedle) return localFolders
    return localFolders.filter((f) => f.name.toLowerCase().includes(localNeedle))
  }, [localFolders, localNeedle])

  const sourceFiles = useMemo(() => {
    if (!localNeedle) return localFiles
    return localFiles.filter((f) => f.name.toLowerCase().includes(localNeedle))
  }, [localFiles, localNeedle])

  const filteredFolders = useMemo(() => {
    let list = sourceFolders.filter((f) => {
      if (type !== 'all' && type !== 'folder') return false
      return true
    })
    list = [...list].sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return sort === 'newest' ? db - da : da - db
    })
    return list
  }, [sourceFolders, type, sort])

  const filteredFiles = useMemo(() => {
    let list = sourceFiles.filter((f) => {
      const kind = driveMediaKind(f.mime_type, f.name)
      if (type === 'folder') return false
      if (type !== 'all' && kind !== type) return false
      return true
    })
    list = [...list].sort((a, b) => {
      const da = new Date(a.created_at).getTime()
      const db = new Date(b.created_at).getTime()
      return sort === 'newest' ? db - da : da - db
    })
    return list
  }, [sourceFiles, type, sort])

  const filterActive = Boolean(q.trim() || type !== 'all' || searchActive)
  /** Mobile = galerie (cartes) ; desktop = toggle */
  const effectiveView: ViewMode = view

  function fileActionsProps(file: DriveFileRow) {
    const shares = sharesByFile[file.id] ?? []
    return {
      fileId: file.id,
      folderId: file.folder_id,
      currentFolderId: folderId,
      clients,
      groups,
      moveTargets,
      alreadySharedClientIds: new Set([
        ...shares.filter((s) => s.client_id).map((s) => s.client_id!),
        ...folderCoveredClientIds,
      ]),
      alreadySharedGroupIds: new Set([
        ...shares.filter((s) => s.group_id).map((s) => s.group_id!),
        ...folderCoveredGroupIds,
      ]),
    }
  }

  function removeFolderLocal(id: string) {
    setLocalFolders((prev) => prev.filter((x) => x.id !== id))
  }

  function folderActionsProps(f: DriveFolderRow) {
    const shares = sharesByFolder[f.id] ?? []
    return {
      folderId: f.id,
      parentId: folderId,
      currentParentId: f.parent_id,
      clients,
      groups,
      moveTargets,
      alreadySharedClientIds: new Set(shares.filter((s) => s.client_id).map((s) => s.client_id!)),
      alreadySharedGroupIds: new Set(shares.filter((s) => s.group_id).map((s) => s.group_id!)),
      listFolderId: folderId,
      onMoved: () => removeFolderLocal(f.id),
      onArchived: () => removeFolderLocal(f.id),
    }
  }

  return (
    <div className="relative grid min-w-0 gap-3 sm:gap-4">
      {navPending || dndPending ? (
        <div
          className="pointer-events-none absolute inset-0 z-[60] rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--page-bg)_55%,transparent)]"
          aria-hidden
        >
          <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--muted)] shadow-da-sm">
            {dndPending ? 'Déplacement…' : 'Ouverture…'}
          </span>
        </div>
      ) : null}
      {softFlash ? (
        <p className="pointer-events-none absolute left-0 right-0 top-0 z-[70] -translate-y-1 text-center text-[11px] font-bold text-[var(--brand)]">
          {softFlash}
        </p>
      ) : null}
      {softError ? (
        <p className="text-xs font-semibold text-[var(--danger)]" role="alert">
          {softError}
        </p>
      ) : null}

      {/* Toolbar compacte */}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {insideFolder ? (
            <Link
              href={parentId ? `/drive/${parentId}` : '/drive'}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold text-[var(--brand)] hover:underline ${dropClass(
                parentId ? `crumb:${parentId}` : 'crumb:root',
              )}`}
              onDragOver={(e) => dragOverTarget(e, parentId ? `crumb:${parentId}` : 'crumb:root')}
              onDragLeave={() => setDropOver(null)}
              onDrop={(e) => dropOnFolder(e, parentId)}
              title="Déposer ici pour remonter"
            >
              ← Retour
            </Link>
          ) : null}
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-[color:var(--muted)]">
            {breadcrumb.map((b, i) => (
              <span key={`${b.id}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span>/</span> : null}
                {b.id ? (
                  <Link
                    href={`/drive/${b.id}`}
                    className={`rounded-md px-1 py-0.5 text-[var(--brand)] hover:underline ${dropClass(`crumb:${b.id}`)}`}
                    onDragOver={(e) => dragOverTarget(e, `crumb:${b.id}`)}
                    onDragLeave={() => setDropOver(null)}
                    onDrop={(e) => dropOnFolder(e, b.id)}
                    title="Déposer dans ce dossier"
                  >
                    {b.name}
                  </Link>
                ) : (
                  <Link
                    href="/drive"
                    className={`rounded-md px-1 py-0.5 text-[var(--brand)] hover:underline ${dropClass('crumb:root')}`}
                    onDragOver={(e) => dragOverTarget(e, 'crumb:root')}
                    onDragLeave={() => setDropOver(null)}
                    onDrop={(e) => dropOnFolder(e, null)}
                    title="Déposer à la racine Drive"
                  >
                    {b.name}
                  </Link>
                )}
              </span>
            ))}
            {folderName ? (
              <span className="flex min-w-0 items-center gap-1">
                <span>/</span>
                <span className="truncate font-bold text-[color:var(--fg)]">{folderName}</span>
              </span>
            ) : null}
          </nav>
          {insideFolder && folderId ? (
            <DriveFolderActions
              folderId={folderId}
              parentId={parentId}
              currentParentId={parentId}
              clients={clients}
              groups={groups}
              moveTargets={moveTargets}
              alreadySharedClientIds={folderCoveredClientIds}
              alreadySharedGroupIds={folderCoveredGroupIds}
              listFolderId={folderId}
              show={['move', 'archive']}
            />
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            <IconButton
              type="button"
              label="Vue galerie"
              size="sm"
              tone={view === 'gallery' ? 'solid' : 'soft'}
              onClick={() => setView('gallery')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </IconButton>
            <IconButton
              type="button"
              label="Vue liste"
              size="sm"
              tone={view === 'list' ? 'solid' : 'soft'}
              onClick={() => setView('list')}
            >
              <IconList size={16} />
            </IconButton>
          </div>
          <DriveAddPopup folderId={folderId} />
        </div>
      </div>

      {/* Partages du dossier courant — card + icône partager */}
      {insideFolder && folderId ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 shadow-da-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              Partagé avec
            </p>
            <DriveFolderActions
              folderId={folderId}
              parentId={parentId}
              currentParentId={parentId}
              clients={clients}
              groups={groups}
              moveTargets={moveTargets}
              alreadySharedClientIds={folderCoveredClientIds}
              alreadySharedGroupIds={folderCoveredGroupIds}
              listFolderId={folderId}
              show={['share']}
            />
          </div>
          {currentFolderShares.length ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {currentFolderShares.map((s) => (
                <li
                  key={s.id}
                  className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2.5 py-1"
                >
                  <span className="text-[12px] font-semibold text-[var(--brand)]">
                    {s.kind === 'group' ? `Groupe · ${s.label}` : s.label}
                  </span>
                  <DriveQuietForm action={unshareAction} successMsg="Partage retiré">
                    <input type="hidden" name="share_id" value={s.id} />
                    <input type="hidden" name="folder_id" value={folderId} />
                    <DrivePendingSubmit
                      idle="Retirer"
                      pending="…"
                      className="rounded-full bg-[var(--danger-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--danger)]"
                    />
                  </DriveQuietForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[12px] font-semibold text-[color:var(--muted)]">
              Personne pour l’instant — utilise l’icône partager.
            </p>
          )}
        </div>
      ) : null}

      <DriveUploadZone folderId={folderId} />

      <div className="grid min-w-0 gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:grid-cols-2 sm:p-4 md:grid-cols-[1fr_8rem_9rem] md:items-end">
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)] sm:col-span-2 md:col-span-1">
          {folderId ? 'Rechercher dans ce dossier' : 'Rechercher dans tout le Drive'}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nom de dossier ou fichier…"
            className={daFieldClass}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)]">
          Type
          <select value={type} onChange={(e) => setType(e.target.value as TypeFilter)} className={daFieldClass}>
            <option value="all">Tous</option>
            <option value="folder">Dossiers</option>
            <option value="pdf">PDF</option>
            <option value="image">Images</option>
            <option value="video">Vidéos</option>
            <option value="other">Autres</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)]">
          Date
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className={daFieldClass}>
            <option value="newest">Plus récent</option>
            <option value="oldest">Plus ancien</option>
          </select>
        </label>
      </div>

      {dndError ? (
        <p className="text-xs font-semibold text-[var(--danger)]" role="alert">
          {dndError}
        </p>
      ) : null}
      {dndPending ? (
        <p className="text-xs font-semibold text-[color:var(--muted)]">Déplacement…</p>
      ) : null}

      {emptyFolder && !filterActive ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--accent)] px-4 py-8 text-center">
          <p className="font-semibold text-[color:var(--fg)]">
            {folderName ? `« ${folderName} » est vide` : 'Ce dossier est vide'}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Utilise le + pour un dossier, ou la zone ci-dessus pour des fichiers.
          </p>
        </div>
      ) : null}

      {/* ——— Vue LISTE (explorateur) : desktop ; mobile reste galerie ——— */}
      {effectiveView === 'list' ? (
        <div className="hidden overflow-visible rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-da-sm sm:block">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">
                <th className="px-3 py-2 font-bold">Nom</th>
                <th className="hidden px-3 py-2 font-bold md:table-cell">Modifié</th>
                <th className="px-3 py-2 font-bold">Type</th>
                <th className="px-3 py-2 font-bold">Taille</th>
                <th className="px-3 py-2 font-bold"> </th>
              </tr>
            </thead>
            <tbody>
              {filteredFolders.map((f) => {
                const shares = sharesByFolder[f.id] ?? []
                const dateLabel = formatDriveDate(f.created_at)
                const fileCount = fileCountsByFolder[f.id] ?? 0
                const bytes = sizeBytesByFolder[f.id] ?? 0
                return (
                  <tr
                    key={`f-${f.id}`}
                    draggable={dndOk}
                    onDragStart={(e) => dragStart(e, { kind: 'folder', id: f.id })}
                    onDragEnd={dragEnd}
                    onDragOver={(e) => dragOverTarget(e, `folder:${f.id}`)}
                    onDragLeave={() => setDropOver(null)}
                    onDrop={(e) => dropOnFolder(e, f.id)}
                    className={`group/row relative cursor-default border-b border-[var(--border)] hover:bg-[var(--accent)] has-[[data-drive-panel-open]]:z-50 ${dropClass(`folder:${f.id}`)} ${dndOk ? 'sm:cursor-grab active:cursor-grabbing' : ''}`}
                    onDoubleClick={() => goFolder(`/drive/${f.id}`)}
                    title={dndOk ? 'Glisser vers un dossier ou le fil d’Ariane' : undefined}
                  >
                    <td className="max-w-[16rem] px-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          className="flex shrink-0 items-center text-left"
                          onClick={() => goFolder(`/drive/${f.id}`)}
                          title="Ouvrir"
                        >
                          <MediaGlyph kind="folder" size="sm" />
                        </button>
                        <DriveRenameControl
                          kind="folder"
                          id={f.id}
                          name={f.name}
                          listFolderId={folderId}
                          nameClassName="truncate font-semibold text-[color:var(--fg)]"
                        />
                        <span
                          className="shrink-0 rounded-full bg-[var(--brand)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-fg)]"
                          title={`${fileCount} fichier${fileCount > 1 ? 's' : ''}`}
                        >
                          {fileCount}
                        </span>
                        {shares.length ? (
                          <span
                            className="shrink-0 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-[var(--border)]"
                            title={`${shares.length} partage${shares.length > 1 ? 's' : ''}`}
                          >
                            {shares.length}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)] md:table-cell">
                      {dateLabel || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)]">Dossier</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)]">
                      {bytes > 0 ? formatBytes(bytes) : '—'}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex justify-end opacity-70 group-hover/row:opacity-100">
                        <DriveFolderActions {...folderActionsProps(f)} bare />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredFiles.map((file) => {
                const kind = driveMediaKind(file.mime_type, file.name)
                const shares = sharesByFile[file.id] ?? []
                const dateLabel = formatDriveDate(file.created_at)
                return (
                  <tr
                    key={file.id}
                    draggable={dndOk}
                    onDragStart={(e) => dragStart(e, { kind: 'file', id: file.id })}
                    onDragEnd={dragEnd}
                    className={`group/row relative cursor-default border-b border-[var(--border)] last:border-0 hover:bg-[var(--accent)] has-[[data-drive-panel-open]]:z-50 ${dndOk ? 'sm:cursor-grab active:cursor-grabbing' : ''}`}
                    onDoubleClick={() => openFile(file.id)}
                    title={dndOk ? 'Glisser vers un dossier ou le fil d’Ariane' : undefined}
                  >
                    <td className="max-w-[16rem] px-3 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <MediaGlyph kind={kind} size="sm" />
                        <DriveRenameControl
                          kind="file"
                          id={file.id}
                          name={file.name}
                          currentFolderId={folderId}
                          nameClassName="truncate font-semibold text-[color:var(--fg)]"
                        />
                        <FileShareBadge shares={shares} currentFolderId={folderId} />
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)] md:table-cell">
                      {dateLabel || '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)]">
                      {driveMediaLabel(kind)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-[12px] text-[color:var(--muted)]">
                      {formatBytes(file.size_bytes)}
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex justify-end opacity-70 group-hover/row:opacity-100">
                        <DriveFileActions {...fileActionsProps(file)} bare />
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!filteredFolders.length && !filteredFiles.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-[color:var(--muted)]">
                    Aucun élément.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ——— Vue GALERIE (défaut) + mobile always ——— */}
      <div className={effectiveView === 'list' ? 'grid gap-4 sm:hidden' : 'grid gap-4'}>
        {(filteredFolders.length > 0 || (type === 'folder' && filterActive)) && (
          <section className="grid min-w-0 gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              {searchActive ? 'Dossiers trouvés' : insideFolder ? 'Sous-dossiers' : 'Dossiers'} ({filteredFolders.length})
            </h2>
            {!filteredFolders.length ? (
              <p className="text-sm text-[color:var(--muted)]">Aucun dossier pour ce filtre.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                {filteredFolders.map((f) => {
                  const shares = sharesByFolder[f.id] ?? []
                  const fileCount = fileCountsByFolder[f.id] ?? 0
                  const fileNames = fileNamesByFolder[f.id] ?? []
                  const dateLabel = formatDriveDate(f.created_at)
                  const open = badgeOpen[f.id] ?? null
                  return (
                    <div
                      key={f.id}
                      draggable={dndOk}
                      onDragStart={(e) => dragStart(e, { kind: 'folder', id: f.id })}
                      onDragEnd={dragEnd}
                      onDragOver={(e) => dragOverTarget(e, `folder:${f.id}`)}
                      onDragLeave={() => setDropOver(null)}
                      onDrop={(e) => dropOnFolder(e, f.id)}
                      className={`relative z-0 min-w-0 overflow-visible rounded-[1.15rem] has-[[data-drive-panel-open]]:z-50 ${dropClass(`folder:${f.id}`)} ${dndOk ? 'sm:cursor-grab active:cursor-grabbing' : ''}`}
                      title={dndOk ? 'Glisser vers un dossier ou le fil d’Ariane' : undefined}
                    >
                      <DocFolderCard
                        title={
                          <DriveRenameControl
                            kind="folder"
                            id={f.id}
                            name={f.name}
                            listFolderId={folderId}
                            size="md"
                          />
                        }
                        subtitle={dateLabel ? `Créé le ${dateLabel}` : 'Dossier Drive'}
                        count={fileCount}
                        countTitle={`${fileCount} fichier${fileCount > 1 ? 's' : ''} dans ce dossier`}
                        shareCount={shares.length}
                        shareCountTitle={`${shares.length} personne${shares.length > 1 ? 's' : ''} / groupe${shares.length > 1 ? 's' : ''} avec accès`}
                        footerActions={
                          <DriveFolderActions
                            {...folderActionsProps(f)}
                            show={['move', 'share', 'archive']}
                            bare
                          />
                        }
                        onCountClick={(e) => {
                          e.stopPropagation()
                          setBadgeOpen((prev) => ({
                            ...prev,
                            [f.id]: prev[f.id] === 'files' ? null : 'files',
                          }))
                        }}
                        onShareCountClick={(e) => {
                          e.stopPropagation()
                          setBadgeOpen((prev) => ({
                            ...prev,
                            [f.id]: prev[f.id] === 'shares' ? null : 'shares',
                          }))
                        }}
                        onOpen={() => goFolder(`/drive/${f.id}`)}
                      />
                      <FolderBadgePopups
                        folderId={f.id}
                        files={fileNames}
                        shares={shares}
                        listFolderId={folderId}
                        open={open}
                        onClose={() => setBadgeOpen((prev) => ({ ...prev, [f.id]: null }))}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {(filteredFiles.length > 0 || type !== 'folder') && (
          <section className="grid min-w-0 gap-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wide text-[color:var(--muted)]">
              {searchActive ? 'Fichiers trouvés' : 'Fichiers'} ({filteredFiles.length})
            </h2>
            {!filteredFiles.length && !emptyFolder ? (
              <p className="text-sm text-[color:var(--muted)]">
                {filterActive ? 'Aucun fichier pour ce filtre.' : 'Aucun fichier.'}
              </p>
            ) : null}
            {filteredFiles.length ? (
              <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredFiles.map((file, i) => {
                  const shares = sharesByFile[file.id] ?? []
                  const kind = driveMediaKind(file.mime_type, file.name)
                  const dateLabel = formatDriveDate(file.created_at)
                  return (
                    <li
                      key={file.id}
                      draggable={dndOk}
                      onDragStart={(e) => dragStart(e, { kind: 'file', id: file.id })}
                      onDragEnd={dragEnd}
                      className={`doc-media-card group relative z-0 min-w-0 overflow-visible rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm has-[[data-drive-panel-open]]:z-50 sm:p-4 ${dndOk ? 'sm:cursor-grab active:cursor-grabbing' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                      onDoubleClick={() => openFile(file.id)}
                      title={dndOk ? 'Double-clic pour ouvrir · glisser pour déplacer' : 'Double-clic pour ouvrir'}
                    >
                      <div className="flex min-w-0 gap-3">
                        <div className="doc-media-card__icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--page-bg)] ring-1 ring-[var(--border)] sm:h-14 sm:w-14">
                          <MediaGlyph kind={kind} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <DriveRenameControl
                            kind="file"
                            id={file.id}
                            name={file.name}
                            currentFolderId={folderId}
                            nameClassName="truncate text-sm font-bold text-[color:var(--fg)]"
                          />
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                            {driveMediaLabel(kind)}
                            {file.size_bytes != null ? ` · ${formatBytes(file.size_bytes)}` : ''}
                            {dateLabel ? ` · ${dateLabel}` : ''}
                          </p>
                          <div className="mt-1.5">
                            <FileShareBadge shares={shares} currentFolderId={folderId} />
                          </div>
                        </div>
                      </div>
                      <div className="relative z-[40] mt-3 flex flex-wrap items-center justify-end gap-2">
                        <DriveFileActions {...fileActionsProps(file)} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
