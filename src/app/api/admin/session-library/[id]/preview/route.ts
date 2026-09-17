import { NextResponse } from 'next/server'

import { isPlatformAdmin } from '@/src/lib/auth/roles'
import { fetchSessionLibraryPreview } from '@/src/lib/sessions/fetchSessionLibraryPreview'
import { createClient } from '@/src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!isPlatformAdmin((profile as { role?: string | null } | null)?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { preview, error } = await fetchSessionLibraryPreview(supabase, id)
  if (error) return NextResponse.json({ error }, { status: 400 })
  if (!preview) return NextResponse.json({ error: 'Séance introuvable' }, { status: 404 })
  return NextResponse.json({ preview })
}
