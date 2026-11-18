import { redirect } from 'next/navigation'

import { DaBanner, Eyebrow, Muted } from '@/src/components/ui'
import { DriveBrowser } from '../../../components/drive/DriveBrowser'
import { DriveRenameControl } from '../../../components/drive/DriveRenameControl'
import { requireCoachAppUser } from '../../../lib/auth/requireCoachAppUser'
import { loadCoachDrivePageData } from '../../../lib/drive/loadCoachDrivePageData'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ folderId: string }> | { folderId: string }
  searchParams?:
    | Promise<{
        error?: string
        q?: string
      }>
    | {
        error?: string
        q?: string
      }
}

export default async function DriveFolderPage({ params, searchParams }: Props) {
  const { folderId } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase, userId } = await requireCoachAppUser()

  const searchNeedle = (q.q ?? '').trim()
  let data: Awaited<ReturnType<typeof loadCoachDrivePageData>>
  try {
    data = await loadCoachDrivePageData(supabase, userId, folderId, searchNeedle)
  } catch (e) {
    redirect('/drive?error=' + encodeURIComponent(e instanceof Error ? e.message : 'Erreur'))
  }

  const folder = data.folder!
  return (
    <div className="mx-auto grid min-w-0 max-w-4xl gap-4 pb-4 sm:gap-5 sm:pb-6">
      <div>
        <Eyebrow>Drive</Eyebrow>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <DriveRenameControl
            kind="folder"
            id={folder.id}
            name={folder.name}
            listFolderId={folder.id}
            size="lg"
          />
        </div>
        <Muted className="mt-2 text-[12px] leading-relaxed sm:text-[13px] md:text-sm">
          Dossier · fichiers · partage client/groupe
        </Muted>
      </div>

      {q.error ? <DaBanner tone="danger">{q.error}</DaBanner> : null}

      <DriveBrowser
        folders={data.folders}
        files={data.files}
        folderId={folderId}
        parentId={folder.parent_id}
        folderName={folder.name}
        clients={data.clients}
        groups={data.groups}
        moveTargets={data.moveTargets}
        sharesByFile={data.sharesByFile}
        sharesByFolder={data.sharesByFolder}
        fileCountsByFolder={data.fileCountsByFolder}
        sizeBytesByFolder={data.sizeBytesByFolder}
        fileNamesByFolder={data.fileNamesByFolder}
        searchActive={false}
        initialQuery={searchNeedle}
        breadcrumb={data.breadcrumb}
      />
    </div>
  )
}
