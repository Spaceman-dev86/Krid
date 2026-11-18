import { NextResponse } from 'next/server'

import { requireProgramSessionEditor } from '@/src/lib/auth/requireProgramSessionEditor'
import { forkLibraryBlockIntoProgramSession } from '@/src/lib/sessions/programSessionBlock'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    program_session_id?: string
    block_library_id?: string
  }
  const programSessionId = String(body.program_session_id ?? '').trim()
  const blockLibraryId = String(body.block_library_id ?? '').trim()
  if (!programSessionId || !blockLibraryId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const auth = await requireProgramSessionEditor({ programSessionId })
  if ('error' in auth && auth.error) return auth.error

  const result = await forkLibraryBlockIntoProgramSession(auth.supabase!, {
    programSessionId,
    blockLibraryId,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ block: result.detail })
}
