import { NextResponse } from 'next/server'

import { createClient } from '@/src/lib/supabase/server'

type Ctx = { params: Promise<{ slug: string }> | { slug: string } }

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Empreinte branding pour sync live portail (poll / focus). */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await Promise.resolve(ctx.params)
  const supabase = await createClient()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select(
      'slug, app_name, primary_color, secondary_color, theme_mode, bg_style, logo_url, pwa_icon_url, updated_at'
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!branding?.slug) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      slug: branding.slug,
      app_name: branding.app_name,
      primary_color: branding.primary_color,
      secondary_color: branding.secondary_color,
      theme_mode: branding.theme_mode,
      bg_style: branding.bg_style,
      logo_url: branding.logo_url,
      pwa_icon_url: branding.pwa_icon_url,
      updated_at: branding.updated_at,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
