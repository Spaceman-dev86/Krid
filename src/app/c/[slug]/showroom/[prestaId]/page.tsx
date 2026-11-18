import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'

import { ShowroomInterestCta } from '../../../../../components/showroom/ShowroomInterestCta'
import { ShowroomTrackedRef } from '../../../../../components/showroom/ShowroomTrackedRef'
import { hasPasswordSet } from '../../../../../lib/auth/password'
import { ShowroomWeekPreviewBlock } from '../../../../../components/showroom/ShowroomWeekPreviewBlock'
import {
  contrastBrandFg,
  normalizeBgStyle,
  normalizeThemeMode,
} from '../../../../../lib/coach/clientBrandTheme'
import {
  resolveDriveIds,
  resolveNutritionIds,
  resolveProgramIds,
} from '../../../../../lib/prestations/contentLinks'
import { formatPriceCents, parseShowroomTags } from '../../../../../lib/prestations/modules'
import { loadProgramShowroomMeta } from '../../../../../lib/prestations/loadProgramShowroomMeta'
import { loadShowroomWeekPreview } from '../../../../../lib/prestations/loadShowroomWeekPreview'
import {
  includedFromContentLinks,
  mergeShowroomTags,
  parseVideoEmbed,
  programShowroomTags,
} from '../../../../../lib/prestations/showroomPresentation'
import {
  loadPromoCodeForLink,
  resolveDefaultTrackedLink,
  resolveTrackedLinkByRef,
} from '../../../../../lib/tracking/recordShowroomRef'
import { withRef } from '../../../../../lib/tracking/trackedLinks'
import { createClient } from '../../../../../lib/supabase/server'
import { simulateShowroomPaymentAction } from '../actions'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ slug: string; prestaId: string }> | { slug: string; prestaId: string }
  searchParams?:
    | Promise<{ paid?: string; error?: string; ref?: string; promo?: string }>
    | { paid?: string; error?: string; ref?: string; promo?: string }
}

function currentPeriodYm() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriodYm(ym: string) {
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
}

