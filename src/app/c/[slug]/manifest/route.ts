import { NextResponse } from 'next/server'

import { createClient } from '@/src/lib/supabase/server'

type Ctx = { params: Promise<{ slug: string }> | { slug: string } }

/** Manifest PWA dynamique par coach. */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await Promise.resolve(ctx.params)
  const supabase = await createClient()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('slug, app_name, logo_url, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding?.slug) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const name = branding.app_name?.trim() || 'Mon coach'
  const color = branding.primary_color?.trim() || '#341c44'
  const logo = branding.logo_url?.trim()
  const iconSvg = `/c/${slug}/pwa-icon`

  const icons = [
    ...(logo
      ? [
          { src: logo, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: logo, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ]
      : []),
    { src: iconSvg, sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
  ]

  const manifest = {
    id: `/c/${slug}/`,
    name,
    short_name: name.slice(0, 12),
    description: `${name} — coaching`,
    start_url: `/c/${slug}/home`,
    scope: `/c/${slug}/`,
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6f4f8',
    theme_color: color,
    icons,
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
