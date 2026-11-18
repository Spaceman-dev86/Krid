import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CoachShowroomPresentationEditor } from '../../components/coach/CoachShowroomPresentationEditor'
import { ProfileHubHeader } from '../../components/coach/ProfileHubHeader'
import { canAccessCoachApp } from '../../lib/auth/roles'
import { parseAppShowroomFeatures } from '../../lib/coach/appShowroomFeatures'
import { DEFAULT_CLIENT_PRIMARY_COLOR } from '../../lib/coach/defaultClientPrimaryColor'
import {
  DEFAULT_INTEREST_DISCUSS_BODY,
  DEFAULT_INTEREST_DISCUSS_TITLE,
} from '../../lib/coach/interestDiscussCopy'
import { loadCoachShellContext } from '../../lib/coach/loadCoachShellContext'
import { parseShowroomTestimonials } from '../../lib/coach/showroomTestimonials'
import { listActiveMediaLibraryCovers } from '../../lib/mediaLibrary'
import { hydrateShowroomOfferCards } from '../../lib/prestations/hydrateShowroomOfferCards'
import { parseShowroomTags } from '../../lib/prestations/modules'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfilePublicPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ error?: string; saved?: string; request_sent?: string }>
    | { error?: string; saved?: string; request_sent?: string }
}) {
  const params = await Promise.resolve(searchParams ?? {})
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canAccessCoachApp(profile?.role)) redirect('/login')

  const shell = await loadCoachShellContext(user.id)
  const branding = shell.branding as
    | (NonNullable<typeof shell.branding> & {
        app_showroom_title?: string | null
        app_showroom_pitch?: string | null
        app_showroom_features?: unknown
        interest_discuss_title?: string | null
        interest_discuss_body?: string | null
      })
    | null

  const prestaSelect =
    'id, name, description, price_cents, pricing_type, photo_url, video_url, showroom_tags, showroom_popup_tags, showroom_eyebrow, showroom_cta_label, showroom_description, showroom_week_id, showroom_photo_is_cover, showroom_video_role, highlight_tag, show_program_tags, showroom_hidden_program_tags, program_template_id, nutrition_template_id, drive_folder_id, program_template_ids, nutrition_template_ids, drive_folder_ids'
  const [
    { data: publicProfile },
    prestaProbe,
    videoProbe,
    testiProbe,
    headerTagsProbe,
    featuresProbe,
    libraryCovers,
  ] = await Promise.all([
    supabase
      .from('coach_public_profile')
      .select('public_name, tagline, bio, photo_url, cover_url, showroom_tags')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('prestations')
      .select(`${prestaSelect}, showroom_sort_order`)
      .eq('coach_id', user.id)
      .eq('showroom_visible', true)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('showroom_sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('coach_public_profile')
      .select('video_url')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('coach_public_profile')
      .select('showroom_testimonials')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('coach_public_profile')
      .select('showroom_header_tags')
      .eq('coach_id', user.id)
      .maybeSingle(),
    supabase
      .from('coach_branding')
      .select('app_showroom_features')
      .eq('coach_id', user.id)
      .maybeSingle(),
    listActiveMediaLibraryCovers(),
  ])

  let prestationsRaw = prestaProbe.data
  if (
    prestaProbe.error &&
    /showroom_sort_order|schema cache/i.test(prestaProbe.error.message)
  ) {
    const fallback = await supabase
      .from('prestations')
      .select(prestaSelect)
      .eq('coach_id', user.id)
      .eq('showroom_visible', true)
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true })
    prestationsRaw = fallback.data
  }
  const prestations = await hydrateShowroomOfferCards(
    supabase,
    (prestationsRaw ?? []) as Parameters<typeof hydrateShowroomOfferCards>[1],
  )
  const videoUrlInitial =
    !videoProbe.error &&
    typeof (videoProbe.data as { video_url?: string | null } | null)?.video_url === 'string'
      ? String((videoProbe.data as { video_url?: string | null }).video_url ?? '').trim()
      : ''
  const testimonialsInitial = !testiProbe.error
    ? parseShowroomTestimonials(
        (testiProbe.data as { showroom_testimonials?: unknown } | null)?.showroom_testimonials,
      )
    : []
  const headerTagsInitial = !headerTagsProbe.error
    ? parseShowroomTags(
        (headerTagsProbe.data as { showroom_header_tags?: unknown } | null)
          ?.showroom_header_tags,
      )
    : []
  const featuresInitial = !featuresProbe.error
    ? parseAppShowroomFeatures(
        (featuresProbe.data as { app_showroom_features?: unknown } | null)
          ?.app_showroom_features,
      )
    : parseAppShowroomFeatures(branding?.app_showroom_features)

  const { data: interestCopyRow } = await supabase
    .from('coach_branding')
    .select('interest_discuss_title, interest_discuss_body')
    .eq('coach_id', user.id)
    .maybeSingle()
  const interestCopy = interestCopyRow as {
    interest_discuss_title?: string | null
    interest_discuss_body?: string | null
  } | null

  const brand = branding?.primary_color?.trim() || DEFAULT_CLIENT_PRIMARY_COLOR

  return (
    <div className="mx-auto grid max-w-5xl gap-5 sm:gap-6">
        <ProfileHubHeader
          title="Présentation showroom"
          subtitle={
            <>
              Photo · cover · vidéo · témoignages · DA dans{' '}
              <Link
                href="/profile/mon-app"
                className="font-semibold text-[color:var(--brand)] hover:underline"
              >
                Mon app
              </Link>
            </>
          }
          showChromeActions={false}
        />

        {params.request_sent ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-[color:var(--fg)]">
            Demande envoyée — l’équipe Krid te répond bientôt.
          </div>
        ) : null}

        {params.error ? (
          <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
            {params.error}
          </div>
        ) : null}

        <CoachShowroomPresentationEditor
          primaryColor={brand}
          secondaryColor={branding?.secondary_color}
          themeMode={branding?.theme_mode}
          bgStyle={branding?.bg_style}
          appName={branding?.app_name?.trim() || 'Mon app'}
          logoUrl={
            branding?.logo_url?.trim() ||
            branding?.pwa_icon_url?.trim() ||
            null
          }
          libraryCovers={libraryCovers}
          prestations={prestations}
          initial={{
            public_name: publicProfile?.public_name ?? '',
            tagline: publicProfile?.tagline ?? '',
            bio: publicProfile?.bio ?? '',
            photo_url: publicProfile?.photo_url ?? null,
            cover_url: publicProfile?.cover_url ?? null,
            video_url: videoUrlInitial,
            app_showroom_pitch: branding?.app_showroom_pitch?.trim() ?? '',
            app_showroom_features: featuresInitial,
            showroom_header_tags: headerTagsInitial,
            showroom_testimonials: testimonialsInitial,
            interest_discuss_title:
              interestCopy?.interest_discuss_title?.trim() ||
              branding?.interest_discuss_title?.trim() ||
              DEFAULT_INTEREST_DISCUSS_TITLE,
            interest_discuss_body:
              interestCopy?.interest_discuss_body?.trim() ||
              branding?.interest_discuss_body?.trim() ||
              DEFAULT_INTEREST_DISCUSS_BODY,
          }}
        />
      </div>
  )
}
