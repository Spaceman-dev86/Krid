import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import ProgramPreviewLoadingSkeleton from '../../../../../components/ProgramPreviewLoadingSkeleton'
import { createClient } from '../../../../../lib/supabase/server'
import PreviewProgramContent, { type PreviewProgramRow } from '../../../preview/[id]/PreviewProgramContent'

type PageProps = {
  params: Promise<{ id: string }>
}

type ProgramRow = PreviewProgramRow & {
  coach_id: string
}

export default async function ProgramCoachPreviewPage({ params }: PageProps) {
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
  const editorHref = `${basePath}/${id}`

  const { data: program } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration,coach_id')
    .eq('id', id)
    .maybeSingle()

  const typedProgram = program as ProgramRow | null
  if (!typedProgram) {
    redirect(`${basePath}?error=program_not_found`)
  }

  if (!isAdmin && typedProgram.coach_id !== user.id) {
    redirect(`${editorHref}?error=read_only`)
  }

  const { coach_id: _coachId, ...previewProgram } = typedProgram

  return (
    <Suspense fallback={<ProgramPreviewLoadingSkeleton />}>
      <PreviewProgramContent program={previewProgram} backHref={editorHref} />
    </Suspense>
  )
}
