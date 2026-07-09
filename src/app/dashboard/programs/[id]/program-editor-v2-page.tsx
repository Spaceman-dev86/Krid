import ProgramEditorErrorBoundary from '../../../../components/program-editor-v2/ProgramEditorErrorBoundary'
import ProgramEditorShell from '../../../../components/program-editor-v2/ProgramEditorShell'
import { createClient } from '../../../../lib/supabase/server'
import { fetchExerciseLibrary } from '../../../../lib/fetchExerciseLibrary'
import { fetchProgramDocument } from '../../../../lib/fetchProgramDocument'
import { redirect } from 'next/navigation'

import { assertCanEditProgram } from '../../../../lib/programEditorAccess'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ProgramEditorV2Page({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as { role: string | null } | null
  const isAdmin = profile?.role === 'admin'
  const basePath = isAdmin ? '/admin/programs' : '/dashboard/programs'
  const backHref = isAdmin ? '/admin' : '/dashboard'

  const access = await assertCanEditProgram(supabase, id, user.id, isAdmin)
  if (!access.ok) {
    redirect(isAdmin ? '/admin' : '/dashboard')
  }

  let initialDocument
  let exerciseLibrary
  try {
    ;[initialDocument, exerciseLibrary] = await Promise.all([
      fetchProgramDocument(supabase, id),
      fetchExerciseLibrary(supabase),
    ])
  } catch (err) {
    console.error('[ProgramEditor] server hydrate failed:', err)
    redirect(`${basePath}/${id}?legacy=1&v2_hydrate=1`)
  }

  return (
    <ProgramEditorErrorBoundary legacyEditorHref={`${basePath}/${id}?legacy=1`}>
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
