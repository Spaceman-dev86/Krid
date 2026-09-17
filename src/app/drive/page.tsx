import { redirect } from 'next/navigation'

import { PageTitle, Muted, DaBanner } from '@/src/components/ui'
import { CoachAppShell } from '../../components/coach/CoachAppShell'
import { DriveBrowser } from '../../components/drive/DriveBrowser'
import { TrainlyDriveSection } from '../../components/drive/TrainlyDriveSection'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { clientDisplayName } from '../../lib/chat/chat'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import {
  listAllFoldersForMove,
  listFiles,
  listFolders,
  listSharesForCoach,
} from '../../lib/drive/drive'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
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

export default async function DriveRootPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)

  let folders: Awaited<ReturnType<typeof listFolders>> = []
  let files: Awaited<ReturnType<typeof listFiles>> = []
  let moveTargets: Awaited<ReturnType<typeof listAllFoldersForMove>> = []
  let sharesByFile: Awaited<ReturnType<typeof listSharesForCoach>>['byFile'] = {}
  let sharesByFolder: Awaited<ReturnType<typeof listSharesForCoach>>['byFolder'] = {}
  let loadError: string | null = null

  const { data: clients } = await supabase
    .from('clients')
    .select('id, first_name, last_name, email')
    .eq('coach_id', user.id)
    .is('deleted_at', null)
    .neq('status', 'archived')
    .order('first_name', { ascending: true })

  const clientOpts = (clients ?? []).map((c) => ({
    id: c.id,
    label: clientDisplayName({
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
    }),
  }))
  const clientLabelById = new Map(clientOpts.map((c) => [c.id, c.label]))

  try {
    folders = await listFolders(supabase, user.id, null)
    files = await listFiles(supabase, user.id, null)
    moveTargets = await listAllFoldersForMove(supabase, user.id)
    const shares = await listSharesForCoach(supabase, user.id, clientLabelById)
    sharesByFile = shares.byFile
    sharesByFolder = shares.byFolder
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  const { data: trainlyPacks } = await supabase
    .from('trainly_drive_library')
    .select('id, title, description, allow_duplicate, allow_download, original_name, size_bytes')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <CoachAppShell appName={shell.branding?.app_name} trialLabel={shell.trialLabel} title="Drive" savUnread={shell.savUnread}>
      <div className="mx-auto grid max-w-3xl gap-5">
        <div>
          <PageTitle className="text-2xl">Drive</PageTitle>
          <Muted className="mt-1">Trainly · dossiers · upload · partage client</Muted>
        </div>

        <TrainlyDriveSection packs={trainlyPacks ?? []} />

        {q.error || loadError ? <DaBanner tone="danger">{q.error || loadError}</DaBanner> : null}
        {q.uploaded || q.created || q.shared || q.deleted || q.moved || q.unshared ? (
          <DaBanner tone="success">
            {q.shared
              ? 'Partagé avec le client.'
              : q.unshared
                ? 'Partage retiré.'
                : q.uploaded
                  ? 'Fichier(s) ajouté(s).'
                  : q.created
                    ? 'Dossier créé.'
                    : q.moved
                      ? 'Déplacé.'
                      : 'Élément archivé.'}
          </DaBanner>
        ) : null}

        <DriveBrowser
          folders={folders}
          files={files}
          folderId={null}
          parentId={null}
          clients={clientOpts}
          moveTargets={moveTargets}
          sharesByFile={sharesByFile}
          sharesByFolder={sharesByFolder}
        />
      </div>
    </CoachAppShell>
  )
}
