import { redirect } from 'next/navigation'

import { PageTitle, Muted } from '@/src/components/ui'
import { CoachAppShell } from '../../../components/coach/CoachAppShell'
import { DriveBrowser } from '../../../components/drive/DriveBrowser'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { clientDisplayName } from '../../../lib/chat/chat'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import {
  getFolder,
  listAllFoldersForMove,
  listFiles,
  listFolders,
  listSharesForCoach,
} from '../../../lib/drive/drive'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ folderId: string }> | { folderId: string }
  searchParams?:
    | Promise<{
        error?: string
        created?: string
        uploaded?: string
        shared?: string
        deleted?: string
        moved?: string
        unshared?: string
      }>
    | {
        error?: string
        created?: string
        uploaded?: string
        shared?: string
        deleted?: string
        moved?: string
        unshared?: string
      }
}

export default async function DriveFolderPage({ params, searchParams }: Props) {
  const { folderId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const folder = await getFolder(supabase, folderId)
  if (!folder || folder.coach_id !== user.id) {
    redirect('/drive?error=' + encodeURIComponent('Dossier introuvable'))
  }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')

  const clientOpts = (clients ?? []).map((c) => ({
    id: c.id,
    label: clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    }),
  }))
  const clientLabelById = new Map(clientOpts.map((c) => [c.id, c.label]))

  let folders: Awaited<ReturnType<typeof listFolders>> = []
  let files: Awaited<ReturnType<typeof listFiles>> = []
  let moveTargets: Awaited<ReturnType<typeof listAllFoldersForMove>> = []
  let sharesByFile: Awaited<ReturnType<typeof listSharesForCoach>>['byFile'] = {}
  let sharesByFolder: Awaited<ReturnType<typeof listSharesForCoach>>['byFolder'] = {}

  try {
    folders = await listFolders(supabase, user.id, folderId)
    files = await listFiles(supabase, user.id, folderId)
    moveTargets = await listAllFoldersForMove(supabase, user.id)
    const shares = await listSharesForCoach(supabase, user.id, clientLabelById)
    sharesByFile = shares.byFile
    sharesByFolder = shares.byFolder
  } catch (e) {
    redirect('/drive?error=' + encodeURIComponent(e instanceof Error ? e.message : 'Erreur'))
  }

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title={folder.name} savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <PageTitle className="text-2xl">{folder.name}</PageTitle>
          <Muted className="mt-1">Dossier Drive</Muted>
        </div>

        {q.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {q.error}
          </div>
        ) : null}
        {q.uploaded || q.created || q.shared || q.deleted || q.moved || q.unshared ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {q.shared
              ? 'Partagé avec le client.'
              : q.unshared
                ? 'Partage retiré.'
                : q.uploaded
                  ? 'Fichier(s) ajouté(s).'
                  : q.created
                    ? 'Dossier créé — tu es dedans.'
                    : q.moved
                      ? 'Déplacé.'
                      : 'Élément archivé.'}
          </div>
        ) : null}

        <DriveBrowser
          folders={folders}
          files={files}
          folderId={folderId}
          parentId={folder.parent_id}
          folderName={folder.name}
          clients={clientOpts}
          moveTargets={moveTargets}
          sharesByFile={sharesByFile}
          sharesByFolder={sharesByFolder}
          breadcrumb={[{ id: null, name: 'Drive' }]}
        />
      </div>
    </CoachAppShell>
  )
}
