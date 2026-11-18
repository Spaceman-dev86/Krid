import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Button } from '@/src/components/ui'
import { ProfileHubHeader } from '../../../components/coach/ProfileHubHeader'
import { ProfileRenduPreview } from '../../../components/coach/ProfileRenduPreview'
import { canAccessCoachApp } from '../../../lib/auth/roles'
import { parseAppShowroomFeatures } from '../../../lib/coach/appShowroomFeatures'
import { listCoachOnboardingQuestions } from '../../../lib/client-portal/onboarding'
import { loadCoachShellContext } from '../../../lib/coach/loadCoachShellContext'
import { parseShowroomTestimonials } from '../../../lib/coach/showroomTestimonials'
import { hydrateShowroomOfferCards } from '../../../lib/prestations/hydrateShowroomOfferCards'
import { parseShowroomTags } from '../../../lib/prestations/modules'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfileRenduPage() {
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
      })
    | null
  const slug = branding?.slug?.trim()

  if (!slug) {
    return (
      <div className="mx-auto grid max-w-4xl gap-6">
        <Header />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Définis un slug dans{' '}
          <Link href="/profile/mon-app" className="font-semibold underline">
            Mon app
          </Link>{' '}
          pour prévisualiser le parcours client.
        </div>
      </div>
    )
  }

  const prestaSelect =
    'id, name, description, price_cents, pricing_type, photo_url, video_url, showroom_tags, showroom_popup_tags, showroom_eyebrow, showroom_cta_label, showroom_description, showroom_week_id, showroom_photo_is_cover, showroom_video_role, highlight_tag, show_program_tags, showroom_hidden_program_tags, program_template_id, nutrition_template_id, drive_folder_id, program_template_ids, nutrition_template_ids, drive_folder_ids'

  const [
    { data: publicProfile },
    questions,
    prestaProbe,
    videoProbe,
    testiProbe,
    headerTagsProbe,
    featuresProbe,
  ] = await Promise.all([
    supabase
      .from('coach_public_profile')
      .select('public_name, tagline, bio, photo_url, cover_url')
      .eq('coach_id', user.id)
      .maybeSingle(),
    listCoachOnboardingQuestions(supabase, user.id).catch(() => []),
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

  const videoUrl =
    !videoProbe.error &&
    typeof (videoProbe.data as { video_url?: string | null } | null)?.video_url === 'string'
      ? String((videoProbe.data as { video_url?: string | null }).video_url ?? '').trim()
      : ''
  const testimonials = !testiProbe.error
    ? parseShowroomTestimonials(
        (testiProbe.data as { showroom_testimonials?: unknown } | null)?.showroom_testimonials,
      )
    : []
  const headerTags = !headerTagsProbe.error
    ? parseShowroomTags(
        (headerTagsProbe.data as { showroom_header_tags?: unknown } | null)
          ?.showroom_header_tags,
      )
    : []
  const appFeatures = !featuresProbe.error
    ? parseAppShowroomFeatures(
        (featuresProbe.data as { app_showroom_features?: unknown } | null)
          ?.app_showroom_features,
      )
    : parseAppShowroomFeatures(branding?.app_showroom_features)

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Header />
      <ProfileRenduPreview
        branding={{
          slug,
          app_name: branding?.app_name ?? null,
          logo_url: branding?.logo_url?.trim() || branding?.pwa_icon_url?.trim() || null,
          pwa_icon_url: branding?.pwa_icon_url ?? null,
          primary_color: branding?.primary_color ?? null,
          secondary_color: branding?.secondary_color ?? null,
          theme_mode: branding?.theme_mode ?? null,
          bg_style: branding?.bg_style ?? null,
          app_showroom_title: branding?.app_showroom_title ?? null,
          app_showroom_pitch: branding?.app_showroom_pitch ?? null,
        }}
        publicProfile={publicProfile}
        questions={questions}
        prestations={prestations}
        showroom={{
          videoUrl,
          headerTags,
          testimonials,
          appFeatures,
        }}
      />
      <p className="text-center text-sm text-[color:var(--muted)]">
        Showroom live :{' '}
        <Link
          href={`/c/${slug}/showroom`}
          target="_blank"
          className="font-semibold text-[color:var(--brand)] underline"
        >
          /c/{slug}/showroom
        </Link>
      </p>
    </div>
  )
}

function Header() {
  return (
    <ProfileHubHeader
      title="Rendu"
      subtitle="Parcours client (homescreen → portail → showroom) · DA + contenu showroom live"
      actions={
        <Button href="/profile/mon-app" variant="secondary" size="sm">
          ← Mon app
        </Button>
      }
      showChromeActions={false}
      showSubnav={false}
    />
  )
}
