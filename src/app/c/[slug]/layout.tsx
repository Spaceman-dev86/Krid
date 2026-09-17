import type { Metadata } from 'next'

import { createClient } from '../../../lib/supabase/server'

type Props = {
  children: React.ReactNode
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await Promise.resolve(params)
  const supabase = await createClient()
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('app_name, logo_url, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  const name = branding?.app_name?.trim() || 'Mon coach'
  const color = branding?.primary_color?.trim() || '#341c44'
  const icon = branding?.logo_url?.trim() || `/c/${slug}/pwa-icon`

  return {
    title: name,
    applicationName: name,
    manifest: `/c/${slug}/manifest`,
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
