import { redirect } from 'next/navigation'

import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ error?: string }>
    | { error?: string }
}

/** `/c/[slug]` → showroom (prospect) ou /home (client lié). */
export default async function CoachPortalRootPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: branding } = await supabase
      .from('coach_branding')
      .select('coach_id')
      .eq('slug', slug)
      .maybeSingle()

    if (branding) {
      const { data: linked } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('coach_id', branding.coach_id)
        .is('deleted_at', null)
        .maybeSingle()

      if (linked) {
        redirect(`/c/${slug}/home`)
      }
    }
  }

  const err = q.error ? `?error=${encodeURIComponent(q.error)}` : ''
  redirect(`/c/${slug}/showroom${err}`)
}
