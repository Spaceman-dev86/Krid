import PreviewProgramContent, { type PreviewProgramRow } from '../../dashboard/preview/[id]/PreviewProgramContent'
import { createServiceRoleClient } from '../../../lib/supabase/serviceRole'
import PwaInstallHintClient from './PwaInstallHintClient'
import SharePreviewStatus from './SharePreviewStatus'

type PageProps = {
  params: Promise<{ token: string }>
}

type ShareLinkRow = {
  token: string
  program_id: string
  revoked_at: string | null
  expires_at: string | null
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

export default async function PublicSharePreviewPage({ params }: PageProps) {
  const { token } = await params
  const shareToken = String(token ?? '').trim()
  if (!shareToken) {
    return <SharePreviewStatus kind="invalid" />
  }

  const supabase = createServiceRoleClient()
  if (!supabase) {
    return <SharePreviewStatus kind="invalid" />
  }

  const { data: shareLink } = await supabase
    .from('program_share_links')
    .select('token,program_id,revoked_at,expires_at')
    .eq('token', shareToken)
    .maybeSingle()

  const typedShare = shareLink as ShareLinkRow | null
  if (!typedShare) {
    return <SharePreviewStatus kind="invalid" />
  }
  if (typedShare.revoked_at) {
    return <SharePreviewStatus kind="revoked" />
  }
  if (isExpired(typedShare.expires_at)) {
    return <SharePreviewStatus kind="expired" />
  }

  const { data: program } = await supabase
    .from('programs')
    .select('id,title,description,goal,level,duration')
    .eq('id', typedShare.program_id)
    .maybeSingle()

  const typedProgram = program as PreviewProgramRow | null
  if (!typedProgram) {
    return <SharePreviewStatus kind="invalid" />
  }

  return (
    <>
      <PreviewProgramContent program={typedProgram} backHref="/programs" useServiceRole />
      <PwaInstallHintClient />
    </>
  )
}
