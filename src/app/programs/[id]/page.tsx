import { redirect } from 'next/navigation'

import { AdminProgramBuilderShell } from '@/src/components/admin/AdminProgramBuilderShell'
import { DaBanner } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { loadProgramBuilderPageData } from '@/src/lib/programs/loadProgramBuilderPageData'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function CoachProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ ok?: string; error?: string; week?: string; day?: string }>
    | { ok?: string; error?: string; week?: string; day?: string }
}) {
  const { id } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp((profile as { role?: string | null } | null)?.role)) redirect('/login')

  const data = await loadProgramBuilderPageData({
    supabase,
    programId: id,
    scope: 'coach',
    coachId: user.id,
    searchParams: {
      ok: typeof q.ok === 'string' ? q.ok : undefined,
      error: typeof q.error === 'string' ? q.error : undefined,
      week: typeof q.week === 'string' ? q.week : undefined,
      day: typeof q.day === 'string' ? q.day : undefined,
    },
  })

  const backHref = data.program.is_client_instance
    ? '/programs/encours'
    : data.program.catalog_status === 'published'
      ? '/programs/templates'
      : '/programs/brouillon'

  return (
    <>
      {data.errorFlash ? (
        <div className="px-1 pb-2">
          <DaBanner tone="danger">{data.errorFlash}</DaBanner>
        </div>
      ) : null}
      <AdminProgramBuilderShell
        variant="coach"
        basePath="/programs"
        backHref={backHref}
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
