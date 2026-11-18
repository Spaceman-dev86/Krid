import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { PrestationShowroomVignette } from '../../../../components/coach/PrestationShowroomVignette'
import { ShowroomAppCard } from '../../../../components/showroom/ShowroomAppCard'
import { ShowroomTestimonialsCarousel } from '../../../../components/showroom/ShowroomTestimonialsCarousel'
import { ShowroomInterestCta } from '../../../../components/showroom/ShowroomInterestCta'
import { ShowroomTrackedRef } from '../../../../components/showroom/ShowroomTrackedRef'
import { ShowroomVideoEmbed } from '../../../../components/showroom/ShowroomVideoEmbed'
import { parseAppShowroomFeatures } from '../../../../lib/coach/appShowroomFeatures'
import { parseShowroomTestimonials } from '../../../../lib/coach/showroomTestimonials'
import {
  contrastBrandFg,
  normalizeBgStyle,
  normalizeThemeMode,
} from '../../../../lib/coach/clientBrandTheme'
import { hydrateShowroomOfferCards } from '../../../../lib/prestations/hydrateShowroomOfferCards'
import { parseShowroomTags } from '../../../../lib/prestations/modules'
import {
  resolveDefaultTrackedLink,
  resolveTrackedLinkByRef,
} from '../../../../lib/tracking/recordShowroomRef'
import { withRef } from '../../../../lib/tracking/trackedLinks'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string }> | { slug: string }
  searchParams?:
    | Promise<{ error?: string; ref?: string; open?: string }>
    | { error?: string; ref?: string; open?: string }
}

