import { DaBanner, Eyebrow, Muted, PageTitle } from '@/src/components/ui'
import { DriveBrowser } from '../../components/drive/DriveBrowser'
import { requireCoachAppUser } from '../../lib/auth/requireCoachAppUser'
import { loadCoachDrivePageData } from '../../lib/drive/loadCoachDrivePageData'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams?:
    | Promise<{
        error?: string
        ok?: string
        name?: string
        q?: string
      }>
    | {
        error?: string
        ok?: string
        name?: string
        q?: string
      }
}

export default async function DriveRootPage({ searchParams }: Props) {
  const q = await Promise.resolve(searchParams ?? {})
  const { supabase, userId } = await requireCoachAppUser()

  const searchNeedle = (q.q ?? '').trim()
  let data: Awaited<ReturnType<typeof loadCoachDrivePageData>> | null = null
  let loadError: string | null = null
  try {
    data = await loadCoachDrivePageData(supabase, userId, null, searchNeedle)
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Erreur'
  }

  return (
    <div className="mx-auto grid min-w-0 max-w-4xl gap-4 pb-4 sm:gap-5 sm:pb-6">
      <div>
        <Eyebrow>Espace perso</Eyebrow>
        <PageTitle className="mt-2 text-xl sm:text-2xl md:text-3xl">Drive</PageTitle>
        <Muted className="mt-2 max-w-2xl text-[12px] leading-relaxed sm:text-[13px] md:text-sm">
          Dossiers · upload · partage client/groupe · docs plateforme dans Documentation
        </Muted>
      </div>

      {q.error || loadError ? <DaBanner tone="danger">{q.error || loadError}</DaBanner> : null}
      {q.ok === 'recovered' ? (
        <DaBanner tone="success">
          Document récupéré depuis Documentation
          {q.name ? (
            <>
              {' '}
              : <span className="font-bold">{q.name}</span>
            </>
          ) : null}
          . Il est à la racine du Drive (ci-dessous).
        </DaBanner>
      ) : null}

      {data ? (
        <DriveBrowser
          folders={data.folders}
          files={data.files}
          folderId={null}
          parentId={null}
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
      ) : null}
    </div>
  )
}
