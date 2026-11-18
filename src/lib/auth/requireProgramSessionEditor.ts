import { NextResponse } from 'next/server'

import { canAccessCoachApp, isPlatformAdmin } from '@/src/lib/auth/roles'
import {
  assertCanEditProgramSession,
  assertCanEditProgramSessionBlock,
} from '@/src/lib/programs/assertCanEditProgramSession'
import { createClient } from '@/src/lib/supabase/server'

/** Auth API blocs séance programme : platform admin OU coach propriétaire. */
export async function requireProgramSessionEditor(opts: {
  programSessionId?: string | null
  sessionBlockId?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  const role = profile?.role ?? null

  if (isPlatformAdmin(role)) {
    return { supabase, userId: user.id, role }
  }

  if (!canAccessCoachApp(role)) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  }

  if (opts.sessionBlockId) {
    const access = await assertCanEditProgramSessionBlock(
      supabase,
      opts.sessionBlockId,
      user.id,
      role,
    )
    if (!access.ok) {
      return {
        error: NextResponse.json({ error: access.error }, { status: access.status }),
      }
    }
    return { supabase, userId: user.id, role, access }
  }

  if (opts.programSessionId) {
    const access = await assertCanEditProgramSession(
      supabase,
      opts.programSessionId,
      user.id,
      role,
    )
    if (!access.ok) {
      return {
        error: NextResponse.json({ error: access.error }, { status: access.status }),
      }
    }
    return { supabase, userId: user.id, role, access }
  }

  return { error: NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 }) }
}