export default async function CoachShowroomPage({ params, searchParams }: Props) {
  const { slug } = await Promise.resolve(params)
  const q = await Promise.resolve(searchParams ?? {})
  const refCode = typeof q.ref === 'string' && q.ref.trim() ? q.ref.trim() : null
  const openPrestaId = typeof q.open === 'string' && q.open.trim() ? q.open.trim() : null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select(
      'coach_id, slug, app_name, logo_url, pwa_icon_url, primary_color, secondary_color, theme_mode, bg_style, app_showroom_pitch',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) notFound()

  const { data: contactRow } = await supabase
    .from('coach_branding')
    .select('interest_discuss_title, interest_discuss_body')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  const contactExtra = contactRow as {
    interest_discuss_title?: string | null
    interest_discuss_body?: string | null
  } | null

  const interestDiscussTitle = contactExtra?.interest_discuss_title ?? null
  const interestDiscussBody = contactExtra?.interest_discuss_body ?? null

  const trackedLink = refCode
    ? await resolveTrackedLinkByRef(branding.coach_id, refCode)
    : await resolveDefaultTrackedLink(branding.coach_id)
  const effectiveRef = refCode ?? trackedLink?.code ?? null
  const appLogo =
    branding.logo_url?.trim() ||
    (branding as { pwa_icon_url?: string | null }).pwa_icon_url?.trim() ||
    null

  const { data: publicProfile } = await supabase
    .from('coach_public_profile')
      .select('public_name, tagline, bio, photo_url, cover_url')
      .eq('coach_id', branding.coach_id)
      .maybeSingle()

  const { data: videoRow, error: videoSelectError } = await supabase
    .from('coach_public_profile')
    .select('video_url')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  const { data: testiRow, error: testiSelectError } = await supabase
    .from('coach_public_profile')
    .select('showroom_testimonials')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  const { data: headerTagsRow, error: headerTagsSelectError } = await supabase
    .from('coach_public_profile')
    .select('showroom_header_tags')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  const { data: featuresRow, error: featuresSelectError } = await supabase
    .from('coach_branding')
    .select('app_showroom_features')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  let canEnterPortal = false
  if (user) {
    const { data: linked } = await supabase
      .from('clients')
      .select('id')
      .eq('user_id', user.id)
      .eq('coach_id', branding.coach_id)
      .is('deleted_at', null)
      .maybeSingle()
    canEnterPortal = Boolean(linked)
  }

  /** Prospect = pas encore client lié. Client app = checkout direct, sans CTA intérêt. */
  const isProspect = !canEnterPortal
  /** Prospects : toujours tunnel intérêt (CTA + capture leads). */
  const interestCheckout = isProspect

  const prestaCols =
    'id, name, description, price_cents, pricing_type, photo_url, showroom_tags, showroom_popup_tags, video_url, highlight_tag, showroom_eyebrow, showroom_cta_label, showroom_description, showroom_week_id, showroom_photo_is_cover, showroom_video_role, show_program_tags, showroom_hidden_program_tags, program_template_id, nutrition_template_id, drive_folder_id, program_template_ids, nutrition_template_ids, drive_folder_ids'
  let prestaProbe = await supabase
    .from('prestations')
    .select(`${prestaCols}, showroom_sort_order`)
    .eq('coach_id', branding.coach_id)
    .eq('showroom_visible', true)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('showroom_sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (
    prestaProbe.error &&
    /showroom_sort_order|schema cache/i.test(prestaProbe.error.message)
  ) {
    prestaProbe = await supabase
      .from('prestations')
      .select(prestaCols)
      .eq('coach_id', branding.coach_id)
      .eq('showroom_visible', true)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true })
  }

  const prestations = await hydrateShowroomOfferCards(
    supabase,
    (prestaProbe.data ?? []) as Parameters<typeof hydrateShowroomOfferCards>[1],
  )

  const brand = branding.primary_color?.trim() || '#341c44'
  const brandFg = contrastBrandFg(brand)
  const themeMode = normalizeThemeMode(branding.theme_mode)
  const bgStyle = normalizeBgStyle(branding.bg_style)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const appName = branding.app_name?.trim() || 'Krid'
  const displayName = publicProfile?.public_name?.trim() || appName
  const tagline = publicProfile?.tagline?.trim() || null
  const bio = publicProfile?.bio?.trim() || null
  const photoUrl = publicProfile?.photo_url?.trim() || null
  const coverUrl = publicProfile?.cover_url?.trim() || null
  const videoUrl =
    !videoSelectError &&
    typeof (videoRow as { video_url?: string | null } | null)?.video_url === 'string'
      ? String((videoRow as { video_url?: string | null }).video_url ?? '').trim() || null
      : null
  const testimonials = !testiSelectError
    ? parseShowroomTestimonials(
        (testiRow as { showroom_testimonials?: unknown } | null)?.showroom_testimonials,
      )
    : []
  const headerTags = !headerTagsSelectError
    ? parseShowroomTags(
        (headerTagsRow as { showroom_header_tags?: unknown } | null)?.showroom_header_tags,
      )
    : []
  const appPitch =
    (branding as { app_showroom_pitch?: string | null }).app_showroom_pitch?.trim() || null
  const appFeatures = !featuresSelectError
    ? parseAppShowroomFeatures(
        (featuresRow as { app_showroom_features?: unknown } | null)?.app_showroom_features,
      )
    : []
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

      {/* Cover en fond plein cadre — identité coach par-dessus */}
      <header className="relative z-[2] overflow-hidden">
        {coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/80" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(160deg, ${brand} 0%, #121218 72%)`,
            }}
          />
        )}
        <div className="relative mx-auto flex max-w-3xl items-end justify-between gap-3 px-4 pb-6 pt-10 md:px-6 md:pb-8 md:pt-14">
          <div className="flex min-w-0 items-end gap-3 text-white">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/90 shadow-md sm:h-16 sm:w-16"
              />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold ring-2 ring-white/90 shadow-md sm:h-16 sm:w-16"
                style={{ background: brand, color: brandFg }}
              >
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 pb-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                Showroom
              </p>
              <p className="truncate text-lg font-bold drop-shadow-sm sm:text-xl">{displayName}</p>
              {tagline ? (
                <p className="truncate text-sm text-white/85">{tagline}</p>
              ) : null}
            </div>
          </div>
          {canEnterPortal ? (
            <Link
              href={`/c/${slug}/home`}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold shadow-md"
              style={{ background: brand, color: brandFg }}
            >
              Entrer dans l’app
            </Link>
          ) : (
            <Link
              href={`/login/client?redirectTo=${encodeURIComponent(withRef(`/c/${slug}/showroom`, refCode))}`}
              className="shrink-0 rounded-lg border border-white/35 bg-white/15 px-3 py-2 text-sm font-bold text-white backdrop-blur-sm"
            >
              Connexion
            </Link>
          )}
        </div>
      </header>

      <div className="relative z-[2] mx-auto grid max-w-3xl gap-6 px-4 py-8 md:px-6">
        {q.error === 'not_your_coach' ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Ce compte n’est pas rattaché à ce coach. Demande une invitation ou choisis une offre.
          </div>
        ) : null}

        {headerTags.length ? (
          <div className="flex flex-wrap gap-2">
            {headerTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-3 py-1 text-sm font-bold"
                style={{ background: brand, color: brandFg }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {bio ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--muted)]">
            {bio}
          </p>
        ) : null}

        {videoUrl ? <ShowroomVideoEmbed url={videoUrl} title={`Vidéo ${displayName}`} /> : null}

        <ShowroomAppCard
          appName={appName}
          pitch={appPitch}
          features={appFeatures}
          logoUrl={appLogo}
          brand={brand}
          brandFg={brandFg}
        />

        {testimonials.length ? (
          <div>
            <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-[color:var(--fg)] sm:text-3xl">
              Témoignages
            </h2>
            <ShowroomTestimonialsCarousel items={testimonials} />
          </div>
        ) : null}

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[color:var(--fg)] sm:text-3xl">
            Mes offres
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Accès à l’app · ouvre une offre pour voir le détail.
          </p>
        </div>

        {!prestations.length ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[color:var(--muted)]">
            Aucune offre publiée pour le moment.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {prestations.map((p) => (
              <li key={p.id}>
                <PrestationShowroomVignette
                  name={p.name}
                  description={p.description}
                  showroomDescription={p.showroom_description}
                  priceCents={p.price_cents}
                  pricingType={p.pricing_type}
                  photoUrl={p.photo_url}
                  videoUrl={p.video_url}
                  photoIsCover={p.showroom_photo_is_cover}
                  videoRole={p.showroom_video_role}
                  eyebrow={p.showroom_eyebrow}
                  ctaLabel={p.showroom_cta_label || 'Découvrir'}
                  tags={p.showroom_tags}
                  popupTags={p.showroom_popup_tags}
                  included={p.included}
                  weekPreview={p.weekPreview}
                  brandColor={brand}
                  secondaryColor={
                    (branding as { secondary_color?: string | null }).secondary_color
                  }
                  themeMode={themeMode}
                  bgStyle={bgStyle}
                  appName={appName}
                  logoUrl={appLogo}
                  sheetMode="portal"
                  aspectClassName="aspect-[16/10]"
                  defaultOpen={openPrestaId === p.id}
                  ctaHref={
                    interestCheckout
                      ? withRef(`/c/${slug}/showroom/${p.id}/interesse`, effectiveRef)
                      : withRef(`/c/${slug}/showroom/${p.id}`, effectiveRef)
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {isProspect ? (
          <ShowroomInterestCta
            coachId={branding.coach_id}
            refCode={effectiveRef}
            brand={brand}
            brandFg={brandFg}
            discussTitle={interestDiscussTitle}
            discussBody={interestDiscussBody}
          />
        ) : null}

        <p className="text-center text-xs text-[color:var(--muted)]">
          Propulsé par Krid ·{' '}
          <Link href="/" className="underline">
            Accueil
          </Link>
        </p>
      </div>
    </main>
  )
}
