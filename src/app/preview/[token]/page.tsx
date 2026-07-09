import { redirect } from 'next/navigation'

import PreviewProgramContent, { type PreviewProgramRow } from '../../dashboard/preview/[id]/PreviewProgramContent'
import { createServiceRoleClient } from '../../../lib/supabase/serviceRole'

type PageProps = {
  params: Promise<{ token: string }>
}

type ShareLinkRow = {
  token: string
  program_id: string
  revoked_at: string | null
  expires_at: string | null
}

export default async function PublicSharePreviewPage({ params }: PageProps) {
  const { token } = await params
  const shareToken = String(token ?? '').trim()
  if (!shareToken) {
    redirect('/programs')
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    redirect('/programs')
  }

  const { data: shareLink } = await supabase
    .from('program_share_links')
    .select('token,program_id,revoked_at,expires_at')
    .eq('token', shareToken)
    .maybeSingle()

  const typedShare = shareLink as ShareLinkRow | null
  if (!typedShare || typedShare.revoked_at) {
    redirect('/programs')
  }
  // Expiration is optional; enforce in DB / scheduled cleanup if needed.

  const { data: program } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration')
    .eq('id', typedShare.program_id)
    .maybeSingle()

  const typedProgram = program as PreviewProgramRow | null
  if (!typedProgram) {
    redirect('/programs')
  }

  return <PreviewProgramContent program={typedProgram} backHref="/programs" />
}

