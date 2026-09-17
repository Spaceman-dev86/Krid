import { redirect } from 'next/navigation'

import { InstallCoachAppClient } from '../../../../components/client-portal/InstallCoachAppClient'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
}

/**
 * Lien d’installation unique :
 * - anon → rejoindre / login
 * - client lié + grant → page install PWA + entrée portail
 * - connecté sans grant → showroom
 */
export default async function ClientInstallPage({ params }: Props) {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug, app_name, logo_url, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) redirect('/')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login/client?redirectTo=${encodeURIComponent(`/c/${slug}/install`)}`)
  }

  const { data: linked } = await supabase
    .from('clients')
    .select('id')
    .eq('user_id', user.id)
    .eq('coach_id', branding.coach_id)
    .is('deleted_at', null)
    .maybeSingle()

  let canEnterPortal = false
  if (linked) {
    const { data: grant } = await supabase
      .from('client_grants')
      .select('id')
      .eq('client_id', linked.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    canEnterPortal = Boolean(grant)
  }

  if (!linked) {
    redirect(`/c/${slug}/showroom?error=not_your_coach`)
  }

  if (!canEnterPortal) {
    redirect(`/c/${slug}/showroom`)
  }

  const appName = branding.app_name?.trim() || 'Mon coach'
  const brand = branding.primary_color?.trim() || '#341c44'

  return (
    <InstallCoachAppClient
      slug={slug}
      appName={appName}
      logoUrl={branding.logo_url}
      primaryColor={brand}
      canEnterPortal
    />
  )
}
