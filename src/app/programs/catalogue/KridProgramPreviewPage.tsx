import { redirect } from 'next/navigation'

import { AdminProgramBuilderShell } from '@/src/components/admin/AdminProgramBuilderShell'
import { DaBanner } from '@/src/components/ui'
import { canAccessCoachApp } from '@/src/lib/auth/roles'
import { loadProgramBuilderPageData } from '@/src/lib/programs/loadProgramBuilderPageData'
import { createClient } from '@/src/lib/supabase/server'

type Props = {
  params: Promise<{ id: string }> | { id: string }
  searchParams?:
    | Promise<{ week?: string; day?: string; error?: string }>
    | { week?: string; day?: string; error?: string }
}

/** Preview catalogue Krid — même chrome que le builder, lecture seule + → Brouillon. */
export default async function KridProgramPreviewPage({ params, searchParams }: Props) {
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
    scope: 'krid',
    coachId: user.id,
    searchParams: {
      error: typeof q.error === 'string' ? q.error : undefined,
      week: typeof q.week === 'string' ? q.week : undefined,
      day: typeof q.day === 'string' ? q.day : undefined,
    },
  })

  return (
    <>
      {data.errorFlash ? (
        <div className="px-1 pb-2">
          <DaBanner tone="danger">{data.errorFlash}</DaBanner>
        </div>
      ) : null}
      <AdminProgramBuilderShell
        variant="coach"
        readOnly
        basePath="/programs/catalogue"
        backHref="/programs/catalogue"
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
