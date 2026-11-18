import type { Metadata } from 'next'

import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('app_name, logo_url, pwa_icon_url, primary_color, updated_at')
    .eq('slug', slug)
    .maybeSingle()

  const name = branding?.app_name?.trim() || 'Mon coach'
  const color = branding?.primary_color?.trim() || '#341c44'
  const v = branding?.updated_at ? encodeURIComponent(branding.updated_at) : String(Date.now())
  const withV = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${v}`
  const icon = withV(
    branding?.pwa_icon_url?.trim() || branding?.logo_url?.trim() || `/c/${slug}/pwa-icon`
  )

  return {
    title: name,
    applicationName: name,
    manifest: withV(`/c/${slug}/manifest`),
    themeColor: color,
    appleWebApp: {
      capable: true,
      title: name,
      statusBarStyle: 'default',
    },
    icons: {
      icon: [{ url: icon }],
      apple: [{ url: icon }],
    },
  }
}

export default function CoachSlugLayout({ children }: Props) {
  return children
}
