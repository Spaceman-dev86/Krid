import ProgramEditorErrorBoundary from '../../../components/program-editor-v2/ProgramEditorErrorBoundary'
import ProgramEditorShell from '../../../components/program-editor-v2/ProgramEditorShell'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { fetchExerciseLibrary } from '../../../lib/fetchExerciseLibrary'
import { fetchProgramDocument } from '../../../lib/fetchProgramDocument'
import { assertCanEditProgram } from '../../../lib/programEditorAccess'
import { createClient } from '../../../lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }> | { id: string }
}

export default async function CoachProgramEditorPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileData } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profileData as { role: string | null } | null)?.role
  if (!canAccessCoachApp(role)) redirect('/login')

  const basePath = '/programs'
  const backHref = '/programs'

  const access = await assertCanEditProgram(supabase, id, user.id, role === 'admin' || role === 'platform_admin')
  if (!access.ok) {
    redirect('/programs')
  }

  let initialDocument
  let exerciseLibrary
  try {
    ;[initialDocument, exerciseLibrary] = await Promise.all([
      fetchProgramDocument(supabase, id),
      fetchExerciseLibrary(supabase),
    ])
  } catch (err) {
    console.error('[ProgramEditor] coach hydrate failed:', err)
    redirect(`/programs?error=hydrate`)
  }

  return (
    <ProgramEditorErrorBoundary legacyEditorHref={`/dashboard/programs/${id}?legacy=1`}>
      <ProgramEditorShell
        programId={id}
        basePath={basePath}
        backHref={backHref}
        initialDocument={initialDocument}
        exerciseLibrary={exerciseLibrary}
      />
    </ProgramEditorErrorBoundary>
  )
}
