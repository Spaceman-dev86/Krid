import { AdminProgramBuilderShell } from '@/src/components/admin/AdminProgramBuilderShell'
import { DaBanner } from '@/src/components/ui'
import { requirePlatformAdmin } from '@/src/lib/auth/requirePlatformAdmin'
import { loadProgramBuilderPageData } from '@/src/lib/programs/loadProgramBuilderPageData'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?:
    | Promise<{ ok?: string; error?: string; week?: string; day?: string }>
    | { ok?: string; error?: string; week?: string; day?: string }
}) {
  await requirePlatformAdmin()
  const { id } = await params
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()

  const data = await loadProgramBuilderPageData({
    supabase,
    programId: id,
    scope: 'admin',
    searchParams: {
      ok: typeof q.ok === 'string' ? q.ok : undefined,
      error: typeof q.error === 'string' ? q.error : undefined,
      week: typeof q.week === 'string' ? q.week : undefined,
      day: typeof q.day === 'string' ? q.day : undefined,
    },
  })

  return (
    <>
      {data.errorFlash ? (
        <div className="mx-auto max-w-6xl px-4 pt-3 md:px-6">
          <DaBanner tone="danger">{data.errorFlash}</DaBanner>
        </div>
      ) : null}
      <AdminProgramBuilderShell
        variant="admin"
        basePath="/admin/programs"
        backHref="/admin/programs"
        initialWeekId={data.initialWeekId}
        initialDay={data.initialDay}
        softFlash={data.softFlash}
        catalogSessions={data.catalogSessions}
        catalogBlocks={data.catalogBlocks}
        catalogExercises={data.catalogExercises}
        catalogSports={data.catalogSports}
        catalogTypes={data.catalogTypes}
        compositionEditor={data.compositionEditor}
        program={data.program}
      />
    </>
  )
}
