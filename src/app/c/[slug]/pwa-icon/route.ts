import { NextResponse } from 'next/server'

import { createClient } from '@/src/lib/supabase/server'

type Ctx = { params: Promise<{ slug: string }> | { slug: string } }

/** Icône SVG fallback (lettre + couleur branding). */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await Promise.resolve(ctx.params)
  const supabase = await createClient()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select('app_name, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  const name = branding?.app_name?.trim() || 'T'
  const letter = name.slice(0, 1).toUpperCase().replace(/[^A-Za-z0-9À-ÿ]/g, 'T') || 'T'
  const raw = branding?.primary_color?.trim() || '#341c44'
  const color = /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : '#341c44'

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${color}"/>
  <text x="256" y="286" text-anchor="middle" font-family="system-ui,sans-serif" font-size="240" font-weight="700" fill="#ffffff">${letter}</text>
</svg>`

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
