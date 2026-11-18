import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { unlinkGroupDriveFolderAction } from '@/src/app/clients/groupes/actions'
import { GroupDriveLinkForm } from '@/src/components/coach/GroupDriveLinkForm'
import { Button } from '@/src/components/ui'
import { canAccessCoachApp } from '../../../../../lib/auth/roles'
import { createClient } from '../../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ id: string }> | { id: string }
}

type FolderRow = { id: string; name: string; parent_id: string | null }

function folderPathLabel(folder: FolderRow, byId: Map<string, FolderRow>): string {
  const parts: string[] = []
  let cur: FolderRow | undefined = folder
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    parts.unshift(cur.name)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return parts.join(' / ')
}

export default async function GroupDrivePage({ params }: Props) {
  const { id } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const { data: group } = await supabase
    .from('client_groups')
    .select('id, name, drive_enabled, type')
    .eq('id', id)
    .eq('coach_id', user.id)
    .in('type', ['manual', 'linked'])
    .maybeSingle()

  if (!group) notFound()

  const { data: folders } = await supabase
    .from('drive_folders')
    .select('id, name, parent_id')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const folderRows = (folders ?? []) as FolderRow[]
  const byId = new Map(folderRows.map((f) => [f.id, f]))

  const { data: shares } = await supabase
    .from('drive_shares')
    .select('folder_id, file_id')
    .eq('group_id', group.id)
    .eq('coach_id', user.id)

  const linkedFolderIds = [
    ...new Set(
      (shares ?? [])
        .map((s) => s.folder_id)
        .filter((fid): fid is string => Boolean(fid)),
    ),
  ]

  const sharedFileIds = [
    ...new Set(
      (shares ?? [])
        .map((s) => s.file_id)
        .filter((fid): fid is string => Boolean(fid)),
    ),
  ]

  const linkedFolders = linkedFolderIds
    .map((fid) => {
      const row = byId.get(fid)
      if (!row) return null
      return { id: fid, label: folderPathLabel(row, byId) }
    })
    .filter(Boolean) as { id: string; label: string }[]

  // Fichiers contenus dans les dossiers liés
  const filesByFolder = new Map<string, { id: string; name: string }[]>()
  if (linkedFolderIds.length) {
    const { data: filesInFolders } = await supabase
      .from('drive_files')
      .select('id, folder_id, name')
      .eq('coach_id', user.id)
      .in('folder_id', linkedFolderIds)
      .is('deleted_at', null)
      .order('name', { ascending: true })
    for (const f of filesInFolders ?? []) {
      if (!f.folder_id) continue
      const list = filesByFolder.get(f.folder_id) ?? []
      list.push({ id: f.id, name: f.name })
      filesByFolder.set(f.folder_id, list)
    }
  }

  // Fichiers partagés individuellement (hors dossiers liés, ou complément)
  type SharedFile = { id: string; name: string; folder_id: string | null; folderLabel: string | null }
  const standaloneFiles: SharedFile[] = []
  if (sharedFileIds.length) {
    const { data: sharedFiles } = await supabase
      .from('drive_files')
      .select('id, folder_id, name')
      .eq('coach_id', user.id)
      .in('id', sharedFileIds)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    for (const f of sharedFiles ?? []) {
      // Déjà listé via dossier lié → skip
      if (f.folder_id && linkedFolderIds.includes(f.folder_id)) continue
      const parent = f.folder_id ? byId.get(f.folder_id) : null
      standaloneFiles.push({
        id: f.id,
        name: f.name,
        folder_id: f.folder_id,
        folderLabel: parent ? folderPathLabel(parent, byId) : null,
      })
    }
  }

  const linkedSet = new Set(linkedFolderIds)
  const availableOpts = folderRows
    .filter((f) => !linkedSet.has(f.id))
    .map((f) => ({ id: f.id, label: folderPathLabel(f, byId) }))

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-da-sm sm:p-5">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-[color:var(--brand)]">Drive</h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Plusieurs dossiers possibles. Partagés avec les membres actifs du groupe.
        </p>

        {linkedFolders.length ? (
          <ul className="mt-4 space-y-4">
            {linkedFolders.map((folder) => {
              const files = filesByFolder.get(folder.id) ?? []
              return (
                <li
                  key={folder.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[color:var(--fg)]">{folder.label}</p>
                      <Link
                        href={`/drive/${folder.id}`}
                        className="text-xs font-semibold text-[color:var(--brand)] hover:underline"
                      >
                        Ouvrir le dossier →
                      </Link>
                    </div>
                    <form action={unlinkGroupDriveFolderAction}>
                      <input type="hidden" name="id" value={group.id} />
                      <input type="hidden" name="drive_folder_id" value={folder.id} />
                      <input type="hidden" name="return_to" value={`/clients/groupes/${group.id}/drive`} />
                      <Button type="submit" variant="secondary" className="!rounded-lg !px-3 !py-1.5 text-xs">
                        Retirer
                      </Button>
                    </form>
                  </div>
                  {files.length ? (
                    <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
                      {files.map((file) => (
                        <li key={file.id} className="truncate text-sm text-[color:var(--muted)]">
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-[color:var(--muted)]">Aucun fichier dans ce dossier.</p>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[color:var(--muted)]">Aucun dossier lié pour l’instant.</p>
        )}

        {standaloneFiles.length ? (
          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--page-bg)] p-3 sm:p-4">
            <p className="text-sm font-extrabold text-[color:var(--fg)]">Fichiers partagés à part</p>
            <ul className="mt-2 space-y-1">
              {standaloneFiles.map((file) => (
                <li key={file.id} className="text-sm text-[color:var(--muted)]">
                  <span className="text-[color:var(--fg)]">{file.name}</span>
                  {file.folderLabel ? (
                    <span className="text-xs"> · {file.folderLabel}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <GroupDriveLinkForm groupId={group.id} folders={availableOpts} />
      </section>
    </div>
  )
}