export default async function ShowroomPrestationPage({ params, searchParams }: Props) {
  const { slug, prestaId } = await Promise.resolve(params)
  const sp = await Promise.resolve(searchParams ?? {})
  const refCode = typeof sp.ref === 'string' && sp.ref.trim() ? sp.ref.trim() : null
  const promoFromUrl =
    typeof sp.promo === 'string' && sp.promo.trim() ? sp.promo.trim().toUpperCase() : null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: branding } = await supabase
    .from('coach_branding')
    .select(
      'coach_id, slug, app_name, logo_url, primary_color, secondary_color, theme_mode, bg_style',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!branding) notFound()

  const { data: contactExtra } = await supabase
    .from('coach_branding')
    .select('interest_discuss_title, interest_discuss_body')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  let campaignPromo: { code: string; percentOff: number | null } | null = null
  const trackedLink = refCode
    ? await resolveTrackedLinkByRef(branding.coach_id, refCode)
    : await resolveDefaultTrackedLink(branding.coach_id)
  if (trackedLink?.promoCodeId) {
    campaignPromo = await loadPromoCodeForLink(branding.coach_id, trackedLink.promoCodeId)
  }
  const effectiveRef = refCode ?? trackedLink?.code ?? null
  const prefilledPromo = (campaignPromo?.code ?? promoFromUrl ?? '').toUpperCase() || null

  const interestDiscussTitle =
    (contactExtra as { interest_discuss_title?: string | null } | null)?.interest_discuss_title ??
    null
  const interestDiscussBody =
    (contactExtra as { interest_discuss_body?: string | null } | null)?.interest_discuss_body ?? null

  const { data: publicProfile } = await supabase
    .from('coach_public_profile')
    .select('public_name, photo_url')
    .eq('coach_id', branding.coach_id)
    .maybeSingle()

  const { data: prestationRaw } = await supabase
    .from('prestations')
    .select(
      'id, name, description, price_cents, pricing_type, modules, status, showroom_visible, photo_url, showroom_tags, showroom_popup_tags, video_url, highlight_tag, showroom_description, showroom_week_id, showroom_cta_label, showroom_eyebrow, show_program_tags, showroom_hidden_program_tags, showroom_photo_is_cover, showroom_video_role, program_template_id, nutrition_template_id, drive_folder_id, program_template_ids, nutrition_template_ids, drive_folder_ids',
    )
    .eq('id', prestaId)
    .eq('coach_id', branding.coach_id)
    .is('deleted_at', null)
    .maybeSingle()

  const prestation = prestationRaw as
    | {
        id: string
        name: string
        description: string | null
        price_cents: number
        pricing_type: string
        status: string
        showroom_visible: boolean
        photo_url?: string | null
        showroom_tags?: unknown
        video_url?: string | null
        highlight_tag?: string | null
        showroom_description?: string | null
        showroom_week_id?: string | null
        showroom_cta_label?: string | null
        showroom_eyebrow?: string | null
        show_program_tags?: boolean | null
        showroom_hidden_program_tags?: unknown
        showroom_photo_is_cover?: boolean | null
        showroom_video_role?: string | null
        program_template_id?: string | null
        nutrition_template_id?: string | null
        drive_folder_id?: string | null
        program_template_ids?: string[] | null
        nutrition_template_ids?: string[] | null
        drive_folder_ids?: string[] | null
      }
    | null

  if (!prestation || prestation.status !== 'active' || !prestation.showroom_visible) {
    notFound()
  }

  const linkedProgramIds = resolveProgramIds(prestation)
  const programTags: string[] = []
  for (const programId of linkedProgramIds) {
    const programMeta = await loadProgramShowroomMeta(supabase, programId)
    for (const tag of programShowroomTags(programMeta)) {
      if (!programTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        programTags.push(tag)
      }
    }
  }
  const cardTags = parseShowroomTags(prestation.showroom_tags)
  const popupCustomRaw = parseShowroomTags(
    (prestation as { showroom_popup_tags?: unknown }).showroom_popup_tags,
  )
  const popupCustom = popupCustomRaw.length ? popupCustomRaw : [...cardTags]
  const legacyHighlight = prestation.highlight_tag?.trim() || null
  if (legacyHighlight && !cardTags.some((t) => t.toLowerCase() === legacyHighlight.toLowerCase())) {
    cardTags.unshift(legacyHighlight)
  }
  const hiddenProgramTags =
    prestation.show_program_tags === false &&
    parseShowroomTags(prestation.showroom_hidden_program_tags).length === 0
      ? ['*']
      : parseShowroomTags(prestation.showroom_hidden_program_tags)
  const tags = mergeShowroomTags({
    customTags: popupCustom,
    programTags,
    hiddenProgramTags,
  })
  const programTemplateIds = linkedProgramIds
  const nutritionTemplateIds = resolveNutritionIds(prestation)
  const driveFolderIds = resolveDriveIds(prestation)
  const included = includedFromContentLinks({
    programTemplateIds,
    nutritionTemplateIds,
    driveFolderIds,
  })
  const video = parseVideoEmbed(prestation.video_url)
  const hasVideo = Boolean(video.kind && video.embedUrl)
  const videoRole: 'cover' | 'inline' | null = !hasVideo
    ? null
    : prestation.showroom_video_role === 'inline'
      ? 'inline'
      : prestation.showroom_video_role === 'cover'
        ? 'cover'
        : 'cover'
  const videoIsCover = videoRole === 'cover'
  const videoIsInline = videoRole === 'inline'
  const photoIsCover =
    Boolean(prestation.photo_url?.trim()) &&
    prestation.showroom_photo_is_cover !== false &&
    !videoIsCover
  const weekPreview = await loadShowroomWeekPreview(supabase, prestation.showroom_week_id)
  const bodyDescription = prestation.description?.trim() || null
  const bodyNote = prestation.showroom_description?.trim() || null
  const eyebrow = prestation.showroom_eyebrow?.trim() || null
  const ctaLabel = prestation.showroom_cta_label?.trim() || 'Découvrir'

  let canEnterPortal = false
  let alreadyPaid = false
  let hasActiveGrant = false
  const pricingType = prestation.pricing_type === 'renewable' ? 'renewable' : 'unique'
  const periodYm = pricingType === 'renewable' ? currentPeriodYm() : null

  if (user) {
    const { data: linked } = await supabase
      .from('clients')
      .select('id, first_name, last_name, sex, birth_date')
      .eq('user_id', user.id)
      .eq('coach_id', branding.coach_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (linked) {
      const passwordOk = await hasPasswordSet(supabase, user)
      const profileOk = Boolean(
        linked.first_name?.trim() &&
          linked.last_name?.trim() &&
          linked.sex?.trim() &&
          linked.birth_date
      )
      canEnterPortal = passwordOk && profileOk

      if (canEnterPortal) {
        let paidQuery = supabase
          .from('payment_ledger')
          .select('id')
          .eq('coach_id', branding.coach_id)
          .eq('client_id', linked.id)
          .eq('prestation_id', prestaId)
          .eq('status', 'paid')
          .limit(1)

        if (periodYm) paidQuery = paidQuery.eq('period_ym', periodYm)
        else paidQuery = paidQuery.is('period_ym', null)

        const { data: paidRow } = await paidQuery.maybeSingle()
        alreadyPaid = Boolean(paidRow)

        const { data: grant } = await supabase
          .from('client_grants')
          .select('id')
          .eq('coach_id', branding.coach_id)
          .eq('client_id', linked.id)
          .eq('prestation_id', prestaId)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle()
        hasActiveGrant = Boolean(grant)
      }
    }
  }

  const brand = branding.primary_color?.trim() || '#341c44'
  const brandFg = contrastBrandFg(brand)
  const secondary = branding.secondary_color?.trim() || undefined
  const themeMode = normalizeThemeMode(branding.theme_mode)
  const bgStyle = normalizeBgStyle(branding.bg_style)
  const pageBg = bgStyle === 'carbon' ? 'bg-da-canvas' : 'bg-[var(--page-bg)]'
  const appName = branding.app_name?.trim() || 'Krid'
  const coachName = publicProfile?.public_name?.trim() || appName
  const coachPhoto = publicProfile?.photo_url?.trim() || null
  const photoUrl = prestation.photo_url?.trim() || null
  const rejoindreHref = withRef(
    `/c/${slug}/rejoindre?presta=${encodeURIComponent(prestaId)}`,
    effectiveRef
  )
  const justPaid = sp.paid === '1'
  const errorMsg = typeof sp.error === 'string' && sp.error.trim() ? sp.error.trim() : null
  const canCheckout = canEnterPortal && !alreadyPaid
  /** Prospect = pas encore client lié app — CTA intérêt possible. */
  const isProspect = !canEnterPortal
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
      <ShowroomTrackedRef coachId={branding.coach_id} refCode={effectiveRef} brand={brand} />
      <header className="relative z-[2] border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-5 md:px-6">
          <div className="flex items-center gap-3">
            {coachPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coachPhoto}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-[var(--border)]"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: brand, color: brandFg }}
              >
                {coachName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                <Link href={withRef(`/c/${slug}/showroom`, effectiveRef)} className="hover:underline">
                  Showroom
                </Link>
              </p>
              <h1 className="text-xl font-extrabold text-[color:var(--fg)]">{coachName}</h1>
            </div>
          </div>
          {canEnterPortal ? (
            <Link
              href={`/c/${slug}/home`}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold"
              style={{ background: brand, color: brandFg }}
            >
              Entrer dans l’app
            </Link>
          ) : (
            <Link
              href={rejoindreHref}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold"
              style={{ background: brand, color: brandFg }}
            >
              Me connecter
            </Link>
          )}
        </div>
      </header>

      <div className="relative z-[2] mx-auto grid max-w-3xl gap-6 px-4 py-8 md:px-6">
        <Link
          href={withRef(`/c/${slug}/showroom`, effectiveRef)}
          className="text-sm font-semibold text-[color:var(--muted)] hover:underline"
        >
          ← Toutes les offres
        </Link>

        {justPaid ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Paiement enregistré (simulation). L’accès à l’offre est activé.
            <p className="mt-2 text-xs text-emerald-800/80">
              Sur iPhone : « Installer l’app » affiche les étapes Safari (Partager → Écran
              d’accueil). « Ouvrir mon espace » reste dans le navigateur.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/c/${slug}/install`}
                className="inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white"
                style={{ background: brand }}
              >
                Installer l’app
              </Link>
              <Link
                href={`/c/${slug}/home`}
                className="inline-flex rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900"
              >
                Ouvrir mon espace
              </Link>
            </div>
          </div>
        ) : null}

        {errorMsg ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMsg}
          </div>
        ) : null}

        <article className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <div className="relative min-h-[320px] sm:min-h-[380px]">
            {videoIsCover && (video.kind === 'youtube' || video.kind === 'vimeo') ? (
              <iframe
                title="Vidéo prestation"
                src={video.embedUrl!}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : videoIsCover && video.kind === 'file' ? (
              <video
                src={video.embedUrl!}
                controls
                playsInline
                poster={photoUrl ?? undefined}
                className="absolute inset-0 h-full w-full object-cover bg-black"
              />
            ) : photoIsCover && photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(145deg, ${brand} 0%, ${secondary || '#1a1220'} 55%, #1a1220 100%)`,
                }}
              />
            )}
            <div
              className={
                videoIsCover && (video.kind === 'youtube' || video.kind === 'vimeo')
                  ? 'pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent'
                  : 'absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15'
              }
            />
            <div className="relative flex min-h-[320px] flex-col justify-end gap-4 px-5 pb-5 pt-16 text-white sm:min-h-[380px] sm:px-6 sm:pb-6">
              <div>
                {eyebrow ? (
                  <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/75">
                    {eyebrow}
                  </p>
                ) : null}
                <h2 className="text-2xl font-extrabold tracking-tight drop-shadow-sm sm:text-3xl">
                  {prestation.name}
                </h2>
                <p className="mt-2 text-sm text-white/90">
                  {[
                    pricingType === 'renewable' ? 'Mensuel' : 'Paiement unique',
                    formatPriceCents(prestation.price_cents),
                  ].join(' · ')}
                </p>
                {tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
                        style={{ background: `${brand}99` }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/20 bg-white/15 px-4 py-4 text-sm text-white/95 shadow-sm backdrop-blur-md">
                {isProspect ? (
                  <>
                    <p>
                      Connecte-toi à l’application pour rejoindre {appName}, puis active cette
                      offre (paiement simulé pour l’instant).
                    </p>
                    <Link
                      href={rejoindreHref}
                      className="mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-bold shadow-md"
                      style={{ background: brand, color: brandFg }}
                    >
                      Me connecter
                    </Link>
                    <div className="mt-4 border-t border-white/20 pt-3">
                      <ShowroomInterestCta
                        coachId={branding.coach_id}
                        refCode={effectiveRef}
                        brand={brand}
                        brandFg={brandFg}
                        discussTitle={interestDiscussTitle}
                        discussBody={interestDiscussBody}
                        prestationId={prestaId}
                        prestationName={prestation.name}
                      />
                    </div>
                  </>
                ) : alreadyPaid || justPaid ? (
                  <>
                    <p className="font-semibold">
                      {justPaid ? 'Offre activée' : 'Déjà acquise'}
                    </p>
                    <p className="mt-1 text-white/85">
                      {pricingType === 'renewable' && periodYm
                        ? `Paiement enregistré pour ${formatPeriodYm(periodYm)}.`
                        : 'Tu as déjà accès à cette offre.'}
                      {hasActiveGrant ? ' L’accès est actif dans ton espace.' : null}
                    </p>
                    <Link
                      href={`/c/${slug}/home`}
                      className="mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-bold shadow-md"
                      style={{ background: brand, color: brandFg }}
                    >
                      Ouvrir mon espace
                    </Link>
                  </>
                ) : (
                  <>
                    <p>
                      Paiement simulé : enregistre un paiement Payé en compta et active l’accès.
                    </p>
                    {pricingType === 'renewable' && periodYm ? (
                      <p className="mt-1 text-xs text-white/70">
                        Période : {formatPeriodYm(periodYm)}
                      </p>
                    ) : null}
                    <form action={simulateShowroomPaymentAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="prestation_id" value={prestaId} />
                      {prefilledPromo && campaignPromo?.percentOff != null ? (
                        <p className="rounded-xl border border-white/25 bg-white/20 px-3 py-2 text-xs font-semibold text-white/95 backdrop-blur-sm">
                          Promo campagne · {prefilledPromo} · −{campaignPromo.percentOff} %
                        </p>
                      ) : null}
                      <input
                        type="text"
                        name="access_code"
                        placeholder="Code d’accès (optionnel)"
                        autoComplete="off"
                        className="rounded-xl border border-white/25 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-white/55 backdrop-blur-sm"
                      />
                      <input
                        type="text"
                        name="promo_code"
                        defaultValue={prefilledPromo ?? ''}
                        placeholder="Code promo (optionnel)"
                        autoComplete="off"
                        className="rounded-xl border border-white/25 bg-white/20 px-3 py-2 text-sm text-white placeholder:text-white/55 backdrop-blur-sm"
                      />
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold shadow-md disabled:opacity-50"
                        style={{ background: brand, color: brandFg }}
                        disabled={!canCheckout}
                      >
                        {ctaLabel}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-6 sm:px-6">
            {videoIsInline && hasVideo ? (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: brand }}>
                  Vidéo
                </p>
                <div className="mt-2 aspect-video overflow-hidden rounded-2xl bg-black">
                  {video.kind === 'youtube' || video.kind === 'vimeo' ? (
                    <iframe
                      title="Vidéo prestation"
                      src={video.embedUrl!}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={video.embedUrl!}
                      controls
                      playsInline
                      poster={photoUrl ?? undefined}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </div>
            ) : null}
            {bodyDescription ? (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: brand }}>
                  À quoi t’attendre
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--muted)]">
                  {bodyDescription}
                </p>
              </div>
            ) : null}
            {bodyNote ? (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: brand }}>
                  Note
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--muted)]">
                  {bodyNote}
                </p>
              </div>
            ) : null}
            {weekPreview ? (
              <ShowroomWeekPreviewBlock week={weekPreview} brandColor={brand} />
            ) : null}
            {included.length ? (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: brand }}>
                  Inclus
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {included.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: `${brand}18`, color: brand }}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  )
}
