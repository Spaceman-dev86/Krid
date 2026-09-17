import Link from 'next/link'

import {
  createFolderAction,
  moveFileAction,
  moveFolderAction,
  shareFileToClientAction,
  shareFolderToClientAction,
  softDeleteFileAction,
  softDeleteFolderAction,
  unshareAction,
} from '../../app/drive/actions'
import {
  formatBytes,
  type DriveFileRow,
  type DriveFolderOption,
  type DriveFolderRow,
  type DriveShareInfo,
} from '../../lib/drive/drive'
import { DriveConfirmArchiveButton } from './DriveConfirmArchiveButton'
import { DriveUploadZone } from './DriveUploadZone'

type ClientOpt = { id: string; label: string }

type Props = {
  folders: DriveFolderRow[]
  files: DriveFileRow[]
  folderId: string | null
  parentId: string | null
  folderName?: string | null
  clients: ClientOpt[]
  moveTargets: DriveFolderOption[]
  sharesByFile: Record<string, DriveShareInfo[]>
  sharesByFolder: Record<string, DriveShareInfo[]>
  breadcrumb?: { id: string | null; name: string }[]
}

function ShareBadges({
  shares,
  currentFolderId,
}: {
  shares: DriveShareInfo[]
  currentFolderId: string | null
}) {
  if (!shares.length) return null
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-black/35">Partagé avec</span>
      {shares.map((s) => (
        <form
          key={s.id}
          action={unshareAction}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-2 py-0.5"
        >
          <input type="hidden" name="share_id" value={s.id} />
          {currentFolderId ? <input type="hidden" name="folder_id" value={currentFolderId} /> : null}
          <span className="text-[11px] font-semibold text-[color:var(--brand)]">{s.client_label}</span>
          <button
            type="submit"
            title={`Retirer l’accès à ${s.client_label}`}
            className="rounded-full bg-red-600/10 px-1.5 py-0.5 text-[10px] font-bold text-red-700 hover:bg-red-600/20"
          >
            Retirer
          </button>
        </form>
      ))}
    </div>
  )
}

function ShareToClientForm({
  clients,
  alreadySharedIds,
  hidden,
  action,
}: {
  clients: ClientOpt[]
  alreadySharedIds: Set<string>
  hidden: { name: string; value: string }[]
  action: (formData: FormData) => Promise<void>
}) {
  const available = clients.filter((c) => !alreadySharedIds.has(c.id))
  if (!available.length) {
    return (
      <p className="text-[11px] font-semibold text-black/40">
        {alreadySharedIds.size
          ? 'Plus personne à ajouter — déjà couverts (dossier ou fichier). Retire un accès pour changer.'
          : 'Aucun client à partager.'}
      </p>
    )
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      {hidden.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}
      <select
        name="client_id"
        required
        defaultValue=""
        className="rounded-lg border border-black/10 px-2 py-1 text-xs"
      >
        <option value="" disabled>
          Partager avec…
        </option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg bg-[color:var(--brand)] px-2 py-1 text-[10px] font-bold text-[color:var(--icon-solid-fg)]">
        OK
      </button>
    </form>
  )
}

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

function MoveSelect({
  action,
  hidden,
  targets,
  excludeFolderId,
  currentParentId,
}: {
  action: (formData: FormData) => Promise<void>
  hidden: { name: string; value: string }[]
  targets: DriveFolderOption[]
  excludeFolderId?: string
  currentParentId: string | null
}) {
  const blocked = excludeFolderId ? descendantIdsOf(excludeFolderId, targets) : new Set<string>()
  const options = targets.filter((t) => !blocked.has(t.id))
  const currentValue = currentParentId ?? '__root__'
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      {hidden.map((h) => (
        <input key={h.name} type="hidden" name={h.name} value={h.value} />
      ))}
      <select
        name="target_folder_id"
        defaultValue={currentValue}
        className="max-w-[14rem] rounded-lg border border-black/10 px-2 py-1 text-xs"
      >
        <option value="__root__">Drive (racine)</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-lg bg-black/5 px-2 py-1 text-[10px] font-bold text-[color:var(--brand)]">
        Déplacer
      </button>
    </form>
  )
}

