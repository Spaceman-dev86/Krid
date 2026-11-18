import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { CSSProperties } from 'react'

import { ShowroomTrackedRef } from '../../../../../../components/showroom/ShowroomTrackedRef'
import {
  contrastBrandFg,
  normalizeBgStyle,
  normalizeThemeMode,
} from '../../../../../../lib/coach/clientBrandTheme'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../../../../../lib/coach/defaultClientPrimaryColor'
import { withRef } from '../../../../../../lib/tracking/trackedLinks'
import { createClient } from '../../../../../../lib/supabase/server'
import { pursuePrestaInterestAction } from './actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; prestaId: string }> | { slug: string; prestaId: string }
  searchParams?:
    | Promise<{ ref?: string; error?: string }>
    | { ref?: string; error?: string }
}

export default async function PrestaInterestPage({ params, searchParams }: Props) {
  const { slug, prestaId } = await Promise.resolve(params)
  const sp = await Promise.resolve(searchParams ?? {})
  const refCode = typeof sp.ref === 'string' && sp.ref.trim() ? sp.ref.trim() : null
  const errorMsg = typeof sp.error === 'string' && sp.error.trim() ? sp.error.trim() : null

  const supabase = await createClient()
  const { data: branding } = await supabase
    .from('coach_branding')
    .select(
      'coach_id, slug, app_name, primary_color, secondary_color, theme_mode, bg_style, logo_url'
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: linked } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('coach_id', branding.coach_id)
      .is('deleted_at', null)
      .maybeSingle()
    if (linked) {
      redirect(withRef(`/c/${slug}/showroom/${prestaId}`, refCode))
    }
  }

  const { data: prestation } = await supabase
    .from('prestations')
    .select('id, name, price_cents, pricing_type')
    .eq('id', prestaId)
    .eq('coach_id', branding.coach_id)
    .eq('showroom_visible', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()

  if (!prestation) notFound()

  const brand = branding.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR
  const brandFg = contrastBrandFg(brand)
  const themeMode = normalizeThemeMode(branding.theme_mode)
  const bgStyle = normalizeBgStyle(branding.bg_style)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const appName = branding.app_name?.trim() || 'Krid'
  const backPopup = withRef(`/c/${slug}/showroom?open=${encodeURIComponent(prestaId)}`, refCode)
  const shellStyle = {
    ['--brand']: brand,
    ['--brand-fg']: brandFg,
  } as CSSProperties

  return (
    <main
      data-theme={themeMode}
      className={`min-h-screen text-[color:var(--fg)] ${pageBg}`}
      style={shellStyle}
    >
      <ShowroomTrackedRef coachId={branding.coach_id} refCode={refCode} brand={brand} />

      <div className="mx-auto grid max-w-lg gap-6 px-4 py-10 md:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            {appName}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-[color:var(--fg)]">Tes infos</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Avant le checkout pour <span className="font-semibold text-[color:var(--fg)]">{prestation.name}</span>.
          </p>
        </div>

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        ) : null}

        <form
          action={pursuePrestaInterestAction}
          className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-da-sm"
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="prestation_id" value={prestaId} />
          <input type="hidden" name="coach_id" value={branding.coach_id} />
          {refCode ? <input type="hidden" name="ref" value={refCode} /> : null}

          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Prénom *</span>
            <input
              name="first_name"
              required
              autoComplete="given-name"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Nom *</span>
            <input
              name="last_name"
              required
              autoComplete="family-name"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Email *</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-semibold">Date de naissance *</span>
            <input
              name="birthdate"
              type="date"
              required
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold shadow-md"
            style={{ background: brand, color: brandFg }}
          >
            Poursuivre vers le checkout
          </button>

          <Link
            href={backPopup}
            className="text-center text-sm font-semibold text-[color:var(--muted)] hover:underline"
          >
            Passer
          </Link>
        </form>
      </div>
    </main>
  )
}
