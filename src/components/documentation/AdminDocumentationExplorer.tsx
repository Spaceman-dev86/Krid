'use client'

import { useMemo, useState } from 'react'

import {
  createDocumentationFolderAction,
  createDocumentationItemAction,
  deleteDocumentationFolderAction,
  deleteDocumentationItemAction,
  previewDocumentationItemAction,
  renameDocumentationFolderAction,
  setDocumentationItemPublishedAction,
  updateDocumentationItemAction,
} from '@/src/app/admin/documentation/actions'
import { DocFolderCard } from '@/src/components/documentation/DocFolderCard'
import {
  Button,
  ConfirmSubmitButton,
  Eyebrow,
  FilePickField,
  Muted,
  daFieldClass,
} from '@/src/components/ui'
import { FORMATION_MEDIA_LABEL } from '@/src/lib/admin/trainlyMedia'
import type { DocFolder, DocItem } from '@/src/lib/documentation/types'
import { formatBytes } from '@/src/lib/drive/drive'

type SortMode = 'newest' | 'oldest'
type TypeFilter = 'all' | 'pdf' | 'video' | 'image'

type Props = {
  folders: DocFolder[]
  itemsByFolderId: Record<string, DocItem[]>
  initialFolderSlug?: string | null
}

export function AdminDocumentationExplorer({ folders, itemsByFolderId, initialFolderSlug = null }: Props) {
  const initial = folders.find((f) => f.slug === initialFolderSlug) ?? null
  const [folderId, setFolderId] = useState<string | null>(initial?.id ?? null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortMode>('newest')
  const [type, setType] = useState<TypeFilter>('all')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const folder = folders.find((f) => f.id === folderId) ?? null
  const items = folder ? itemsByFolderId[folder.id] ?? [] : []

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

  if (!folder) {
    return (
      <div className="grid gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Dossiers ({folders.length})</Eyebrow>
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowNewFolder((v) => !v)}>
            {showNewFolder ? 'Annuler' : '+ Dossier'}
          </Button>
        </div>

        {showNewFolder ? (
          <form
            action={createDocumentationFolderAction}
            className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
          >
            <Eyebrow>Nouveau dossier</Eyebrow>
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
              Titre
              <input name="title" required minLength={2} className={daFieldClass} />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
              Description
              <textarea name="description" rows={2} className={daFieldClass} />
            </label>
            <Button type="submit" size="sm" className="justify-self-start">
              Créer le dossier
            </Button>
          </form>
        ) : null}

        <Muted className="text-[11px]">
          Badge brand = publiés (visibles coach) · pastille « br. » = brouillons (admin only).
        </Muted>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 md:gap-5">
          {folders.map((f) => (
            <DocFolderCard
              key={f.id}
              title={f.title}
              subtitle={f.description}
              count={f.itemCount}
              draftCount={f.draftCount}
              tone={f.isSystem ? 'system' : 'default'}
              onOpen={() => {
                setFolderId(f.id)
                setQ('')
                setType('all')
                const url = new URL(window.location.href)
                url.searchParams.set('folder', f.slug)
                window.history.replaceState(null, '', url.toString())
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setFolderId(null)
            setQ('')
            setType('all')
            const url = new URL(window.location.href)
            url.searchParams.delete('folder')
            window.history.replaceState(null, '', url.toString())
          }}
          className="text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          ← Dossiers
        </button>
        <p className="text-sm font-extrabold text-[color:var(--fg)]">{folder.title}</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form
          action={renameDocumentationFolderAction}
          className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={folder.id} />
          <label className="grid min-w-0 flex-1 gap-1 text-xs font-semibold text-[color:var(--fg)]">
            Renommer le dossier
            <input
              name="title"
              required
              minLength={2}
              defaultValue={folder.title}
              className={`${daFieldClass} max-w-sm`}
            />
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Enregistrer
          </Button>
        </form>
        {!folder.isSystem ? (
          <form action={deleteDocumentationFolderAction}>
            <input type="hidden" name="id" value={folder.id} />
            <ConfirmSubmitButton variant="danger" confirmMessage="Supprimer ce dossier vide ?">
              Supprimer
            </ConfirmSubmitButton>
          </form>
        ) : (
          <Muted className="text-[11px]">Dossier système — non supprimable.</Muted>
        )}
      </div>

      <form
        action={createDocumentationItemAction}
        className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm"
      >
        <Eyebrow>Nouveau contenu</Eyebrow>
        <input type="hidden" name="folder_id" value={folder.id} />
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Titre
          <input name="title" required minLength={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Description
          <textarea name="description" rows={2} className={daFieldClass} />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[color:var(--fg)]">
          Fichier (PDF / image / vidéo)
          <FilePickField
            name="file"
            accept="application/pdf,.pdf,image/*,video/mp4,video/webm,video/quicktime"
            required
            label="Choisir un fichier"
            hint="PDF, image ou vidéo · max 200 Mo"
          />
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-[color:var(--fg)]">
          <label className="inline-flex items-center gap-2 font-semibold">
            <input name="allow_duplicate" type="checkbox" defaultChecked className="accent-[var(--brand)]" />
            Récupérable (Drive coach)
          </label>
          <label className="inline-flex items-center gap-2 font-semibold">
            <input name="publish_now" type="checkbox" defaultChecked className="accent-[var(--brand)]" />
            Publier maintenant (sinon invisible côté coach)
          </label>
        </div>
        <Button type="submit" size="sm" className="justify-self-start">
          Ajouter
        </Button>
      </form>

      <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-da-sm md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
          Rechercher
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Titre ou description…"
            className={daFieldClass}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
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
        <label className="grid gap-1 text-xs font-semibold text-[color:var(--fg)]">
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

      {!filtered.length ? (
        <Muted>Aucun contenu dans ce dossier{q || type !== 'all' ? ' pour ce filtre' : ''}.</Muted>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm">
          {filtered.map((item) => {
            const mediaLabel = FORMATION_MEDIA_LABEL[item.mediaType]
            return (
              <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-[color:var(--fg)]">{item.title}</p>
                      <span
                        className={
                          item.published
                            ? 'shrink-0 rounded-full border border-[var(--success-border)] bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]'
                            : 'shrink-0 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--muted)] ring-1 ring-[var(--border)]'
                        }
                      >
                        {item.published ? 'Publié' : 'Brouillon'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-[color:var(--muted)]">
                      {mediaLabel}
                      {item.sizeBytes != null ? ` · ${formatBytes(item.sizeBytes)}` : ''}
                      {item.createdAt
                        ? ` · ${new Date(item.createdAt).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : ''}
                      {item.allowDuplicate === false ? ' · non récupérable' : ''}
                      {!item.published ? ' · invisible coach tant que brouillon' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <form action={previewDocumentationItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="folder_slug" value={folder.slug} />
                      <Button type="submit" variant="secondary" size="sm">
                        Preview
                      </Button>
                    </form>
                    {item.published ? (
                      <form action={setDocumentationItemPublishedAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="folder_slug" value={folder.slug} />
                        <input type="hidden" name="published" value="0" />
                        <ConfirmSubmitButton
                          variant="secondary"
                          confirmMessage="Repasser en brouillon ? Il disparaîtra de /documentation (copies Drive coach inchangées)."
                        >
                          Brouillon
                        </ConfirmSubmitButton>
                      </form>
                    ) : (
                      <form action={setDocumentationItemPublishedAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="folder_slug" value={folder.slug} />
                        <input type="hidden" name="published" value="1" />
                        <Button type="submit" size="sm">
                          Publier
                        </Button>
                      </form>
                    )}
                    <form action={deleteDocumentationItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="folder_slug" value={folder.slug} />
                      <ConfirmSubmitButton
                        variant="danger"
                        confirmMessage="Supprimer définitivement ce contenu et le fichier Storage ?"
                      >
                        Suppr.
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] font-semibold text-[var(--brand)]">
                    Modifier titre / description / droits
                  </summary>
                  <form
                    action={updateDocumentationItemAction}
                    className="mt-2 grid gap-2 rounded-[var(--radius-md)] bg-[var(--page-bg)] p-3 ring-1 ring-[var(--border)]"
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="folder_slug" value={folder.slug} />
                    <input type="hidden" name="published" value={item.published ? 'on' : ''} />
                    <input name="title" defaultValue={item.title} required className={daFieldClass} />
                    <textarea
                      name="description"
                      defaultValue={item.description ?? ''}
                      rows={2}
                      className={daFieldClass}
                      placeholder="Description"
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--fg)]">
                      <input
                        name="allow_duplicate"
                        type="checkbox"
                        defaultChecked={item.allowDuplicate !== false}
                        className="accent-[var(--brand)]"
                      />
                      Récupérable (Drive coach)
                    </label>
                    <Button type="submit" size="sm" className="justify-self-start">
                      Enregistrer
                    </Button>
                  </form>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