export function DriveBrowser({
  folders,
  files,
  folderId,
  parentId,
  folderName,
  clients,
  moveTargets,
  sharesByFile,
  sharesByFolder,
  breadcrumb = [{ id: null, name: 'Drive' }],
}: Props) {
  const insideFolder = Boolean(folderId)
  const emptyFolder = insideFolder && !folders.length && !files.length
  const currentFolderShares = folderId ? (sharesByFolder[folderId] ?? []) : []
  const folderCoveredClientIds = new Set(currentFolderShares.map((s) => s.client_id))

  return (
    <div className="grid gap-5">
      <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold text-black/45">
        {breadcrumb.map((b, i) => (
          <span key={`${b.id}-${i}`} className="flex items-center gap-1">
            {i > 0 ? <span>/</span> : null}
            {b.id ? (
              <Link href={`/drive/${b.id}`} className="text-[color:var(--brand)] hover:underline">
                {b.name}
              </Link>
            ) : (
              <Link href="/drive" className="text-[color:var(--brand)] hover:underline">
                {b.name}
              </Link>
            )}
          </span>
        ))}
        {folderName ? (
          <span className="flex items-center gap-1">
            <span>/</span>
            <span className="text-[#1a1220]">{folderName}</span>
          </span>
        ) : null}
      </nav>

      {insideFolder ? (
        <Link
          href={parentId ? `/drive/${parentId}` : '/drive'}
          className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-[color:var(--brand)] hover:underline"
        >
          ← Retour {parentId ? 'au dossier parent' : 'au Drive'}
        </Link>
      ) : null}

      {insideFolder && folderId ? (
        <section className="rounded-2xl border border-[color-mix(in_srgb,var(--brand)_15%,transparent)] bg-[color-mix(in_srgb,var(--brand)_3%,transparent)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-wide text-black/40">Ce dossier</p>
              <p className="mt-0.5 font-bold text-[color:var(--brand)]">📁 {folderName || 'Dossier'}</p>
              <p className="mt-1 text-xs text-black/45">
                Partager ce dossier = accès à <strong>tous ses fichiers</strong> (actuels et futurs). Pas besoin de
                re-partager chaque fichier pour les mêmes clients.
              </p>
              <ShareBadges shares={currentFolderShares} currentFolderId={folderId} />
            </div>
            <details className="relative">
              <summary className="cursor-pointer list-none rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--brand)] shadow-sm ring-1 ring-black/10 hover:bg-black/[0.02]">
                Actions du dossier ▾
              </summary>
              <div className="mt-2 flex flex-col gap-2 rounded-xl border border-black/10 bg-white p-2 shadow-sm">
                <MoveSelect
                  action={moveFolderAction}
                  hidden={[
                    { name: 'folder_id', value: folderId },
                    { name: 'from_parent_id', value: parentId ?? '' },
                  ]}
                  targets={moveTargets}
                  excludeFolderId={folderId}
                  currentParentId={parentId}
                />
                <ShareToClientForm
                  action={shareFolderToClientAction}
                  clients={clients}
                  alreadySharedIds={new Set(currentFolderShares.map((s) => s.client_id))}
                  hidden={[
                    { name: 'share_folder_id', value: folderId },
                    { name: 'folder_id', value: folderId },
                  ]}
                />
                <form action={softDeleteFolderAction}>
                  <input type="hidden" name="folder_id" value={folderId} />
                  <input type="hidden" name="parent_id" value={parentId ?? ''} />
                  <DriveConfirmArchiveButton label="Archiver ce dossier" />
                </form>
              </div>
            </details>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={createFolderAction} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          {folderId ? <input type="hidden" name="parent_id" value={folderId} /> : null}
          <p className="text-xs font-extrabold uppercase tracking-wide text-black/40">Nouveau dossier</p>
          <div className="mt-2 flex gap-2">
            <input
              name="name"
              required
              placeholder="Nom"
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-xl bg-[color:var(--brand)] px-3 py-2 text-xs font-bold text-[color:var(--icon-solid-fg)]">
              Créer
            </button>
          </div>
        </form>

        <DriveUploadZone folderId={folderId} />
      </div>

      {emptyFolder ? (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-8 text-center">
          <p className="font-semibold text-[#1a1220]">
            {folderName ? `« ${folderName} » est vide` : 'Ce dossier est vide'}
          </p>
          <p className="mt-1 text-sm text-black/50">
            Ajoute un fichier ou un sous-dossier ici. Le dossier n’a pas disparu — tu es dedans.
          </p>
        </div>
      ) : null}

      <section className="grid gap-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/40">
          {insideFolder ? 'Sous-dossiers' : 'Dossiers'} ({folders.length})
        </h2>
        {!folders.length && !emptyFolder ? (
          <p className="text-sm text-black/40">
            {insideFolder ? 'Pas de sous-dossier.' : 'Aucun dossier à la racine.'}
          </p>
        ) : null}
        {folders.length ? (
          <ul className="grid gap-2">
            {folders.map((f) => {
              const shares = sharesByFolder[f.id] ?? []
              return (
                <li key={f.id} className="rounded-xl border border-black/10 bg-white px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/drive/${f.id}`} className="font-bold text-[color:var(--brand)] hover:underline">
                        📁 {f.name}
                        <span className="ml-2 text-xs font-semibold text-black/35">Ouvrir →</span>
                      </Link>
                      <ShareBadges shares={shares} currentFolderId={folderId} />
                    </div>
                    <details className="relative">
                      <summary className="cursor-pointer list-none text-xs font-semibold text-black/45 hover:text-black/70">
                        Actions ▾
                      </summary>
                      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-black/10 bg-[#faf9fb] p-2">
                        <MoveSelect
                          action={moveFolderAction}
                          hidden={[
                            { name: 'folder_id', value: f.id },
                            { name: 'from_parent_id', value: folderId ?? '' },
                          ]}
                          targets={moveTargets}
                          excludeFolderId={f.id}
                          currentParentId={f.parent_id}
                        />
                        <ShareToClientForm
                          action={shareFolderToClientAction}
                          clients={clients}
                          alreadySharedIds={new Set(shares.map((s) => s.client_id))}
                          hidden={[
                            { name: 'share_folder_id', value: f.id },
                            ...(folderId ? [{ name: 'folder_id', value: folderId }] : []),
                          ]}
                        />
                        <form action={softDeleteFolderAction}>
                          <input type="hidden" name="folder_id" value={f.id} />
                          <input type="hidden" name="parent_id" value={folderId ?? ''} />
                          <DriveConfirmArchiveButton label="Archiver le dossier" />
                        </form>
                      </div>
                    </details>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <section className="grid gap-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wide text-black/40">
          Fichiers ({files.length})
        </h2>
        {!files.length && !emptyFolder ? (
          <p className="text-sm text-black/40">Aucun fichier.</p>
        ) : null}
        {files.length ? (
          <ul className="grid gap-2">
            {files.map((file) => {
              const shares = sharesByFile[file.id] ?? []
              // Clients déjà couverts par le dossier parent n’ont pas besoin d’un partage fichier
              const alreadyViaFolderOrFile = new Set([
                ...shares.map((s) => s.client_id),
                ...folderCoveredClientIds,
              ])
              return (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/10 bg-white px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#1a1220]">{file.name}</p>
                    <p className="text-xs text-black/40">
                      {[file.mime_type, formatBytes(file.size_bytes)].filter(Boolean).join(' · ')}
                    </p>
                    <ShareBadges shares={shares} currentFolderId={folderId} />
                  </div>
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-black/45 hover:text-black/70">
                      Actions ▾
                    </summary>
                    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-black/10 bg-[#faf9fb] p-2">
                      <MoveSelect
                        action={moveFileAction}
                        hidden={[
                          { name: 'file_id', value: file.id },
                          { name: 'from_folder_id', value: folderId ?? '' },
                        ]}
                        targets={moveTargets}
                        currentParentId={file.folder_id}
                      />
                      <ShareToClientForm
                        action={shareFileToClientAction}
                        clients={clients}
                        alreadySharedIds={alreadyViaFolderOrFile}
                        hidden={[
                          { name: 'file_id', value: file.id },
                          ...(folderId ? [{ name: 'folder_id', value: folderId }] : []),
                        ]}
                      />
                      <form action={softDeleteFileAction}>
                        <input type="hidden" name="file_id" value={file.id} />
                        {folderId ? <input type="hidden" name="folder_id" value={folderId} /> : null}
                        <DriveConfirmArchiveButton label="Archiver le fichier" />
                      </form>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
