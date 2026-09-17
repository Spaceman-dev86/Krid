import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ShowroomTrackedRef } from '../../../../../components/showroom/ShowroomTrackedRef'
import { createClient } from '../../../../../lib/supabase/server'
import { createServiceRoleClient } from '../../../../../lib/supabase/serviceRole'
import { buildTrackedDestinationPath } from '../../../../../lib/tracking/trackedLinks'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; code: string }> | { slug: string; code: string }
}

async function loadCampaign(slug: string, code: string) {
  const supabase = await createClient()
  const { data: branding } = await supabase
    .from('coach_branding')
    .select('coach_id, slug, app_name, logo_url, primary_color')
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) return null

  const admin = createServiceRoleClient()
  const db = admin ?? supabase

  const { data: link } = await db
    .from('coach_tracked_links')
    .select(
      'id, code, label, share_message, channel, target_kind, prestation_id, capture_leads, status'
    )
    .eq('coach_id', branding.coach_id)
    .eq('status', 'active')
    .ilike('code', code)
    .maybeSingle()

  if (!link) return null

  let prestaName: string | null = null
  if (link.target_kind === 'prestation' && link.prestation_id) {
    const { data: presta } = await db
      .from('prestations')
      .select('name')
      .eq('id', link.prestation_id)
      .maybeSingle()
    prestaName = presta?.name ?? null
  }

  return { branding, link, prestaName }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, code } = await Promise.resolve(params)
  const data = await loadCampaign(slug, code)
  if (!data) return { title: 'Lien introuvable' }

  const title =
    data.link.share_message?.trim() ||
    data.link.label?.trim() ||
    data.branding.app_name?.trim() ||
    'Offre coaching'
  const description =
    data.prestaName
      ? `${data.prestaName} · ${data.branding.app_name ?? 'Trainly'}`
      : data.branding.app_name?.trim() || 'Découvre les offres'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function TrackedGoPage({ params }: Props) {
  const { slug, code } = await Promise.resolve(params)
  const data = await loadCampaign(slug, code)
  if (!data) notFound()

  const { branding, link, prestaName } = data
  const brand = branding.primary_color?.trim() || '#341c44'
  const appName = branding.app_name?.trim() || 'Trainly'
  const headline = link.share_message?.trim() || link.label
  const dest = buildTrackedDestinationPath({
    slug,
    code: link.code,
    targetKind: link.target_kind === 'prestation' ? 'prestation' : 'showroom',
    prestationId: link.prestation_id,
  })

  return (
    <main className="flex min-h-screen flex-col bg-[#f6f4f8] text-[#1a1220]">
      <ShowroomTrackedRef coachId={branding.coach_id} refCode={link.code} brand={brand} />
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-12">
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white"
              style={{ background: brand }}
            >
              {appName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">
              {appName}
            </p>
            <p className="text-sm text-black/50">
              {prestaName ? `Offre · ${prestaName}` : 'Showroom'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="whitespace-pre-wrap text-2xl font-extrabold leading-snug" style={{ color: brand }}>
            {headline}
          </h1>
          <p className="mt-3 text-sm text-black/55">
            Ouvre l’offre pour continuer (compte / paiement si besoin).
          </p>
          <Link
            href={dest}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-bold text-white"
            style={{ background: brand }}
          >
            Continuer
          </Link>
        </div>
      </div>
    </main>
  )
}
