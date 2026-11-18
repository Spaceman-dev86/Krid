'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'

import {
  getDocumentationSignedUrlAction,
  recoverDocumentationItemAction,
} from '@/src/app/documentation/actions'
import { DocFolderCard } from '@/src/components/documentation/DocFolderCard'
import { Button, daFieldClass } from '@/src/components/ui'
import { FORMATION_MEDIA_LABEL } from '@/src/lib/admin/trainlyMedia'
import type { DocFolder, DocItem, DocMediaType } from '@/src/lib/documentation/types'
import { formatBytes } from '@/src/lib/drive/drive'

type SortMode = 'newest' | 'oldest'
type TypeFilter = 'all' | DocMediaType

type Props = {
  folders: DocFolder[]
  itemsByFolderId: Record<string, DocItem[]>
  initialFolderSlug?: string | null
}

function RecoverButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Récupération…' : 'Récupérer'}
    </Button>
  )
}

function MediaGlyph({ type }: { type: DocMediaType }) {
  if (type === 'video') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <rect x="4" y="10" width="40" height="28" rx="6" fill="color-mix(in srgb, var(--brand) 22%, transparent)" />
        <path d="M20 18v12l12-6z" fill="var(--brand)" />
      </svg>
    )
  }
  if (type === 'image') {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
        <rect x="6" y="10" width="36" height="28" rx="6" fill="color-mix(in srgb, var(--brand) 18%, transparent)" />
        <circle cx="18" cy="20" r="3.5" fill="var(--brand)" />
        <path d="M10 32l10-9 7 6 5-4 6 7H10z" fill="var(--brand)" opacity="0.85" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden>
      <path
        d="M14 6h14l10 10v26a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z"
        fill="color-mix(in srgb, var(--brand) 20%, transparent)"
      />
      <path d="M28 6v10h10" fill="none" stroke="var(--brand)" strokeWidth="2" />
      <path d="M16 26h16M16 32h12" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function folderIdFromSlug(folders: DocFolder[], slug: string | null | undefined): string | null {
  if (!slug) return null
  return folders.find((f) => f.slug === slug)?.id ?? null
}

export function DocumentationExplorer({ folders, itemsByFolderId, initialFolderSlug = null }: Props) {
  const [folderId, setFolderId] = useState<string | null>(() =>
    folderIdFromSlug(folders, initialFolderSlug),
  )
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortMode>('newest')
  const [type, setType] = useState<TypeFilter>('all')
  const [openError, setOpenError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [pendingOpen, startOpen] = useTransition()

  // Sync SSR ?folder= + bouton retour navigateur (replaceState seul ne remonte pas le state)
  useEffect(() => {
    setFolderId(folderIdFromSlug(folders, initialFolderSlug))
  }, [folders, initialFolderSlug])

  useEffect(() => {
    function onPopState() {
      const slug = new URL(window.location.href).searchParams.get('folder')
      setFolderId(folderIdFromSlug(folders, slug))
      setQ('')
      setType('all')
      setOpenError(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [folders])

  const folder = folders.find((f) => f.id === folderId) ?? null
  const items = folder ? itemsByFolderId[folder.id] ?? [] : []
  // Coach : masquer les dossiers vides (0 publié) — moins de bruit release
  const visibleFolders = useMemo(
    () => folders.filter((f) => f.itemCount > 0 || f.id === folderId),
    [folders, folderId],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = items.filter((item) => {
      if (type !== 'all' && item.mediaType !== type) return false
      if (!needle) return true
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.description ?? '').toLowerCase().includes(needle)
      )
    })
    list = [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime()
      const db = new Date(b.createdAt).getTime()
      return sort === 'newest' ? db - da : da - db
    })
    return list
  }, [items, q, sort, type])

  function openFolder(f: DocFolder) {
    setFolderId(f.id)
    setQ('')
    setType('all')
    setOpenError(null)
    const url = new URL(window.location.href)
    url.searchParams.set('folder', f.slug)
    window.history.pushState(null, '', url.toString())
  }

  function backToFolders() {
    setFolderId(null)
    setQ('')
    setType('all')
    setOpenError(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('folder')
    window.history.pushState(null, '', url.toString())
  }

  function openItem(item: DocItem) {
    setOpenError(null)
    setOpeningId(item.id)
    // Fenêtre synchrone au clic (sans noopener — sinon window.open renvoie null)
    const preview = window.open('about:blank', '_blank')
    if (preview) preview.opener = null
    startOpen(async () => {
      const res = await getDocumentationSignedUrlAction(item.id)
      setOpeningId(null)
      if (!res.ok) {
        preview?.close()
        setOpenError(res.error)
        return
      }
      if (preview && !preview.closed) {
        preview.location.href = res.url
      } else {
        // Fallback si popup bloquée
        window.location.assign(res.url)
      }
    })
  }

  if (!folder) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 md:gap-5">
        {visibleFolders.length ? (
          visibleFolders.map((f) => (
            <DocFolderCard
              key={f.id}
              title={f.title}
              subtitle={f.description}
              count={f.itemCount}
              tone={f.isSystem ? 'system' : 'default'}
              onOpen={() => openFolder(f)}
            />
          ))
        ) : (
          <p className="col-span-full rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
            Aucun dossier publié pour l’instant.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-3 sm:gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={backToFolders}
          className="shrink-0 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          ← Dossiers
        </button>
        <p className="min-w-0 truncate text-sm font-extrabold text-[color:var(--fg)] sm:text-base">
          {folder.title}
        </p>
      </div>

      <div className="grid min-w-0 gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:grid-cols-2 sm:p-4 md:grid-cols-[1fr_8rem_9rem] md:items-end">
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)] sm:col-span-2 md:col-span-1">
          Rechercher
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titre ou description…"
            className={daFieldClass}
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)]">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className={daFieldClass}
          >
            <option value="all">Tous</option>
            <option value="pdf">PDF</option>
            <option value="video">Vidéo</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-semibold text-[color:var(--fg)]">
          Date
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className={daFieldClass}
          >
            <option value="newest">Plus récent</option>
            <option value="oldest">Plus ancien</option>
          </select>
        </label>
      </div>

      {openError ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-sm text-[color:var(--fg)]">
          {openError}
        </p>
      ) : null}

      {!filtered.length ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[color:var(--muted)]">
          Aucun document dans ce dossier{q || type !== 'all' ? ' pour ce filtre' : ''}.
        </p>
      ) : (
        <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((item, i) => {
            const mediaLabel = FORMATION_MEDIA_LABEL[item.mediaType]
            const busy = pendingOpen && openingId === item.id
            return (
              <li
                key={item.id}
                className="doc-media-card group relative min-w-0 overflow-hidden rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm sm:p-4"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="flex min-w-0 gap-3">
                  <div className="doc-media-card__icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--page-bg)] ring-1 ring-[var(--border)] sm:h-14 sm:w-14">
                    <MediaGlyph type={item.mediaType} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[color:var(--fg)]">{item.title}</p>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[color:var(--muted)]">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                      {mediaLabel}
                      {item.sizeBytes != null ? ` · ${formatBytes(item.sizeBytes)}` : ''}
                      {item.createdAt
                        ? ` · ${new Date(item.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => openItem(item)}
                  >
                    {busy ? 'Ouverture…' : 'Lire'}
                  </Button>
                  {item.allowDuplicate ? (
                    <form action={recoverDocumentationItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="folder_slug" value={folder.slug} />
                      <RecoverButton />
                    </form>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold text-[color:var(--muted)]">
                      Lecture seule
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
