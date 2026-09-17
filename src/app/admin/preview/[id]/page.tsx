import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import ProgramPreviewLoadingSkeleton from '../../../../components/ProgramPreviewLoadingSkeleton'
import { requirePlatformAdmin } from '../../../../lib/auth/requirePlatformAdmin'
import { createClient } from '../../../../lib/supabase/server'
import PreviewProgramContent, {
  type PreviewProgramRow,
} from '../../../dashboard/preview/[id]/PreviewProgramContent'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ from?: string; mode?: string }> | { from?: string; mode?: string }
}

/** Preview client (phone) — accessible admin même si non publié. */
export default async function AdminProgramClientPreviewPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const q = await Promise.resolve(searchParams ?? {})
  await requirePlatformAdmin()

  const supabase = await createClient()

  const { data: program } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!program) notFound()

  const mode = q.mode === 'coach' || q.from === 'coach' ? 'coach' : 'trainly'
  const backHref =
    mode === 'coach' ? '/admin/programs?mode=coach' : '/admin/programs'

  const previewProgram = program as PreviewProgramRow

  return (
    <Suspense fallback={<ProgramPreviewLoadingSkeleton />}>
      <PreviewProgramContent program={previewProgram} backHref={backHref} />
    </Suspense>
  )
}
