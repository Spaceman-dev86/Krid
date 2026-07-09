import { Suspense } from 'react'
import { redirect } from 'next/navigation'

import ProgramPreviewLoadingSkeleton from '../../../../components/ProgramPreviewLoadingSkeleton'
import { createClient } from '../../../../lib/supabase/server'
import PreviewProgramContent, { type PreviewProgramRow } from './PreviewProgramContent'

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DashboardPublicProgramPreviewPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration,is_published')
    .eq('id', id)
    .maybeSingle()

  const typedProgram = program as unknown as (PreviewProgramRow & { is_published: boolean | null }) | null
  if (!typedProgram || !typedProgram.is_published) {
    redirect('/dashboard')
  }

  const { is_published: _published, ...previewProgram } = typedProgram

  return (
    <Suspense fallback={<ProgramPreviewLoadingSkeleton />}>
      <PreviewProgramContent program={previewProgram} backHref="/dashboard" />
    </Suspense>
  )
}
