import { NextResponse } from 'next/server'

import { countUnopenedForClient } from '../../../../../src/lib/bilans/bilans'
import { createClient } from '../../../../../src/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function GET(_req: Request, { params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!branding?.coach_id) return NextResponse.json({ count: 0 })

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('coach_id', branding.coach_id)
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!client?.id) return NextResponse.json({ count: 0 })

  try {
    const count = await countUnopenedForClient(supabase, client.id)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 })
  }
}
